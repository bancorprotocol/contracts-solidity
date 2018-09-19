pragma solidity ^0.4.18;
import './IFinancieManagedContracts.sol';
import '../utility/Utils.sol';
import '../utility/Owned.sol';

/**
    **FROZEN**
    Financie contract management for white-listed contracts
*/
contract FinancieManagedContracts is IFinancieManagedContracts, Owned, Utils {

    // White-listed status of contracts
    mapping (address => bool) targetContracts;

    /**
    *   @dev Constructor
    */
    function FinancieManagedContracts() public {
    }

    /**
    *   @dev Check a contact is whether Financie 'Caller' or not
    *   @return true if the contact is a Financie 'Caller'
    */
    function validTargetContract(address _contract) public view returns(bool) {
        return targetContracts[_contract];
    }

    /**
    *   @dev Allow/Disallow a contact as a Financie 'Caller'
    *        For example, 'Caller' can call Financie notifier
    *   @param _contract Contract address
    *   @param _enabled True/False to allow/disallow contact as a Financie 'Caller'
    */
    function activateTargetContract(address _contract, bool _enabled)
        public
        ownerOnly
        validAddress(_contract)
    {
        targetContracts[_contract] = _enabled;
    }

}
