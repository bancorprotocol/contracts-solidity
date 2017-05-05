pragma solidity ^0.4.10;
import './ERC20TokenInterface.sol';

/*
    Smart Token interface
*/
contract SmartTokenInterface is ERC20TokenInterface {
    function disableTransfers(bool _disable) public;
    function issue(address _to, uint256 _amount) public returns (bool success);
    function destroy(address _from, uint256 _amount) public returns (bool success);
    function setChanger(address _changer) public returns (bool success);

    event ChangerUpdate(address _prevChanger, address _newChanger);
}
