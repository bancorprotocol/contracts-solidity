pragma solidity 0.4.26;
import './Owned.sol';
import './Utils.sol';
import './interfaces/IContractRegistry.sol';

/**
  * @dev Base contract for ContractRegistry clients.
*/
contract ContractRegistryClient is Owned, Utils {
    IContractRegistry public registry;      // address of the current contract-registry
    IContractRegistry public prevRegistry;  // address of the previous contract-registry
    bool public allowRegistryUpdate = true; // allow/prevent changing the contract-registry

    constructor(IContractRegistry _registry) internal validAddress(_registry) {
        registry = IContractRegistry(_registry);
        prevRegistry = IContractRegistry(_registry);
    }

    /**
      * @dev returns whether or not the caller is authorized to change the contract-registry
     */
    function callerIsAuthorized() internal view returns (bool) {
        return msg.sender == owner;
    }

    /**
      * @dev sets the contract-registry to the address of the contract-registry in the contract-registry
     */
    function updateRegistry() public {
        // verify that either updating is allowed or the caller is authorized
        require(allowRegistryUpdate || callerIsAuthorized());

        // get the address of the contract-registry in the contract-registry
        address newRegistry = addressOf(CONTRACT_REGISTRY);

        // verify that the new contract-registry is different and not zero
        require(newRegistry != address(registry) && newRegistry != address(0));

        // set the previous contract-registry as current contract-registry
        prevRegistry = registry;

        // set the current contract-registry as the new contract-registry
        registry = IContractRegistry(newRegistry);
    }

    /**
      * @dev security mechanism allowing to revert to the previous contract-registry
    */
    function restoreRegistry() public {
        // verify that either restoring is allowed or the caller is authorized
        require(allowRegistryUpdate || callerIsAuthorized());

        // set the current contract-registry as the previous contract-registry
        registry = prevRegistry;

        // ensure that only an authorized caller can perform future changes
        allowRegistryUpdate = false;
    }

    /**
      * @dev allow/prevent changing the contract-registry
      * 
      * @param _disable    true to disable changes, false to enable changes
    */
    function disableRegistryUpdate(bool _disable) public ownerOnly {
        // verify that the caller is authorized
        require(callerIsAuthorized());

        // allow/prevent changing the contract-registry
        allowRegistryUpdate = !_disable;
    }

    /**
      * @dev returns the address associated with the given contract name
      * 
      * @param _contractName    contract name
      * 
      * @return contract address
    */
    function addressOf(bytes32 _contractName) internal view returns (address) {
        return registry.addressOf(_contractName);
    }

    /**
      * @dev verifies that the caller is mapped to the given contract name
      * 
      * @param _contractName    contract name
    */
    modifier only(bytes32 _contractName) {
        require(msg.sender == addressOf(_contractName));
        _;
    }

    bytes32 internal constant CONTRACT_FEATURES = "ContractFeatures";
    bytes32 internal constant CONTRACT_REGISTRY = "ContractRegistry";
    bytes32 internal constant NON_STANDARD_TOKEN_REGISTRY = "NonStandardTokenRegistry";
    bytes32 internal constant BANCOR_NETWORK = "BancorNetwork";
    bytes32 internal constant BANCOR_FORMULA = "BancorFormula";
    bytes32 internal constant BANCOR_GAS_PRICE_LIMIT = "BancorGasPriceLimit";
    bytes32 internal constant BANCOR_CONVERTER_UPGRADER = "BancorConverterUpgrader";
    bytes32 internal constant BANCOR_CONVERTER_FACTORY = "BancorConverterFactory";
    bytes32 internal constant BNT_TOKEN = "BNTToken";
    bytes32 internal constant BANCOR_X = "BancorX";
    bytes32 internal constant BANCOR_X_UPGRADER = "BancorXUpgrader";
}
