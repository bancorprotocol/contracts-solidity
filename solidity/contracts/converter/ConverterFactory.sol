pragma solidity 0.4.26;
import "./BancorConverter.sol";
import "./interfaces/IConverterFactory.sol";
import "./interfaces/ITypedConverterFactory.sol";
import "../utility/interfaces/IContractRegistry.sol";

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

    mapping (uint8 => ITypedConverterFactory) public factories;

    /**
      * @dev initializes a new ConverterFactory instance
    */
    constructor() public {
    }

    /**
      * @dev initializes the factory with a specific typed factory
      * can only be called by the owner
      *
      * @param _factory typed factory
    */
    function registerTypedFactory(ITypedConverterFactory _factory) public ownerOnly {
        factories[_factory.converterType()] = _factory;
    }

    /**
      * @dev creates a new converter with the given arguments and transfers
      * the ownership to the caller
      *
      * @param _type              converter type, see BancorConverter contract main doc
      * @param _token             smart token governed by the converter
      * @param _registry          address of a contract registry contract
      * @param _maxConversionFee  maximum conversion fee, represented in ppm
      *
      * @return a new converter
    */
    function createConverter(
        uint8 _type,
        ISmartToken _token,
        IContractRegistry _registry,
        uint32 _maxConversionFee
    ) public returns(IBancorConverter) {
        IBancorConverter converter = factories[_type].createConverter(_token, _registry, _maxConversionFee);
        converter.acceptOwnership();
        converter.transferOwnership(msg.sender);

        emit NewConverter(converter, msg.sender);
        return converter;
    }
}
