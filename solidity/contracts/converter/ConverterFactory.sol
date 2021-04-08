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
     * @param _type        converter type, see ConverterBase contract main doc
     * @param _converter   new converter address
     * @param _owner       converter owner address
     */
    event NewConverter(uint16 indexed _type, IConverter indexed _converter, address indexed _owner);

    mapping(uint16 => ITypedConverterFactory) public converterFactories;
    mapping(uint16 => ITypedConverterAnchorFactory) public anchorFactories;
    mapping(uint16 => ITypedConverterCustomFactory) public override customFactories;

    /**
     * @dev registers a specific typed converter factory
     * can only be called by the owner
     *
     * @param _factory typed converter factory
     */
    function registerTypedConverterFactory(ITypedConverterFactory _factory) public ownerOnly {
        converterFactories[_factory.converterType()] = _factory;
    }

    /**
     * @dev registers a specific typed converter anchor factory
     * can only be called by the owner
     *
     * @param _factory typed converter anchor factory
     */
    function registerTypedConverterAnchorFactory(ITypedConverterAnchorFactory _factory) public ownerOnly {
        anchorFactories[_factory.converterType()] = _factory;
    }

    /**
     * @dev registers a specific typed converter custom factory
     * can only be called by the owner
     *
     * @param _factory typed converter custom factory
     */
    function registerTypedConverterCustomFactory(ITypedConverterCustomFactory _factory) public ownerOnly {
        customFactories[_factory.converterType()] = _factory;
    }

    /**
     * @dev unregisters a specific typed converter factory
     * can only be called by the owner
     *
     * @param _factory typed converter factory
     */
    function unregisterTypedConverterFactory(ITypedConverterFactory _factory) public ownerOnly {
        uint16 converterType = _factory.converterType();
        require(converterFactories[converterType] == _factory, "ERR_NOT_REGISTERED");
        delete converterFactories[converterType];
    }

    /**
     * @dev unregisters a specific typed converter anchor factory
     * can only be called by the owner
     *
     * @param _factory typed converter anchor factory
     */
    function unregisterTypedConverterAnchorFactory(ITypedConverterAnchorFactory _factory) public ownerOnly {
        uint16 converterType = _factory.converterType();
        require(anchorFactories[converterType] == _factory, "ERR_NOT_REGISTERED");
        delete anchorFactories[converterType];
    }

    /**
     * @dev unregisters a specific typed converter custom factory
     * can only be called by the owner
     *
     * @param _factory typed converter custom factory
     */
    function unregisterTypedConverterCustomFactory(ITypedConverterCustomFactory _factory) public ownerOnly {
        uint16 converterType = _factory.converterType();
        require(customFactories[converterType] == _factory, "ERR_NOT_REGISTERED");
        delete customFactories[converterType];
    }

    /**
     * @dev creates a new converter anchor with the given arguments and transfers
     * the ownership to the caller
     *
     * @param _converterType   converter type, see ConverterBase contract main doc
     * @param _name            name
     * @param _symbol          symbol
     * @param _decimals        decimals
     *
     * @return new converter anchor
     */
    function createAnchor(
        uint16 _converterType,
        string memory _name,
        string memory _symbol,
        uint8 _decimals
    ) public virtual override returns (IConverterAnchor) {
        IConverterAnchor anchor;
        ITypedConverterAnchorFactory factory = anchorFactories[_converterType];

        if (address(factory) == address(0)) {
            // create default anchor (DSToken)
            anchor = new DSToken(_name, _symbol, _decimals);
        } else {
            // create custom anchor
            anchor = factory.createAnchor(_name, _symbol, _decimals);
            anchor.acceptOwnership();
        }

        anchor.transferOwnership(msg.sender);
        return anchor;
    }

    /**
     * @dev creates a new converter with the given arguments and transfers
     * the ownership to the caller
     *
     * @param _type              converter type, see ConverterBase contract main doc
     * @param _anchor            anchor governed by the converter
     * @param _registry          address of a contract registry contract
     * @param _maxConversionFee  maximum conversion fee, represented in ppm
     *
     * @return new converter
     */
    function createConverter(
        uint16 _type,
        IConverterAnchor _anchor,
        IContractRegistry _registry,
        uint32 _maxConversionFee
    ) public virtual override returns (IConverter) {
        IConverter converter = converterFactories[_type].createConverter(_anchor, _registry, _maxConversionFee);
        converter.acceptOwnership();
        converter.transferOwnership(msg.sender);

        emit NewConverter(_type, converter, msg.sender);
        return converter;
    }
}
