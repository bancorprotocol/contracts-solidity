pragma solidity 0.4.26;
import './IBancorConverter.sol';
import '../../token/interfaces/IERC20Token.sol';
import '../../token/interfaces/ISmartToken.sol';
import '../../utility/interfaces/IContractRegistry.sol';

/*
    Bancor Converter Factory interface
*/
contract IBancorConverterFactory {
    function createConverter(
        uint8 _type,
        ISmartToken _token,
        IContractRegistry _registry,
        uint32 _maxConversionFee
    )
    public returns (IBancorConverter);
}
