pragma solidity ^0.4.18;
import './IFinancieManagedContracts.sol';
import '../interfaces/IERC20Token.sol';
import '../Owned.sol';

contract FinancieCoreComponents is Owned {

    IFinancieManagedContracts managedContracts;

    IERC20Token platformToken;
    IERC20Token etherToken;

    function FinancieCoreComponents(
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
