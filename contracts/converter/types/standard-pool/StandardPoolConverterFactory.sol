// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;
import "./StandardPoolConverter.sol";
import "../../interfaces/IConverter.sol";
import "../../interfaces/ITypedConverterFactory.sol";
import "../../../token/interfaces/IDSToken.sol";

/**
 * @dev StandardPoolConverter Factory
 */
contract StandardPoolConverterFactory is ITypedConverterFactory {
    /**
     * @dev returns the converter type the factory is associated with
     */
    function converterType() external pure override returns (uint16) {
        return 3;
    }

    /**
     * @dev creates a new converter with the given arguments and transfers the ownership to the caller
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
