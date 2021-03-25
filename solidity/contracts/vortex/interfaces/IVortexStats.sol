// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../../utility/interfaces/IOwned.sol";

/*
    VortexStats Protection interface
*/
interface IVortexStats is IOwned {
    function totalBurnedAmount() external view returns (uint256);

    function incTotalBurnedAmount(uint256 amount) external;

    function lastVortexTime() external view returns (uint256);

    function setLastVortexTime(uint256 time) external;
}
