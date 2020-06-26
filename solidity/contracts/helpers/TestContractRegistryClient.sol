pragma solidity 0.4.26;
import "../utility/ContractRegistryClient.sol";

/*
    Utils test helper that exposes the contract registry client functions
*/
contract TestContractRegistryClient is ContractRegistryClient {

    constructor(IContractRegistry _registry) public ContractRegistryClient(_registry) {
    }
}
