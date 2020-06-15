pragma solidity 0.4.26;
import "../converter/LiquidityPoolV1Converter.sol";

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
