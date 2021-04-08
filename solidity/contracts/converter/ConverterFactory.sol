// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "./interfaces/IConverter.sol";
import "./interfaces/IConverterFactory.sol";
import "./interfaces/ITypedConverterFactory.sol";
import "./interfaces/ITypedConverterAnchorFactory.sol";
import "./interfaces/ITypedConverterCustomFactory.sol";
import "../utility/Owned.sol";
import "../utility/interfaces/IContractRegistry.sol";
import "../token/DSToken.sol";

/*
    Converter Factory
*/
contract ConverterFactory is IConverterFactory, Owned {
    /**
     * @dev triggered when a new converter is created
     *
     * @param converterType  converter type, see ConverterBase contract main doc
     * @param converter      new converter address
     * @param converterOwner converter owner address
     */
    event NewConverter(uint16 indexed converterType, IConverter indexed converter, address indexed converterOwner);

    mapping(uint16 => ITypedConverterFactory) public converterFactories;
    mapping(uint16 => ITypedConverterAnchorFactory) public anchorFactories;
    mapping(uint16 => ITypedConverterCustomFactory) public override customFactories;

    /**
     * @dev registers a specific typed converter factory
     * can only be called by the owner
     *
     * @param factory typed converter factory
     */
    function registerTypedConverterFactory(ITypedConverterFactory factory) public ownerOnly {
        converterFactories[factory.converterType()] = factory;
    }

    /**
     * @dev registers a specific typed converter anchor factory
     * can only be called by the owner
     *
     * @param factory typed converter anchor factory
     */
    function registerTypedConverterAnchorFactory(ITypedConverterAnchorFactory factory) public ownerOnly {
        anchorFactories[factory.converterType()] = factory;
    }

    /**
     * @dev registers a specific typed converter custom factory
     * can only be called by the owner
     *
     * @param factory typed converter custom factory
     */
    function registerTypedConverterCustomFactory(ITypedConverterCustomFactory factory) public ownerOnly {
        customFactories[factory.converterType()] = factory;
    }

    /**
     * @dev unregisters a specific typed converter factory
     * can only be called by the owner
     *
     * @param factory typed converter factory
     */
    function unregisterTypedConverterFactory(ITypedConverterFactory factory) public ownerOnly {
        uint16 converterType = factory.converterType();
        require(converterFactories[converterType] == factory, "ERR_NOT_REGISTERED");
        delete converterFactories[converterType];
    }

    /**
     * @dev unregisters a specific typed converter anchor factory
     * can only be called by the owner
     *
     * @param factory typed converter anchor factory
     */
    function unregisterTypedConverterAnchorFactory(ITypedConverterAnchorFactory factory) public ownerOnly {
        uint16 converterType = factory.converterType();
        require(anchorFactories[converterType] == factory, "ERR_NOT_REGISTERED");
        delete anchorFactories[converterType];
    }

    /**
     * @dev unregisters a specific typed converter custom factory
     * can only be called by the owner
     *
     * @param factory typed converter custom factory
     */
    function unregisterTypedConverterCustomFactory(ITypedConverterCustomFactory factory) public ownerOnly {
        uint16 converterType = factory.converterType();
        require(customFactories[converterType] == factory, "ERR_NOT_REGISTERED");
        delete customFactories[converterType];
    }

    /**
     * @dev creates a new converter anchor with the given arguments and transfers
     * the ownership to the caller
     *
     * @param converterType   converter type, see ConverterBase contract main doc
     * @param name            name
     * @param symbol          symbol
     * @param decimals        decimals
     *
     * @return new converter anchor
     */
    function createAnchor(
        uint16 converterType,
        string memory name,
        string memory symbol,
        uint8 decimals
    ) public virtual override returns (IConverterAnchor) {
        IConverterAnchor anchor;
        ITypedConverterAnchorFactory factory = anchorFactories[converterType];

        if (address(factory) == address(0)) {
            // create default anchor (DSToken)
            anchor = new DSToken(name, symbol, decimals);
        } else {
            // create custom anchor
            anchor = factory.createAnchor(name, symbol, decimals);
            anchor.acceptOwnership();
        }

        anchor.transferOwnership(msg.sender);
        return anchor;
    }

    /**
     * @dev creates a new converter with the given arguments and transfers
     * the ownership to the caller
     *
     * @param converterType     converter type, see ConverterBase contract main doc
     * @param anchor            anchor governed by the converter
     * @param registry          address of a contract registry contract
     * @param maxConversionFee  maximum conversion fee, represented in ppm
     *
     * @return new converter
     */
    function createConverter(
        uint16 converterType,
        IConverterAnchor anchor,
        IContractRegistry registry,
        uint32 maxConversionFee
    ) public virtual override returns (IConverter) {
        IConverter converter = converterFactories[converterType].createConverter(anchor, registry, maxConversionFee);
        converter.acceptOwnership();
        converter.transferOwnership(msg.sender);

        emit NewConverter(converterType, converter, msg.sender);
        return converter;
    }
}
