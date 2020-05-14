pragma solidity 0.4.26;
import './IBancorConverter.sol';
import '../../token/interfaces/ISmartToken.sol';
import '../../utility/interfaces/IContractRegistry.sol';

/*
    Typed Converter Factory interface
*/
contract ITypedConverterFactory {
    function createConverter(
        ISmartToken _token,
        IContractRegistry _registry,
        uint32 _maxConversionFee
    )
    public returns (IBancorConverter);
}
