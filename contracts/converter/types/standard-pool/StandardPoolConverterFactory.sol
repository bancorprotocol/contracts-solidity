// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;
import "./StandardPoolConverter.sol";
import "../../interfaces/IConverter.sol";
import "../../interfaces/ITypedConverterFactory.sol";
import "../../../token/interfaces/IDSToken.sol";

/*
    StandardPoolConverter Factory
*/
contract StandardPoolConverterFactory is ITypedConverterFactory {
    /**
     * @dev returns the converter type the factory is associated with
     *
     * @return converter type
     */
    function converterType() external pure override returns (uint16) {
        return 3;
    }

    /**
     * @dev creates a new converter with the given arguments and transfers
     * the ownership to the caller
     *
     * @param anchor anchor governed by the converter
     * @param registry address of a contract registry contract
     * @param maxConversionFee maximum conversion fee, represented in ppm
     *
     * @return a new converter
     */
    function createConverter(
        IConverterAnchor anchor,
        IContractRegistry registry,
        uint32 maxConversionFee
    ) external virtual override returns (IConverter) {
        IConverter converter = new StandardPoolConverter(IDSToken(address(anchor)), registry, maxConversionFee);
        converter.transferOwnership(msg.sender);

        return converter;
    }
}
