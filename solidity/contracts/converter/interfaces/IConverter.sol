// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity >=0.6.12 <0.7.0;
import "./IConverterAnchor.sol";
import "../../token/interfaces/IERC20Token.sol";
import "../../utility/interfaces/IOwned.sol";
import "../../utility/interfaces/IWhitelist.sol";

/*
    Converter interface
*/
abstract contract IConverter is IOwned {
    function converterType() public virtual pure returns (uint16);
    function anchor() external virtual view returns (IConverterAnchor);
    function isActive() public virtual view returns (bool);

    function targetAmountAndFee(IERC20Token _sourceToken, IERC20Token _targetToken, uint256 _amount) public virtual view returns (uint256, uint256);
    function convert(IERC20Token _sourceToken,
                     IERC20Token _targetToken,
                     uint256 _amount,
                     address _trader,
                     address payable _beneficiary) public virtual payable returns (uint256);

    function conversionWhitelist() external virtual view returns (IWhitelist);
    function conversionFee() external virtual view returns (uint32);
    function maxConversionFee() external virtual view returns (uint32);
    function reserveBalance(IERC20Token _reserveToken) public virtual view returns (uint256);
    receive() external virtual payable;

    function transferAnchorOwnership(address _newOwner) public virtual;
    function acceptAnchorOwnership() public virtual;
    function setConversionFee(uint32 _conversionFee) public virtual;
    function setConversionWhitelist(IWhitelist _whitelist) public virtual;
    function withdrawTokens(IERC20Token _token, address _to, uint256 _amount) public virtual;
    function withdrawETH(address payable _to) public virtual;
    function addReserve(IERC20Token _token, uint32 _ratio) public virtual;

    // deprecated, backward compatibility
    function token() public virtual view returns (IConverterAnchor);
    function transferTokenOwnership(address _newOwner) public virtual;
    function acceptTokenOwnership() public virtual;
    function connectors(IERC20Token _address) public virtual view returns (uint256, uint32, bool, bool, bool);
    function getConnectorBalance(IERC20Token _connectorToken) public virtual view returns (uint256);
    function connectorTokens(uint256 _index) public virtual view returns (IERC20Token);
    function connectorTokenCount() public virtual view returns (uint16);
}
