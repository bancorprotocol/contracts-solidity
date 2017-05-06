pragma solidity ^0.4.10;

/*
    Bancor events interface
*/
contract BancorEventsInterface {
    function newToken() public;
    function tokenOwnerUpdate(address _prevOwner, address _newOwner) public;
    function tokenChangerUpdate(address _prevChanger, address _newChanger) public;
    function tokenTransfer(address _from, address _to, uint256 _value) public;
    function tokenApproval(address _owner, address _spender, uint256 _value) public;
    function tokenChange(address _fromToken, address _toToken, address _changer, uint256 _amount, uint256 _return) public;
}
