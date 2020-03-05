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
      * @param  _token              smart token governed by the converter
      * @param  _registry           address of a contract registry contract
      * @param  _maxConversionFee   maximum conversion fee, represented in ppm
      * @param  _reserveToken       optional, initial reserve, allows defining the first reserve at deployment time
      * @param  _reserveRatio       optional, ratio for the initial reserve
      * 
      * @return a new converter
    */
    function createConverter(
        ISmartToken _token,
        IContractRegistry _registry,
        uint32 _maxConversionFee,
        IERC20Token _reserveToken,
        uint32 _reserveRatio
    ) public returns(address converterAddress) {
        BancorConverter converter = new BancorConverter(
            _token,
            _registry,
            _maxConversionFee,
            _reserveToken,
            _reserveRatio
        );

        converter.transferOwnership(msg.sender);

        address _converterAddress = address(converter);
        emit NewConverter(_converterAddress, msg.sender);
        return _converterAddress;
    }
}
