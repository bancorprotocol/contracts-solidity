// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "./INetworkSettings.sol";

import "./utility/Owned.sol";
import "./utility/Utils.sol";

/**
 * @dev This contract maintains the network settings.
 */
contract NetworkSettings is INetworkSettings, Owned, Utils {
    ITokenHolder private _networkFeeWallet;
    uint32 private _networkFee;

    /**
     * @dev triggered when the network fee wallet is updated
     */
    event NetworkFeeWalletUpdated(ITokenHolder prevNetworkFeeWallet, ITokenHolder newNetworkFeeWallet);

    /**
     * @dev triggered when the network fee is updated
     */
    event NetworkFeeUpdated(uint32 prevNetworkFee, uint32 newNetworkFee);

    /**
     * @dev initializes a new NetworkSettings contract
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
     * @dev returns the network fee parameters (in units of PPM)
     */
    function networkFeeParams() external view override returns (ITokenHolder, uint32) {
        return (_networkFeeWallet, _networkFee);
    }

    /**
     * @dev returns the wallet that receives the global network fees
     */
    function networkFeeWallet() external view override returns (ITokenHolder) {
        return _networkFeeWallet;
    }

    /**
     * @dev returns the global network fee (in units of PPM)
     *
     * note that the network fee is a portion of the total fees from each pool
     */
    function networkFee() external view override returns (uint32) {
        return _networkFee;
    }

    /**
     * @dev sets the network fee wallet
     *
     * Requirements:
     *
     * - the caller must be the owner of the contract
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
     * @dev sets the network fee (in units of PPM)
     *
     * Requirements:
     *
     * - the caller must be the owner of the contract
     */
    function setNetworkFee(uint32 newNetworkFee) external ownerOnly validFee(newNetworkFee) {
        emit NetworkFeeUpdated(_networkFee, newNetworkFee);

        _networkFee = newNetworkFee;
    }
}
