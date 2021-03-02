// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

interface INetworkSettings {
    function feeParams() external view returns (address, uint32);
}
