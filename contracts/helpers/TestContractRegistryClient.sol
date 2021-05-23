// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;
import "../utility/ContractRegistryClient.sol";

/*
    Utils test helper that exposes the contract registry client functions
*/
contract TestContractRegistryClient is ContractRegistryClient {
    constructor(IContractRegistry registry) public ContractRegistryClient(registry) {}
}
