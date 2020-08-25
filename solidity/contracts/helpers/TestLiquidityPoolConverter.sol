// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;
import "../converter/types/liquidity-pool-v1/LiquidityPoolV1Converter.sol";

contract TestLiquidityPoolConverter is LiquidityPoolV1Converter {
    constructor(
        ISmartToken _token,
        IContractRegistry _registry,
        uint32 _maxConversionFee
    )
        LiquidityPoolV1Converter(_token, _registry, _maxConversionFee)
        public
    {
    }

    function setEtherToken(IEtherToken _etherToken) public {
        etherToken = _etherToken;
    }
}
