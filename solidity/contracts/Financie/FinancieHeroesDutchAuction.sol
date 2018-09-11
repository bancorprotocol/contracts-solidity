pragma solidity ^0.4.17;

import '../DutchAuction/DutchAuction.sol';
import './FinancieFee.sol';
import './FinancieNotifierDelegate.sol';

/// @title overrided from DutchAuction.
contract FinancieHeroesDutchAuction is DutchAuction, FinancieNotifierDelegate, FinancieFee {

    /*
     * Public functions
     */

    /**
    *   @dev Contract constructor function sets the starting price, divisor constant and
    *        divisor exponent for calculating the Dutch Auction price.
    *
    *   @param   _wallet_address    Wallet address to which all contributed ETH will be forwarded.
    *   @param   _price_start       High price in WEI at which the auction starts.
    *   @param   _price_constant    Auction price divisor constant.
    *   @param   _price_exponent    Auction price divisor exponent.
    *   @param   _notifier_address  Financie Notifier address.
    */
    constructor(
        address _wallet_address,
        address _team_wallet,
        address _whitelister_address,
        uint32 _teamFee,
        uint _price_start,
        uint _price_constant,
        uint32 _price_exponent,
        address _notifier_address)
        public
        DutchAuction(
          _wallet_address,
          _whitelister_address,
          _price_start,
          _price_constant,
          _price_exponent
        )
        FinancieFee(0, _teamFee, _wallet_address, _team_wallet)
        FinancieNotifierDelegate(_notifier_address)
    {
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
    *   @notice  overrided from DutchAuction.
    */
    function bid()
        public
        payable
        atStage(Stages.AuctionStarted)
    {
        // Missing funds without the current bid value
        uint missing_funds = missingFundsToEndAuction();

        uint256 amount = msg.value;
        if ( msg.value > missing_funds ) {
            amount = missing_funds;
            msg.sender.transfer(safeSub(msg.value, amount));
        }

        require(amount > 0);
        require(bids[msg.sender] + amount <= bid_threshold || whitelist[msg.sender]);
        assert(bids[msg.sender] + amount >= amount);

        bids[msg.sender] += amount;
        received_wei += amount;

        // Send bid amount to wallet
        uint256 feeAmount = distributeFees(amount);
        uint256 net = safeSub(amount, feeAmount);
        wallet_address.transfer(net);

        BidSubmission(msg.sender, amount, missing_funds);

        assert(received_wei >= amount);

        notifyBidCards(msg.sender, address(token), amount);

        // Notify logs of revenue
        notifyAuctionRevenue(msg.sender, address(this), address(token), hero_wallet, net, team_wallet, feeAmount);
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

}
