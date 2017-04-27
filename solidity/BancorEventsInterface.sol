pragma solidity ^0.4.10;

/*
    Bancor events interface
*/
contract BancorEventsInterface {
    event NewToken(address _token);
    event TokenOwnerUpdate(address indexed _token, address _prevOwner, address _newOwner);
    event TokenChangerUpdate(address indexed _token, address _prevChanger, address _newChanger);
    event TokenSupplyUpdate(address indexed _token, uint256 _totalSupply);
    event TokenTransfer(address indexed _token, address indexed _from, address indexed _to, uint256 _value);
    event TokenApproval(address indexed _token, address indexed _owner, address indexed _spender, uint256 _value);
    event TokenChange(address indexed _sender, address indexed _fromToken, address indexed _toToken, address _changer, uint256 _amount, uint256 _return);

    function newToken() public;
    function tokenOwnerUpdate(address _prevOwner, address _newOwner) public;
    function tokenChangerUpdate(address _prevChanger, address _newChanger) public;
    function tokenSupplyUpdate(uint256 _totalSupply) public;
    function tokenTransfer(address _from, address _to, uint256 _value) public;
    function tokenApproval(address _owner, address _spender, uint256 _value) public;
    function tokenChange(address _fromToken, address _toToken, address _changer, uint256 _amount, uint256 _return) public;
}
