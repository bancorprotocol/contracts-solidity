pragma solidity ^0.4.17;

import '../DutchAuction/DutchAuction.sol';
import './IFinancieAuction.sol';
import './FinancieFee.sol';
import './FinancieNotifierDelegate.sol';
import './IFinancieInternalWallet.sol';
import '../utility/Owned.sol';
import '../token/interfaces/IERC20Token.sol';

/// @title overrided from DutchAuction.
contract FinancieHeroesDutchAuction is IFinancieAuction, DutchAuction, Owned, FinancieNotifierDelegate, FinancieFee {

    IERC20Token paymentCurrentyToken;
    IFinancieInternalWallet internalWallet;
    uint32 hero_id;

    /*
     * Public functions
     */

    /**
    *   @dev Contract constructor function sets the starting price, divisor constant and
    *        divisor exponent for calculating the Dutch Auction price.
    *
    *   @param   _hero_id           Issuer id.
    *   @param   _price_start       High price in WEI at which the auction starts.
    *   @param   _price_constant    Auction price divisor constant.
    *   @param   _price_exponent    Auction price divisor exponent.
    *   @param   _notifier_address  Financie Notifier address.
    */
    constructor(
        uint32  _hero_id,
        address _team_wallet,
        address _whitelister_address,
        uint32 _teamFee,
        uint _price_start,
        uint _price_constant,
        uint32 _price_exponent,
        address _notifier_address,
        address _payment_currency_token_address,
        address _internal_wallet_address)
        public
        DutchAuction(
          _internal_wallet_address,
          _whitelister_address,
          _price_start,
          _price_constant,
          _price_exponent
        )
        FinancieNotifierDelegate(_notifier_address)
    {
        require(_teamFee <= 1000000);
        paymentCurrentyToken = IERC20Token(_payment_currency_token_address);
        internalWallet = IFinancieInternalWallet(_internal_wallet_address);
        hero_id = _hero_id;
        setFee(1000000 - _teamFee, _teamFee, _hero_id, _team_wallet, _payment_currency_token_address, _internal_wallet_address);
    }

    /**
    *   @notice  overrided from DutchAuction.
    */
    function startAuction() public {
        super.startAuction();
        notifyApproveNewCards(address(token));
    }

    /**
    *   @notice  overrided from DutchAuction.
    */
    function finalizeAuction() public {
        super.finalizeAuction();
        notifyCardAuctionFinalized(address(token), address(this));
    }

    /// --------------------------------- Auction Functions ------------------

    /**
    *   @notice  overrided from DutchAuction to prevent default bidding.
    */
    function bid()
        public
        payable
    {
        revert();
    }

    function bidToken(uint256 _amount)
        public
        atStage(Stages.AuctionStarted)
        returns (uint256, uint256, uint256)
    {
        // Missing funds without the current bid value
        uint missing_funds = missingFundsToEndAuction();

        uint256 amount = _amount;
        if ( amount > missing_funds ) {
            amount = missing_funds;
        }

        require(amount > 0);
        assert(bids[msg.sender] + amount >= amount);

        paymentCurrentyToken.transferFrom(msg.sender, this, amount);

        bids[msg.sender] += amount;
        received_wei += amount;

        // Send bid amount to wallet
        uint256 feeAmount = distributeFees(amount);
        uint256 heroFee = getHeroFee(amount);
        uint256 teamFee = getTeamFee(amount);
        uint256 net = safeSub(amount, feeAmount);
        assert(net == 0);

        BidSubmission(msg.sender, amount, missing_funds);

        assert(received_wei >= amount);

        notifyBidCards(msg.sender, address(token), amount);

        // Notify logs of revenue
        notifyAuctionRevenue(msg.sender, address(this), address(token), hero_id, heroFee, teamFee);

        return (amount, heroFee, teamFee);
    }

    /**
    *   @notice  overrided from DutchAuction.
    */
    function proxyClaimTokens(address receiver_address)
        public
        atStage(Stages.AuctionEnded)
        returns (bool)
    {
        uint256 myBids = bids[receiver_address];
        uint256 balanceBefore = token.balanceOf(receiver_address);
        if ( super.proxyClaimTokens(receiver_address) ) {
            uint256 balanceAfter = token.balanceOf(receiver_address);
            notifyWithdrawalCards(receiver_address, address(token), myBids, balanceAfter - balanceBefore);
            return true;
        }
        return false;
    }

    function estimateClaimTokens(address receiver_address)
        public
        view
        returns (uint256)
    {
        if ( bids[receiver_address] > 0 ) {
          uint current_price = token_multiplier * received_wei / num_tokens_auctioned;
          return (token_multiplier * bids[receiver_address]) / current_price;
        }
        return 0;
    }

    function canClaimTokens(address receiver_address)
        public
        view
        returns (bool)
    {
        if ( stage == Stages.AuctionEnded ) {
          if ( bids[receiver_address] > 0 ) {
            return (now > end_time + token_claim_waiting_period);
          }
        }
        return false;
    }

    function auctionFinished() public
        view
        returns (bool)
    {
        if ( stage == Stages.AuctionEnded ) {
            return (now > end_time + token_claim_waiting_period);
        }
        return false;
    }

    function targetToken()
        public
        view
        returns (address)
    {
        return token;
    }


}
