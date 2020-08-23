// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity >=0.6.12 <0.7.0;
import "./IChainlinkPriceOracle.sol";
import "../../token/interfaces/IERC20Token.sol";

/*
    Price Oracle interface
*/
abstract contract IPriceOracle {
    function tokenAOracle() external virtual view returns (IChainlinkPriceOracle);
    function tokenBOracle() external virtual view returns (IChainlinkPriceOracle);

    function latestRate(IERC20Token _tokenA, IERC20Token _tokenB) public virtual view returns (uint256, uint256);
    function lastUpdateTime() public virtual view returns (uint256);
    function latestRateAndUpdateTime(IERC20Token _tokenA, IERC20Token _tokenB) public virtual view returns (uint256, uint256, uint256);
}
