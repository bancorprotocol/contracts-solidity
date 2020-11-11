// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;
import "../../interfaces/ITypedConverterCustomFactory.sol";
import "../../../utility/PriceOracle.sol";

/*
    LiquidityPoolV2ConverterCustomFactory Factory
*/
contract LiquidityPoolV2ConverterCustomFactory is ITypedConverterCustomFactory {
    /**
     * @dev returns the converter type the factory is associated with
     *
     * @return converter type
     */
    function converterType() external pure override returns (uint16) {
        return 2;
    }

    /**
     * @dev creates a new price oracle
     * note that the oracles must have the same common denominator (USD, ETH etc.)
     *
     * @param  _primaryReserveToken    primary reserve token address
     * @param  _secondaryReserveToken  secondary reserve token address
     * @param  _primaryReserveOracle   primary reserve oracle address
     * @param  _secondaryReserveOracle secondary reserve oracle address
     */
    function createPriceOracle(
        IERC20Token _primaryReserveToken,
        IERC20Token _secondaryReserveToken,
        IChainlinkPriceOracle _primaryReserveOracle,
        IChainlinkPriceOracle _secondaryReserveOracle
    ) public returns (IPriceOracle) {
        return
            new PriceOracle(
                _primaryReserveToken,
                _secondaryReserveToken,
                _primaryReserveOracle,
                _secondaryReserveOracle
            );
    }
}
