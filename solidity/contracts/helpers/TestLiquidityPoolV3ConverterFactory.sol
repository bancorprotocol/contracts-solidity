// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;
import "../converter/types/liquidity-pool-v3/LiquidityPoolV3ConverterFactory.sol";
import "./TestLiquidityPoolV3Converter.sol";

contract TestLiquidityPoolV3ConverterFactory is LiquidityPoolV3ConverterFactory {
    function createConverter(IConverterAnchor _anchor, IContractRegistry _registry, uint32 _maxConversionFee) external override returns (IConverter) {
        IConverter converter = new TestLiquidityPoolV3Converter(IDSToken(address(_anchor)), _registry, _maxConversionFee);
        converter.transferOwnership(msg.sender);
        return converter;
    }
}
