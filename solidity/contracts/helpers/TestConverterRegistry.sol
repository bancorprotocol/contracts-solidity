// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;
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
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        uint32 _maxConversionFee,
        IERC20Token[] memory _reserveTokens,
        uint32[] memory _reserveWeights
    )
    public override returns (IConverter) {
        createdConverter = super.newConverter(_type, _name, _symbol, _decimals, _maxConversionFee, _reserveTokens,
            _reserveWeights);

        return createdConverter;
    }
}
