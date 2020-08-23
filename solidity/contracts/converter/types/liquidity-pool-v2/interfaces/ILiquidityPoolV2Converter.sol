// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity >=0.6.12 <0.7.0;
import "../../../interfaces/IConverter.sol";
import "../../../../token/interfaces/IERC20Token.sol";
import "../../../../utility/interfaces/IPriceOracle.sol";

/*
    Liquidity Pool V2 Converter interface
*/
abstract contract ILiquidityPoolV2Converter is IConverter {
    function reserveStakedBalance(IERC20Token _reserveToken) public virtual view returns (uint256);
    function setReserveStakedBalance(IERC20Token _reserveToken, uint256 _balance) public virtual;

    function primaryReserveToken() public virtual view returns (IERC20Token);

    function priceOracle() public virtual view returns (IPriceOracle);

    function activate(IERC20Token _primaryReserveToken, IChainlinkPriceOracle _primaryReserveOracle, IChainlinkPriceOracle _secondaryReserveOracle) public virtual;
}
