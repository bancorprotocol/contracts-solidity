pragma solidity 0.4.26;
import "../converter/ConverterRegistry.sol";

/*
    Utils test helper that exposes the converter registry functions
*/
contract TestConverterRegistry is ConverterRegistry {
    IConverter public createdConverter;

    constructor(IContractRegistry _registry) public ConverterRegistry(_registry) {
    }

    function newConverter(
        uint16 _type,
        string _name,
        string _symbol,
        uint8 _decimals,
        uint32 _maxConversionFee,
        IERC20Token[] memory _reserveTokens,
        uint32[] memory _reserveWeights
    )
    public returns (IConverter) {
        createdConverter = super.newConverter(_type, _name, _symbol, _decimals, _maxConversionFee, _reserveTokens,
            _reserveWeights);

        return createdConverter;
    }
}
