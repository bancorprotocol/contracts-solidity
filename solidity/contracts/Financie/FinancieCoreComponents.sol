pragma solidity ^0.4.18;
import './IFinancieManagedContracts.sol';
import '../token/interfaces/IERC20Token.sol';
import '../utility/Owned.sol';

contract FinancieCoreComponents is Owned {

    IFinancieManagedContracts public managedContracts;

    IERC20Token public platformToken;
    IERC20Token public etherToken;

    constructor(
        address _managedContracts,
        address _platformToken,
        address _etherToken
    ) public {
        managedContracts = IFinancieManagedContracts(_managedContracts);
        platformToken = IERC20Token(_platformToken);
        etherToken = IERC20Token(_etherToken);
    }

    modifier validTargetContract(address _contract) {
        require(managedContracts.validTargetContract(_contract));
        _;
    }

}
