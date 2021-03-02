// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "./INetworkSettings.sol";
import "./utility/Owned.sol";
import "./utility/Utils.sol";

/**
 * @dev This contract maintains the network settings.
 */
contract NetworkSettings is INetworkSettings, Owned, Utils {
    uint32 private constant PPM_RESOLUTION = 1000000;

    address private _feeWallet;
    uint32 private _feePortion;

    // ensures that the portion is valid
    modifier validPortion(uint32 _portion) {
        _validPortion(_portion);
        _;
    }

    // error message binary size optimization
    function _validPortion(uint32 _portion) internal pure {
        require(_portion > 0 && _portion <= PPM_RESOLUTION, "ERR_INVALID_PORTION");
    }

    /**
     * @dev initializes a new NetworkSettings contract
     */
    constructor(address feeWallet, uint32 feePortion) validAddress(feeWallet) validPortion(feePortion) public {
        _feeWallet = feeWallet;
        _feePortion = feePortion;
    }

    /**
     * @dev returns the fee parameters
     *
     * @return fee wallet address
     * @return fee portion in ppm units
     */
    function feeParams() external view override returns (address, uint32) {
        return (_feeWallet, _feePortion);
    }

    /**
     * @dev sets the fee wallet
     * can be executed only by the owner
     *
     * @param feeWallet fee wallet address
     */
    function setFeeWallet(address feeWallet) external ownerOnly validAddress(feeWallet) {
        _feeWallet = feeWallet;
    }

    /**
     * @dev sets the fee portion
     * can be executed only by the owner
     *
     * @param feePortion fee portion in ppm units
     */
    function setFeePortion(uint32 feePortion) external ownerOnly validPortion(feePortion) {
        _feePortion = feePortion;
    }
}
