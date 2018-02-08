pragma solidity ^0.4.18;
import './IBancorFormula.sol';
import './IBancorGasPriceLimit.sol';
import './IBancorQuickConverter.sol';

/*
    Bancor Converter Extensions interface
*/
contract IBancorConverterExtensions {
    function formula() public view returns (IBancorFormula) {}
    function gasPriceLimit() public view returns (IBancorGasPriceLimit) {}
    function quickConverter() public view returns (IBancorQuickConverter) {}
}
