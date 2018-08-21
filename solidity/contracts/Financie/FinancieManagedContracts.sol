pragma solidity ^0.4.18;
import './IFinancieManagedContracts.sol';
import '../Utils.sol';
import '../Owned.sol';

contract FinancieManagedContracts is IFinancieManagedContracts, Owned, Utils {

    mapping (address => bool) targetContracts;

    function FinancieManagedContracts() public {
    }

    function validTargetContract(address _contract) public view returns(bool) {
        return targetContracts[_contract];
    }

    function activateTargetContract(address _contract, bool _enabled)
        public
        ownerOnly
        validAddress(_contract)
    {
        targetContracts[_contract] = _enabled;
    }

}
