pragma solidity ^0.4.10;
import './ERC20TokenInterface.sol';

/*
    Smart Token interface
*/
contract SmartTokenInterface is ERC20TokenInterface {
    // this function isn't abstract since the compiler doesn't recognize automatically generated getter functions as functions
    function changer() public constant returns (address changer) {}

    function disableTransfers(bool _disable) public;
    function issue(address _to, uint256 _amount) public returns (bool success);
    function destroy(address _from, uint256 _amount) public returns (bool success);
    function setChanger(address _changer) public returns (bool success);
}
