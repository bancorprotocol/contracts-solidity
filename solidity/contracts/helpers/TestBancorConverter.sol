pragma solidity 0.4.26;
import '../converter/BancorConverter.sol';

contract TestBancorConverter is BancorConverter {
    constructor(
        ISmartToken _token,
        IContractRegistry _registry,
        uint32 _maxConversionFee,
        IERC20Token _reserveToken,
        uint32 _reserveRatio
    )
        BancorConverter(_token, _registry, _maxConversionFee, _reserveToken, _reserveRatio)
        public
    {
        etherToken = IEtherToken(0);
    }

    function setEtherToken(IEtherToken _etherToken) public {
        etherToken = _etherToken;
    }
}
