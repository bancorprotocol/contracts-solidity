// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;
import "./IChainlinkPriceOracle.sol";
import "../../token/interfaces/IERC20Token.sol";

/*
    Price Oracle interface
*/
interface IPriceOracle {
    function tokenAOracle() external view returns (IChainlinkPriceOracle);
    function tokenBOracle() external view returns (IChainlinkPriceOracle);

    function latestRate(IERC20Token _tokenA, IERC20Token _tokenB) external view returns (uint256, uint256);
    function lastUpdateTime() external view returns (uint256);
    function latestRateAndUpdateTime(IERC20Token _tokenA, IERC20Token _tokenB) external view returns (uint256, uint256, uint256);
}
