// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

/**
 * @dev Bancor X Upgrader interface
 */
interface IBancorXUpgrader {
    function upgrade(uint16 version, address[] memory reporters) external;
}
