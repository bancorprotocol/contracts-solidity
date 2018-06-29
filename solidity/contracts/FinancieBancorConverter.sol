pragma solidity ^0.4.18;
import './BancorConverter.sol';
import './interfaces/IFinancieCore.sol';

contract FinancieBancorConverter is BancorConverter {

    IFinancieCore core;

    /**
        @dev constructor

        @param  _token              smart token governed by the converter
        @param  _extensions         address of a bancor converter extensions contract
        @param  _maxConversionFee   maximum conversion fee, represented in ppm
        @param  _connectorToken     optional, initial connector, allows defining the first connector at deployment time
        @param  _connectorWeight    optional, weight for the initial connector
    */
    function FinancieBancorConverter(ISmartToken _token, IBancorConverterExtensions _extensions, address _core_address, uint32 _maxConversionFee, IERC20Token _connectorToken, uint32 _connectorWeight)
        public
        BancorConverter(_token, _extensions, _maxConversionFee, _connectorToken, _connectorWeight)
    {
        core = IFinancieCore(_core_address);
    }

}
