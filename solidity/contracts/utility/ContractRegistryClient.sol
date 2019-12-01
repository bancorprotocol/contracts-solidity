pragma solidity 0.4.26;
import './Owned.sol';
import './Utils.sol';
import './interfaces/IContractRegistry.sol';

/**
  * @dev Id definitions for bancor contracts
  * 
  * Can be used in conjunction with the contract registry to get contract addresses
*/
contract ContractRegistryClient is Owned, Utils {
    IContractRegistry public registry;      // contract registry
    IContractRegistry public prevRegistry;  // address of previous registry as security mechanism
    bool public allowRegistryUpdate = true; // allows the owner to prevent/allow the registry to be updated

    constructor(IContractRegistry _registry) internal validAddress(_registry) {
        registry = IContractRegistry(_registry);
        prevRegistry = IContractRegistry(_registry);
    }

    /**
      * @dev returns whether or not the caller is authorized to change the registry
     */
    function callerIsAuthorized() internal view returns (bool) {
        return msg.sender == owner;
    }

    /**
      * @dev sets the contract registry to whichever address the current registry is pointing to
     */
    function updateRegistry() public {
        // require that updating is allowed or that the caller is authorized
        require(allowRegistryUpdate || callerIsAuthorized());

        // get the address of whichever registry the current registry is pointing to
        address newRegistry = addressOf(CONTRACT_REGISTRY);

        // if the new registry hasn't changed or is the zero address, revert
        require(newRegistry != address(registry) && newRegistry != address(0));

        // set the previous registry as current registry and current registry as newRegistry
        prevRegistry = registry;
        registry = IContractRegistry(newRegistry);
    }

    /**
      * @dev security mechanism allowing the converter owner to revert to the previous registry
    */
    function restoreRegistry() public {
        // require that restoring is allowed or that the caller is authorized
        require(allowRegistryUpdate || callerIsAuthorized());

        // set the registry as previous registry
        registry = prevRegistry;

        // after a previous registry is restored, only the owner can allow future updates
        allowRegistryUpdate = false;
    }

    /**
      * @dev disables the registry update functionality
      * 
      * @param _disable    true to disable registry updates, false to re-enable them
    */
    function disableRegistryUpdate(bool _disable) public ownerOnly {
        require(callerIsAuthorized());
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

    // generic
    bytes32 internal constant CONTRACT_FEATURES = "ContractFeatures";
    bytes32 internal constant CONTRACT_REGISTRY = "ContractRegistry";
    bytes32 internal constant NON_STANDARD_TOKEN_REGISTRY = "NonStandardTokenRegistry";

    // bancor logic
    bytes32 internal constant BANCOR_NETWORK = "BancorNetwork";
    bytes32 internal constant BANCOR_FORMULA = "BancorFormula";
    bytes32 internal constant BANCOR_GAS_PRICE_LIMIT = "BancorGasPriceLimit";
    bytes32 internal constant BANCOR_CONVERTER_UPGRADER = "BancorConverterUpgrader";
    bytes32 internal constant BANCOR_CONVERTER_FACTORY = "BancorConverterFactory";

    // BNT core
    bytes32 internal constant BNT_TOKEN = "BNTToken";

    // BancorX
    bytes32 internal constant BANCOR_X = "BancorX";
    bytes32 internal constant BANCOR_X_UPGRADER = "BancorXUpgrader";
}
