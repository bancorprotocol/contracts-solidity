pragma solidity ^0.4.17;

import './DutchAuction.sol';

/// @title Distributor contract - distribution of tokens after an auction has ended.
contract Distributor {
    /*
     * Storage
     */

    DutchAuction public auction;

    /*
     * Events
     */

    event Deployed();

    /*
      * Public functions
      */
    /// @dev Contract constructor function, sets the auction contract address.
    /// @param _auction_address Address of auction contract.
    function Distributor(address _auction_address) public {
        require(_auction_address != 0x0);

        auction = DutchAuction(_auction_address);
        Deployed();
    }

    /// @notice Claim tokens in behalf of the following token owners: `addresses`.
    /// @dev Function that is called with an array of addresses for claiming tokens in their behalf.
    /// @param addresses Addresses of auction bidders that will be assigned tokens.
    function distribute(address[] addresses) public {
        for (uint32 i = 0; i < addresses.length; i++) {
            if (auction.bids(addresses[i]) > 0) {
                auction.proxyClaimTokens(addresses[i]);
            }
        }
    }
}
