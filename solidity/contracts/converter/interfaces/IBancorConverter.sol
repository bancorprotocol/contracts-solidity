pragma solidity ^0.4.24;
import '../../token/interfaces/IERC20Token.sol';
import '../../utility/interfaces/IWhitelist.sol';

/*
    Bancor Converter interface
*/
contract IBancorConverter {
    function getReturn(IERC20Token _fromToken, IERC20Token _toToken, uint256 _amount) public view returns (uint256, uint256);
    function convert2(IERC20Token _fromToken, IERC20Token _toToken, uint256 _amount, uint256 _minReturn, address _affiliateAccount, uint256 _affiliateFee) public returns (uint256);
    function quickConvert2(IERC20Token[] _path, uint256 _amount, uint256 _minReturn, address _affiliateAccount, uint256 _affiliateFee) public payable returns (uint256);
    function conversionWhitelist() public view returns (IWhitelist) {}
    function conversionFee() public view returns (uint32) {}
    function reserves(address _address) public view returns (uint256, uint32, bool, bool, bool) { _address; }
    function getReserveBalance(IERC20Token _reserveToken) public view returns (uint256);
    // deprecated, backward compatibility
    function change(IERC20Token _fromToken, IERC20Token _toToken, uint256 _amount, uint256 _minReturn) public returns (uint256);
    function convert(IERC20Token _fromToken, IERC20Token _toToken, uint256 _amount, uint256 _minReturn) public returns (uint256);
    function quickConvert(IERC20Token[] _path, uint256 _amount, uint256 _minReturn) public payable returns (uint256);
    function connectors(address _address) public view returns (uint256, uint32, bool, bool, bool);
}
