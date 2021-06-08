// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "../utility/ContractRegistryClient.sol";

contract TestContractRegistryClient is ContractRegistryClient {
    constructor(IContractRegistry registry) public ContractRegistryClient(registry) {}
}
