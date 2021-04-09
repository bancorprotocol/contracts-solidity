// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "./interfaces/IConverterFactory.sol";
import "./interfaces/ITypedConverterFactory.sol";
import "./interfaces/ITypedConverterAnchorFactory.sol";
import "../utility/Owned.sol";
import "../token/DSToken.sol";

/*
    Converter Factory
*/
contract ConverterFactory is IConverterFactory, Owned {
    /**
     * @dev triggered when a new converter is created
     *
     * @param converterType converter type, see ConverterBase contract main doc
     * @param converter new converter address
     * @param converterOwner converter owner address
     */
    event NewConverter(uint16 indexed converterType, IConverter indexed converter, address indexed converterOwner);

    mapping(uint16 => ITypedConverterFactory) private _converterFactories;
    mapping(uint16 => ITypedConverterAnchorFactory) private _anchorFactories;

    /**
     * @dev returns the converter factory of a given converter type
     *
     * @param converterType converter type, see ConverterBase contract main doc
     *
     * @return the converter factory of the given converter type
     */
    function converterFactories(uint16 converterType) external view returns (ITypedConverterFactory) {
        return _converterFactories[converterType];
    }

    /**
     * @dev returns the anchor factory of a given converter type
     *
     * @param converterType converter type, see ConverterBase contract main doc
     *
     * @return the anchor factory of the given converter type
     */
    function anchorFactories(uint16 converterType) external view returns (ITypedConverterAnchorFactory) {
        return _anchorFactories[converterType];
    }

    /**
     * @dev registers a specific typed converter factory
     * can only be called by the owner
     *
     * @param factory typed converter factory
     */
    function registerTypedConverterFactory(ITypedConverterFactory factory) external ownerOnly {
        _converterFactories[factory.converterType()] = factory;
    }

    /**
     * @dev registers a specific typed converter anchor factory
     * can only be called by the owner
     *
     * @param factory typed converter anchor factory
     */
    function registerTypedConverterAnchorFactory(ITypedConverterAnchorFactory factory) external ownerOnly {
        _anchorFactories[factory.converterType()] = factory;
    }

    /**
     * @dev unregisters a specific typed converter factory
     * can only be called by the owner
     *
     * @param factory typed converter factory
     */
    function unregisterTypedConverterFactory(ITypedConverterFactory factory) external ownerOnly {
        uint16 converterType = factory.converterType();
        require(_converterFactories[converterType] == factory, "ERR_NOT_REGISTERED");
        delete _converterFactories[converterType];
    }

    /**
     * @dev unregisters a specific typed converter anchor factory
     * can only be called by the owner
     *
     * @param factory typed converter anchor factory
     */
    function unregisterTypedConverterAnchorFactory(ITypedConverterAnchorFactory factory) external ownerOnly {
        uint16 converterType = factory.converterType();
        require(_anchorFactories[converterType] == factory, "ERR_NOT_REGISTERED");
        delete _anchorFactories[converterType];
    }

    /**
     * @dev creates a new converter anchor with the given arguments and transfers
     * the ownership to the caller
     *
     * @param converterType converter type, see ConverterBase contract main doc
     * @param name name
     * @param symbol symbol
     * @param decimals decimals
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
        ITypedConverterAnchorFactory factory = _anchorFactories[converterType];

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
     * @param converterType converter type, see ConverterBase contract main doc
     * @param anchor anchor governed by the converter
     * @param registry address of a contract registry contract
     * @param maxConversionFee maximum conversion fee, represented in ppm
     *
     * @return new converter
     */
    function createConverter(
        uint16 converterType,
        IConverterAnchor anchor,
        IContractRegistry registry,
        uint32 maxConversionFee
    ) public virtual override returns (IConverter) {
        IConverter converter = _converterFactories[converterType].createConverter(anchor, registry, maxConversionFee);
        converter.acceptOwnership();
        converter.transferOwnership(msg.sender);

        emit NewConverter(converterType, converter, msg.sender);
        return converter;
    }
}
