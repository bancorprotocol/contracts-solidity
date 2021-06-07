// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

/**
 * @dev Converter Upgrader interface
 */
interface IConverterUpgrader {
    function upgrade(bytes32 version) external;

    function upgrade(uint16 version) external;
}
