pragma solidity ^0.4.21;
import './ITokenConverter.sol';
import '../../utility/interfaces/IWhitelist.sol';

/*
    Bancor Converter interface
*/
contract IBancorConverter is ITokenConverter {
    uint256 public constant FEATURE_CONVERSION_WHITELIST = 1 << 0;

    function conversionWhitelist() public view returns (IWhitelist) {}
}
