pragma solidity 0.4.26;
import './BancorConverter.sol';
import './interfaces/IBancorConverterFactory.sol';
import '../utility/interfaces/IContractRegistry.sol';

/*
    Bancor Converter Factory
*/
contract BancorConverterFactory is IBancorConverterFactory {
    /**
      * @dev triggered when a new converter is created
      * 
      * @param _converter   new converter address
      * @param _owner       converter owner address
    */
    event NewConverter(address indexed _converter, address indexed _owner);

    /**
      * @dev initializes a new BancorConverterFactory instance
    */
    constructor() public {
    }

    /**
      * @dev creates a new converter with the given arguments and transfers
      * the ownership and management to the sender.
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
        _type; // forward compatibility
        BancorConverter converter = new BancorConverter(_token, _registry, _maxConversionFee, IERC20Token(0), 0);
        converter.transferOwnership(msg.sender);

        emit NewConverter(converter, msg.sender);
        return converter;
    }
}
