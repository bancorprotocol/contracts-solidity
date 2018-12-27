pragma solidity ^0.4.18;

/*
    Financie Standard Token interface
*/
contract IFinancieIssuerToken {

    function getIssuer() public view returns(uint32);
    function burn(uint256 _amount) public;
    function burnFrom(address _from, uint256 _amount) public;

}
