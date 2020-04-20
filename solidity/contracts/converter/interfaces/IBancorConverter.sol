pragma solidity 0.4.26;
import '../../token/interfaces/IERC20Token.sol';
import '../../token/interfaces/ISmartToken.sol';
import '../../utility/interfaces/IWhitelist.sol';

/*
    Bancor Converter interface
*/
contract IBancorConverter {
    function convertInternal(IERC20Token _fromToken, IERC20Token _toToken, uint256 _amount, uint256 _minReturn, address _beneficiary) public payable returns (uint256);

    function conversionWhitelist() public view returns (IWhitelist) {this;}
    function conversionFee() public view returns (uint32) {this;}
    function maxConversionFee() public view returns (uint32) {this;}
    function reserves(address _address) public view returns (uint256, uint32, bool, bool, bool) {_address; this;}
    function reserveTokens(uint256 _index) public view returns (IERC20Token) {_index; this;}

    function owner() public view returns (address);
    function transferOwnership(address _newOwner) public;
    function acceptOwnership() public;
    function token() public view returns (ISmartToken);
    function transferTokenOwnership(address _newOwner) public;
    function acceptTokenOwnership() public;
    function setConversionFee(uint32 _conversionFee) public;
    function setConversionWhitelist(IWhitelist _whitelist) public;
    function withdrawTokens(IERC20Token _token, address _to, uint256 _amount) public;
    function withdrawETH(address _to) public;
    function addReserve(IERC20Token _token, uint32 _ratio) public;
    function addETHReserve(uint32 _ratio) public;
    function updateReserveVirtualBalance(IERC20Token _reserveToken, uint256 _virtualBalance) public;
    function addLiquidity(IERC20Token[] memory _reserveTokens, uint256[] memory _reserveAmounts, uint256 _supplyMinReturnAmount) public payable;

    // deprecated, backward compatibility
    function connectors(address _address) public view returns (uint256, uint32, bool, bool, bool);
    function getConnectorBalance(IERC20Token _connectorToken) public view returns (uint256);
    function connectorTokens(uint256 _index) public view returns (IERC20Token);
    function connectorTokenCount() public view returns (uint16);
}
