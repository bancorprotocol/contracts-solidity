// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;
import "./IERC20Token.sol";

/*
    Ether Token interface
*/
interface IEtherToken is IERC20Token {
    function deposit() external payable;
    function withdraw(uint256 _amount) external;
    function depositTo(address _to) external payable;
    function withdrawTo(address payable _to, uint256 _amount) external;
}
