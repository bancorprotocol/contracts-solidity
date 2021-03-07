// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "./INetworkSettings.sol";
import "./utility/Owned.sol";
import "./utility/Utils.sol";

/**
 * @dev This contract maintains the network settings.
 */
contract NetworkSettings is INetworkSettings, Owned, Utils {
    address private _networkFeeWallet;
    uint32 private _networkFee;

    /**
     * @dev initializes a new NetworkSettings contract
     */
    constructor(address networkFeeWalletVal, uint32 networkFeeVal) validAddress(networkFeeWalletVal) validPortion(networkFeeVal) public {
        _networkFeeWallet = networkFeeWalletVal;
        _networkFee = networkFeeVal;
    }

    /**
     * @dev returns the network settings
     *
     * @return network fee wallet
     * @return network fee in ppm units
     */
    function feeParams() external view override returns (address, uint32) {
        return (_networkFeeWallet, _networkFee);
    }

    /**
     * @dev returns the network fee wallet
     *
     * @return network fee wallet
     */
    function networkFeeWallet() external view override returns (address) {
        return _networkFeeWallet;
    }

    /**
     * @dev returns the network fee
     *
     * @return network fee in ppm units
     */
    function networkFee() external view override returns (uint32) {
        return _networkFee;
    }

    /**
     * @dev sets the network fee wallet
     * can be executed only by the owner
     *
     * @param networkFeeWalletVal network fee wallet
     */
    function setNetworkFeeWallet(address networkFeeWalletVal) external ownerOnly validAddress(networkFeeWalletVal) {
        _networkFeeWallet = networkFeeWalletVal;
    }

    /**
     * @dev sets the network fee
     * can be executed only by the owner
     *
     * @param networkFeeVal network fee in ppm units
     */
    function setNetworkFee(uint32 networkFeeVal) external ownerOnly validPortion(networkFeeVal) {
        _networkFee = networkFeeVal;
    }
}
