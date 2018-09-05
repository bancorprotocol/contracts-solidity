pragma solidity ^0.4.18;

/*
    **FROZEN**
    Financie Managed Contracts contract interface
*/
contract IFinancieManagedContracts {
    function validTargetContract(address _contract) public view returns(bool);
    function activateTargetContract(address _contract, bool _enabled) public;
}
