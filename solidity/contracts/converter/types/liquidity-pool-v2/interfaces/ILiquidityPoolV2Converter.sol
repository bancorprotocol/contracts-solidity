// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity >=0.6.12 <0.7.0;
import "../../../../token/interfaces/IERC20Token.sol";
import "../../../../utility/interfaces/IPriceOracle.sol";

/*
    Liquidity Pool V2 Converter interface
*/
contract ILiquidityPoolV2Converter {
    function reserveStakedBalance(IERC20Token _reserveToken) public view returns (uint256);
    function setReserveStakedBalance(IERC20Token _reserveToken, uint256 _balance) public;

    function primaryReserveToken() public view returns (IERC20Token);

    function priceOracle() public view returns (IPriceOracle);

    function activate(IERC20Token _primaryReserveToken, IChainlinkPriceOracle _primaryReserveOracle, IChainlinkPriceOracle _secondaryReserveOracle) public;
}
