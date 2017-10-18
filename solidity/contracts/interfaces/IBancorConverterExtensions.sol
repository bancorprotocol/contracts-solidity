pragma solidity ^0.4.11;
import './IBancorFormula.sol';
import './IBancorGasPriceLimit.sol';
import './IBancorQuickConverter.sol';

/*
    Bancor Converter Extensions interface
*/
contract IBancorConverterExtensions {
    function formula() public constant returns (IBancorFormula) {}
    function gasPriceLimit() public constant returns (IBancorGasPriceLimit) {}
    function quickConverter() public constant returns (IBancorQuickConverter) {}
}
