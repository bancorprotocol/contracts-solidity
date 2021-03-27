// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "./INetworkSettings.sol";
import "./utility/Owned.sol";
import "./utility/Utils.sol";

/**
 * @dev This contract maintains the network settings.
 *
 * In the context below, the term 'network fee' denotes the relative portion
 * (in PPM units) taken from all conversion fees accumulated in the network.
 */
contract NetworkSettings is INetworkSettings, Owned, Utils {
    address private _networkFeeWallet;
    uint32 private _networkFee;

    // ensures that the fee is valid
    modifier validFee(uint32 fee) {
        _validFee(fee);
        _;
    }

    // error message binary size optimization
    function _validFee(uint32 fee) internal pure {
        require(fee <= PPM_RESOLUTION, "ERR_INVALID_FEE");
    }

    /**
     * @dev triggered when the network fee wallet is updated
     *
     * @param prevNetworkFeeWallet  previous network fee wallet
     * @param newNetworkFeeWallet   new network fee wallet
     */
    event NetworkFeeWalletUpdated(address prevNetworkFeeWallet, address newNetworkFeeWallet);

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
    constructor(address initialNetworkFeeWallet, uint32 initialNetworkFee) validAddress(initialNetworkFeeWallet) validFee(initialNetworkFee) public {
        _networkFeeWallet = initialNetworkFeeWallet;
        _networkFee = initialNetworkFee;
    }

    /**
     * @dev returns the network fee parameters
     *
     * @return network fee wallet
     * @return network fee in ppm units
     */
    function networkFeeParams() external view override returns (address, uint32) {
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
     * @param newNetworkFeeWallet new network fee wallet
     */
    function setNetworkFeeWallet(address newNetworkFeeWallet) external ownerOnly validAddress(newNetworkFeeWallet) {
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
