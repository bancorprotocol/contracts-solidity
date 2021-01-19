// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;
import "../../token/interfaces/IERC20Token.sol";

/*
    Liquidity Protection System Store interface
*/
interface ILiquidityProtectionSystemStore {
    function systemBalance(IERC20Token poolToken) external view returns (uint256);
    function incSystemBalance(IERC20Token poolToken, uint256 poolAmount) external;
    function decSystemBalance(IERC20Token poolToken, uint256 poolAmount) external;
}
