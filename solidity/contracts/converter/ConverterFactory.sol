pragma solidity 0.4.26;
import "./interfaces/IConverter.sol";
import "./interfaces/IConverterFactory.sol";
import "./interfaces/ITypedSmartTokenFactory.sol";
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

    mapping (uint8 => ITypedSmartTokenFactory) public smartTokenFactories;
    mapping (uint8 => ITypedConverterFactory) public converterFactories;

    /**
      * @dev initializes a new ConverterFactory instance
    */
    constructor() public {
    }

    /**
      * @dev initializes the factory with a specific typed smart token factory
      * can only be called by the owner
      *
      * @param _factory typed smart token factory
    */
    function registerTypedSmartTokenFactory(ITypedSmartTokenFactory _factory) public ownerOnly {
        smartTokenFactories[_factory.converterType()] = _factory;
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
      * @dev creates a new smart token with the given arguments and transfers
      * the ownership to the caller
      *
      * @param _converterType   converter type, see ConverterBase contract main doc
      * @param _name            smart token name
      * @param _symbol          smart token symbol
      * @param _decimals        smart token decimals
      *
      * @return new smart token
    */
    function createSmartToken(uint8 _converterType, string _name, string _symbol, uint8 _decimals) public returns (ISmartToken) {
        ISmartToken token;
        ITypedSmartTokenFactory factory = smartTokenFactories[_converterType];

        if (factory == address(0)) {
            // create default smart token
            token = new SmartToken(_name, _symbol, _decimals);
        }
        else {
            // create custom smart token
            token = factory.createSmartToken(_name, _symbol, _decimals);
            token.acceptOwnership();
        }

        token.transferOwnership(msg.sender);
        return token;
    }

    /**
      * @dev creates a new converter with the given arguments and transfers
      * the ownership to the caller
      *
      * @param _type              converter type, see ConverterBase contract main doc
      * @param _token             smart token governed by the converter
      * @param _registry          address of a contract registry contract
      * @param _maxConversionFee  maximum conversion fee, represented in ppm
      *
      * @return new converter
    */
    function createConverter(uint8 _type, ISmartToken _token, IContractRegistry _registry, uint32 _maxConversionFee) public returns (IConverter) {
        IConverter converter = converterFactories[_type].createConverter(_token, _registry, _maxConversionFee);
        converter.acceptOwnership();
        converter.transferOwnership(msg.sender);

        emit NewConverter(converter, msg.sender);
        return converter;
    }
}
