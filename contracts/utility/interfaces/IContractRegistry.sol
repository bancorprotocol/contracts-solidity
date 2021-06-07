// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

/**
 * @dev Contract Registry interface
 */
interface IContractRegistry {
    function addressOf(bytes32 contractName) external view returns (address);
}
