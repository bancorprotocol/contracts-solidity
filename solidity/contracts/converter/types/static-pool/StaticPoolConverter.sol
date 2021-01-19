// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "../standard-pool/StandardPoolConverter.sol";

/**
 * @dev This contract is a specialized version of the converter, which is
 * optimized for a liquidity pool that has 2 reserves with 50%/50% weights.
 */
contract StaticPoolConverter is StandardPoolConverter {
    /**
     * @dev initializes a new StaticPoolConverter instance
     *
     * @param  _anchor             anchor governed by the converter
     * @param  _registry           address of a contract registry contract
     * @param  _maxConversionFee   maximum conversion fee, represented in ppm
     */
    constructor(
        IConverterAnchor _anchor,
        IContractRegistry _registry,
        uint32 _maxConversionFee
    ) public StandardPoolConverter(_anchor, _registry, _maxConversionFee) {}

    /**
     * @dev returns the converter type
     *
     * @return see the converter types in the the main contract doc
     */
    function converterType() public pure override returns (uint16) {
        return 4;
    }

    function crossReserveTargetAmount(
        uint256 _sourceReserveBalance,
        uint256 _targetReserveBalance,
        uint256 _amount
    ) internal pure override returns (uint256) {
        _sourceReserveBalance;
        _targetReserveBalance;
        return _amount;
    }
}
