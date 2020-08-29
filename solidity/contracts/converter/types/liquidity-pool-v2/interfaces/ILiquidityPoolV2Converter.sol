// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;
import "../../../interfaces/IConverter.sol";
import "../../../../token/interfaces/IERC20Token.sol";
import "../../../../utility/interfaces/IPriceOracle.sol";

/*
    Liquidity Pool V2 Converter interface
*/
interface ILiquidityPoolV2Converter is IConverter {
    function reserveStakedBalance(IERC20Token _reserveToken) external view returns (uint256);
    function setReserveStakedBalance(IERC20Token _reserveToken, uint256 _balance) external;

    function primaryReserveToken() external view returns (IERC20Token);

    function priceOracle() external view returns (IPriceOracle);

    function activate(IERC20Token _primaryReserveToken, IChainlinkPriceOracle _primaryReserveOracle, IChainlinkPriceOracle _secondaryReserveOracle) external;
}
