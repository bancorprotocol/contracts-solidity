// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;
import "./LiquidityPoolV2Converter.sol";
import "./interfaces/IPoolTokensContainer.sol";
import "../../interfaces/ITypedConverterFactory.sol";

/*
    LiquidityPoolV2Converter Factory
*/
contract LiquidityPoolV2ConverterFactory is ITypedConverterFactory {
    /**
      * @dev returns the converter type the factory is associated with
      *
      * @return converter type
    */
    function converterType() external override pure returns (uint16) {
        return 2;
    }

    /**
      * @dev creates a new converter with the given arguments and transfers
      * the ownership to the caller
      *
      * @param _anchor            anchor governed by the converter
      * @param _registry          address of a contract registry contract
      * @param _maxConversionFee  maximum conversion fee, represented in ppm
      *
      * @return new converter
    */
    function createConverter(IConverterAnchor _anchor, IContractRegistry _registry, uint32 _maxConversionFee) external override returns (IConverter) {
        ConverterBase converter = new LiquidityPoolV2Converter(IPoolTokensContainer(address(_anchor)), _registry, _maxConversionFee);
        converter.transferOwnership(msg.sender);
        return converter;
    }
}
