// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;
import "./FixedRatePoolConverter.sol";
import "../../interfaces/IConverter.sol";
import "../../interfaces/ITypedConverterFactory.sol";
import "../../../token/interfaces/IDSToken.sol";

/*
    FixedRatePoolConverter Factory
*/
contract FixedRatePoolConverterFactory is ITypedConverterFactory {
    /**
     * @dev returns the converter type the factory is associated with
     *
     * @return converter type
     */
    function converterType() external pure override returns (uint16) {
        return 4;
    }

    /**
     * @dev creates a new converter with the given arguments and transfers
     * the ownership to the caller
     *
     * @param _anchor            anchor governed by the converter
     * @param _registry          address of a contract registry contract
     * @param _maxConversionFee  maximum conversion fee, represented in ppm
     *
     * @return a new converter
     */
    function createConverter(
        IConverterAnchor _anchor,
        IContractRegistry _registry,
        uint32 _maxConversionFee
    ) external virtual override returns (IConverter) {
        IConverter converter = new FixedRatePoolConverter(IDSToken(address(_anchor)), _registry, _maxConversionFee);
        converter.transferOwnership(msg.sender);
        return converter;
    }
}
