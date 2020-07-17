pragma solidity 0.4.26;
import "./IChainlinkPriceOracle.sol";
import "../../token/interfaces/IERC20Token.sol";

/*
    Price Oracle interface
*/
contract IPriceOracle {
    function latestRate(IERC20Token _tokenA, IERC20Token _tokenB) public view returns (uint256, uint256);
    function lastUpdateTime() public view returns (uint256);
    function latestRateAndUpdateTime(IERC20Token _tokenA, IERC20Token _tokenB) public view returns (uint256, uint256, uint256);

    function tokenAOracle() public view returns (IChainlinkPriceOracle) {this;}
    function tokenBOracle() public view returns (IChainlinkPriceOracle) {this;}
}
