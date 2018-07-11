pragma solidity ^0.4.17;

import './DutchAuction.sol';
import './interfaces/IFinancieCore.sol';

/// @title overrided from DutchAuction.
contract FinancieHeroesDutchAuction is DutchAuction {

    IFinancieCore core;

    /*
     * Public functions
     */

    /// @dev Contract constructor function sets the starting price, divisor constant and
    /// divisor exponent for calculating the Dutch Auction price.
    /// @param _wallet_address Wallet address to which all contributed ETH will be forwarded.
    /// @param _price_start High price in WEI at which the auction starts.
    /// @param _price_constant Auction price divisor constant.
    /// @param _price_exponent Auction price divisor exponent.
    function FinancieHeroesDutchAuction(
        address _wallet_address,
        address _whitelister_address,
        uint _price_start,
        uint _price_constant,
        uint32 _price_exponent)
        public
        DutchAuction(
          _wallet_address,
          _whitelister_address,
          _price_start,
          _price_constant,
          _price_exponent
        )
    {
    }

    /// @notice overrided from DutchAuction.
    /// @param _core_address Financie Core address.
    function setup(address _core_address, address _token_address) public isOwner atStage(Stages.AuctionDeployed) {
        super.setup(_token_address);
        core = IFinancieCore(_core_address);
    }

    /// --------------------------------- Auction Functions ------------------

    /// @notice overrided from DutchAuction.
    function bid()
        public
        payable
        atStage(Stages.AuctionStarted)
    {
        super.bid();
        core.notifyBidCards(msg.sender, address(token), msg.value);
    }

    /// @notice overrided from DutchAuction.
    function proxyClaimTokens(address receiver_address)
        public
        atStage(Stages.AuctionEnded)
        returns (bool)
    {
        uint256 balanceBefore = token.balanceOf(receiver_address);
        if ( super.proxyClaimTokens(receiver_address) ) {
            uint256 balanceAfter = token.balanceOf(receiver_address);
            core.notifyWithdrawalCards(msg.sender, address(token), balanceAfter - balanceBefore);
            return true;
        }
        return false;
    }

    function estimateClaimTokens(address receiver_address)
        public
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
