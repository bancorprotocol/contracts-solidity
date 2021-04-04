// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "./INetworkSettings.sol";

import "./utility/Owned.sol";
import "./utility/Utils.sol";

/**
 * @dev This contract maintains the network settings.
 *
 */
contract NetworkSettings is INetworkSettings, Owned, Utils {
    ITokenHolder private _networkFeeWallet;
    uint32 private _networkFee;

    /**
     * @dev triggered when the network fee wallet is updated
     *
     * @param prevNetworkFeeWallet  previous network fee wallet
     * @param newNetworkFeeWallet   new network fee wallet
     */
    event NetworkFeeWalletUpdated(ITokenHolder prevNetworkFeeWallet, ITokenHolder newNetworkFeeWallet);

    /**
     * @dev triggered when the network fee is updated
     *
     * @param prevNetworkFee    previous network fee
     * @param newNetworkFee     new network fee
     */
    event NetworkFeeUpdated(uint32 prevNetworkFee, uint32 newNetworkFee);

    /**
     * @dev initializes a new NetworkSettings contract
     *
     * @param initialNetworkFeeWallet initial network fee wallet
     * @param initialNetworkFee initial network fee in ppm units
     */
    constructor(ITokenHolder initialNetworkFeeWallet, uint32 initialNetworkFee)
        public
        validAddress(address(initialNetworkFeeWallet))
        validFee(initialNetworkFee)
    {
        _networkFeeWallet = initialNetworkFeeWallet;
        _networkFee = initialNetworkFee;
    }

    /**
     * @dev returns the network fee parameters
     *
     * @return network fee wallet
     * @return network fee in ppm units
     */
    function networkFeeParams() external view override returns (ITokenHolder, uint32) {
        return (_networkFeeWallet, _networkFee);
    }

    /**
     * @dev returns the wallet that receives the global network fees
     *
     * @return network fee wallet
     */
    function networkFeeWallet() external view override returns (ITokenHolder) {
        return _networkFeeWallet;
    }

    /**
     * @dev returns the global network fee
     * the network fee is a portion of the total fees from each pool
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
     * @param newNetworkFeeWallet new network fee wallet
     */
    function setNetworkFeeWallet(ITokenHolder newNetworkFeeWallet)
        external
        ownerOnly
        validAddress(address(newNetworkFeeWallet))
    {
        emit NetworkFeeWalletUpdated(_networkFeeWallet, newNetworkFeeWallet);
        _networkFeeWallet = newNetworkFeeWallet;
    }

    /**
     * @dev sets the network fee
     * can be executed only by the owner
     *
     * @param newNetworkFee new network fee in ppm units
     */
    function setNetworkFee(uint32 newNetworkFee) external ownerOnly validFee(newNetworkFee) {
        emit NetworkFeeUpdated(_networkFee, newNetworkFee);
        _networkFee = newNetworkFee;
    }
}
