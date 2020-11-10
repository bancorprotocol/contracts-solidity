// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;
import "../converter/types/liquidity-pool-v1/LiquidityPoolV1ConverterFactory.sol";
import "./TestLiquidityPoolV1Converter.sol";

contract TestLiquidityPoolV1ConverterFactory is LiquidityPoolV1ConverterFactory {
    function createConverter(
        IConverterAnchor _anchor,
        IContractRegistry _registry,
        uint32 _maxConversionFee
    ) external override returns (IConverter) {
        IConverter converter = new TestLiquidityPoolV1Converter(
            IDSToken(address(_anchor)),
            _registry,
            _maxConversionFee
        );
        converter.transferOwnership(msg.sender);
        return converter;
    }
}
