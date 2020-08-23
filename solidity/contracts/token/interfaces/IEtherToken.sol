// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity >=0.6.12 <0.7.0;
import "./IERC20Token.sol";

/*
    Ether Token interface
*/
abstract contract IEtherToken is IERC20Token {
    function deposit() public virtual payable;
    function withdraw(uint256 _amount) public virtual;
    function depositTo(address _to) public virtual payable;
    function withdrawTo(address payable _to, uint256 _amount) public virtual;
}
