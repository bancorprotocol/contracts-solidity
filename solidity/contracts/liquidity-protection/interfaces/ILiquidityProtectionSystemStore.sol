// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;
import "../../token/interfaces/IERC20Token.sol";

/*
    Liquidity Protection System Store interface
*/
interface ILiquidityProtectionSystemStore {
    function systemBalance(IERC20Token _poolToken) external view returns (uint256);
    function incSystemBalance(IERC20Token _poolToken, uint256 _poolAmount) external;
    function decSystemBalance(IERC20Token _poolToken, uint256 _poolAmount) external;
}
