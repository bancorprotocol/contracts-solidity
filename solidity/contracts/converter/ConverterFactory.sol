pragma solidity 0.4.26;
import "./interfaces/IConverter.sol";
import "./interfaces/IConverterFactory.sol";
import "./interfaces/ITypedConverterAnchorFactory.sol";
import "./interfaces/ITypedConverterFactory.sol";
import "../utility/Owned.sol";
import "../utility/interfaces/IContractRegistry.sol";
import "../token/SmartToken.sol";

/*
    Converter Factory
*/
contract ConverterFactory is IConverterFactory, Owned {
    /**
      * @dev triggered when a new converter is created
      *
      * @param _converter   new converter address
      * @param _owner       converter owner address
    */
    event NewConverter(address indexed _converter, address indexed _owner);

    mapping (uint16 => ITypedConverterAnchorFactory) public anchorFactories;
    mapping (uint16 => ITypedConverterFactory) public converterFactories;

    /**
      * @dev initializes the factory with a specific typed converter anchor factory
      * can only be called by the owner
      *
      * @param _factory typed converter anchor factory
    */
    function registerTypedConverterAnchorFactory(ITypedConverterAnchorFactory _factory) public ownerOnly {
        anchorFactories[_factory.converterType()] = _factory;
    }

    /**
      * @dev initializes the factory with a specific typed converter factory
      * can only be called by the owner
      *
      * @param _factory typed converter factory
    */
    function registerTypedConverterFactory(ITypedConverterFactory _factory) public ownerOnly {
        converterFactories[_factory.converterType()] = _factory;
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
    function createAnchor(uint16 _converterType, string _name, string _symbol, uint8 _decimals) public returns (IConverterAnchor) {
        IConverterAnchor anchor;
        ITypedConverterAnchorFactory factory = anchorFactories[_converterType];

        if (factory == address(0)) {
            // create default anchor (SmartToken)
            anchor = new SmartToken(_name, _symbol, _decimals);
        }
        else {
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
    function createConverter(uint16 _type, IConverterAnchor _anchor, IContractRegistry _registry, uint32 _maxConversionFee) public returns (IConverter) {
        IConverter converter = converterFactories[_type].createConverter(_anchor, _registry, _maxConversionFee);
        converter.acceptOwnership();
        converter.transferOwnership(msg.sender);

        emit NewConverter(converter, msg.sender);
        return converter;
    }
}
