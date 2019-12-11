pragma solidity 0.4.26;
import '../utility/ContractRegistryClient.sol';
import './interfaces/IBancorConverterRegistry.sol';
import './interfaces/IBancorConverterRegistryData.sol';
import '../token/interfaces/ISmartToken.sol';
import '../token/interfaces/ISmartTokenController.sol';

contract BancorConverterRegistry is IBancorConverterRegistry, ContractRegistryClient {
    /**
      * @dev emitted when a smart token is added
      * 
      * @param _smartToken smart token
    */
    event SmartTokenAdded(address indexed _smartToken);

    /**
      * @dev emitted when a smart token is removed
      * 
      * @param _smartToken smart token
    */
    event SmartTokenRemoved(address indexed _smartToken);

    /**
      * @dev emitted when a liquidity pool is added
      * 
      * @param _liquidityPool liquidity pool
    */
    event LiquidityPoolAdded(address indexed _liquidityPool);

    /**
      * @dev emitted when a liquidity pool is removed
      * 
      * @param _liquidityPool liquidity pool
    */
    event LiquidityPoolRemoved(address indexed _liquidityPool);

    /**
      * @dev emitted when a convertible token is added
      * 
      * @param _convertibleToken convertible token
      * @param _smartToken associated smart token
    */
    event ConvertibleTokenAdded(address indexed _convertibleToken, address indexed _smartToken);

    /**
      * @dev emitted when a convertible token is removed
      * 
      * @param _convertibleToken convertible token
      * @param _smartToken associated smart token
    */
    event ConvertibleTokenRemoved(address indexed _convertibleToken, address indexed _smartToken);

    /**
      * @dev initializes a new BancorConverterRegistry instance
      * 
      * @param _registry address of a contract registry contract
    */
    constructor(IContractRegistry _registry) ContractRegistryClient(_registry) public {
    }

    /**
      * @dev adds a converter
      * 
      * @param _converter converter
    */
    function addConverter(IBancorConverter _converter) external {
        IBancorConverterRegistryData converterRegistryData = IBancorConverterRegistryData(addressOf(BANCOR_CONVERTER_REGISTRY_DATA));
        ISmartToken token = ISmartTokenController(_converter).token();
        require(isValid(token, _converter));
        uint connectorTokenCount = _converter.connectorTokenCount();
        addSmartToken(converterRegistryData, token);
        if (connectorTokenCount > 1)
            addLiquidityPool(converterRegistryData, token);
        else
            addConvertibleToken(converterRegistryData, token, token);
        for (uint i = 0; i < connectorTokenCount; i++)
            addConvertibleToken(converterRegistryData, _converter.connectorTokens(i), token);
    }

    /**
      * @dev removes a converter
      * 
      * @param _converter converter
    */
    function removeConverter(IBancorConverter _converter) external {
        IBancorConverterRegistryData converterRegistryData = IBancorConverterRegistryData(addressOf(BANCOR_CONVERTER_REGISTRY_DATA));
        ISmartToken token = ISmartTokenController(_converter).token();
        require(msg.sender == owner || !isValid(token, _converter));
        uint connectorTokenCount = _converter.connectorTokenCount();
        removeSmartToken(converterRegistryData, token);
        if (connectorTokenCount > 1)
            removeLiquidityPool(converterRegistryData, token);
        else
            removeConvertibleToken(converterRegistryData, token, token);
        for (uint i = 0; i < connectorTokenCount; i++)
            removeConvertibleToken(converterRegistryData, _converter.connectorTokens(i), token);
    }

    /**
      * @dev gets the number of smart tokens
      * 
      * @return the number of smart tokens
    */
    function getSmartTokenCount() external view returns (uint) {
        return IBancorConverterRegistryData(addressOf(BANCOR_CONVERTER_REGISTRY_DATA)).getSmartTokenCount();
    }

    /**
      * @dev gets the list of smart tokens
      * 
      * @return the list of smart tokens
    */
    function getSmartTokens() external view returns (address[]) {
        return IBancorConverterRegistryData(addressOf(BANCOR_CONVERTER_REGISTRY_DATA)).getSmartTokens();
    }

    /**
      * @dev gets the smart token at a given index
      * 
      * @param _index index
      * @return the smart token at the given index
    */
    function getSmartToken(uint _index) external view returns (address) {
        return IBancorConverterRegistryData(addressOf(BANCOR_CONVERTER_REGISTRY_DATA)).getSmartToken(_index);
    }

    /**
      * @dev checks whether or not a given value is a smart token
      * 
      * @param _value value
      * @return whether or not the given value is a smart token
    */
    function isSmartToken(address _value) external view returns (bool) {
        return IBancorConverterRegistryData(addressOf(BANCOR_CONVERTER_REGISTRY_DATA)).isSmartToken(_value);
    }

    /**
      * @dev gets the number of liquidity pools
      * 
      * @return the number of liquidity pools
    */
    function getLiquidityPoolCount() external view returns (uint) {
        return IBancorConverterRegistryData(addressOf(BANCOR_CONVERTER_REGISTRY_DATA)).getLiquidityPoolCount();
    }

    /**
      * @dev gets the list of liquidity pools
      * 
      * @return the list of liquidity pools
    */
    function getLiquidityPools() external view returns (address[]) {
        return IBancorConverterRegistryData(addressOf(BANCOR_CONVERTER_REGISTRY_DATA)).getLiquidityPools();
    }

    /**
      * @dev gets the liquidity pool at a given index
      * 
      * @param _index index
      * @return the liquidity pool at the given index
    */
    function getLiquidityPool(uint _index) external view returns (address) {
        return IBancorConverterRegistryData(addressOf(BANCOR_CONVERTER_REGISTRY_DATA)).getLiquidityPool(_index);
    }

    /**
      * @dev checks whether or not a given value is a liquidity pool
      * 
      * @param _value value
      * @return whether or not the given value is a liquidity pool
    */
    function isLiquidityPool(address _value) external view returns (bool) {
        return IBancorConverterRegistryData(addressOf(BANCOR_CONVERTER_REGISTRY_DATA)).isLiquidityPool(_value);
    }

    /**
      * @dev gets the number of convertible tokens
      * 
      * @return the number of convertible tokens
    */
    function getConvertibleTokenCount() external view returns (uint) {
        return IBancorConverterRegistryData(addressOf(BANCOR_CONVERTER_REGISTRY_DATA)).getConvertibleTokenCount();
    }

    /**
      * @dev gets the list of convertible tokens
      * 
      * @return the list of convertible tokens
    */
    function getConvertibleTokens() external view returns (address[]) {
        return IBancorConverterRegistryData(addressOf(BANCOR_CONVERTER_REGISTRY_DATA)).getConvertibleTokens();
    }

    /**
      * @dev gets the convertible token at a given index
      * 
      * @param _index index
      * @return the convertible token at the given index
    */
    function getConvertibleToken(uint _index) external view returns (address) {
        return IBancorConverterRegistryData(addressOf(BANCOR_CONVERTER_REGISTRY_DATA)).getConvertibleToken(_index);
    }

    /**
      * @dev checks whether or not a given value is a convertible token
      * 
      * @param _value value
      * @return whether or not the given value is a convertible token
    */
    function isConvertibleToken(address _value) external view returns (bool) {
        return IBancorConverterRegistryData(addressOf(BANCOR_CONVERTER_REGISTRY_DATA)).isConvertibleToken(_value);
    }

    /**
      * @dev gets the number of smart tokens associated with a given convertible token
      * 
      * @param _convertibleToken convertible token
      * @return the number of smart tokens associated with the given convertible token
    */
    function getConvertibleTokenSmartTokenCount(address _convertibleToken) external view returns (uint) {
        return IBancorConverterRegistryData(addressOf(BANCOR_CONVERTER_REGISTRY_DATA)).getConvertibleTokenSmartTokenCount(_convertibleToken);
    }

    /**
      * @dev gets the list of smart tokens associated with a given convertible token
      * 
      * @param _convertibleToken convertible token
      * @return the list of smart tokens associated with the given convertible token
    */
    function getConvertibleTokenSmartTokens(address _convertibleToken) external view returns (address[]) {
        return IBancorConverterRegistryData(addressOf(BANCOR_CONVERTER_REGISTRY_DATA)).getConvertibleTokenSmartTokens(_convertibleToken);
    }

    /**
      * @dev gets the smart token associated with a given convertible token at a given index
      * 
      * @param _index index
      * @return the smart token associated with the given convertible token at the given index
    */
    function getConvertibleTokenSmartToken(address _convertibleToken, uint _index) external view returns (address) {
        return IBancorConverterRegistryData(addressOf(BANCOR_CONVERTER_REGISTRY_DATA)).getConvertibleTokenSmartToken(_convertibleToken, _index);
    }

    /**
      * @dev checks whether or not a given value is a smart token of a given convertible token
      * 
      * @param _convertibleToken convertible token
      * @param _value value
      * @return whether or not the given value is a smart token of the given convertible token
    */
    function isConvertibleTokenSmartToken(address _convertibleToken, address _value) external view returns (bool) {
        return IBancorConverterRegistryData(addressOf(BANCOR_CONVERTER_REGISTRY_DATA)).isConvertibleTokenSmartToken(_convertibleToken, _value);
    }

    /**
      * @dev checks whether or not a given token is operative in a given converter
      * 
      * @param _smartToken smart token
      * @param _converter converter
      * @return whether or not the given token is operative in the given converter
    */
    function isValid(ISmartToken _smartToken, IBancorConverter _converter) public view returns (bool) {
        return _smartToken.totalSupply() > 0 && _smartToken.owner() == address(_converter);
    }

    /**
      * @dev adds a smart token
      * 
      * @param _smartToken smart token
    */
    function addSmartToken(IBancorConverterRegistryData _converterRegistryData, address _smartToken) internal {
        _converterRegistryData.addSmartToken(_smartToken);
        emit SmartTokenAdded(_smartToken);
    }

    /**
      * @dev removes a smart token
      * 
      * @param _smartToken smart token
    */
    function removeSmartToken(IBancorConverterRegistryData _converterRegistryData, address _smartToken) internal {
        _converterRegistryData.removeSmartToken(_smartToken);
        emit SmartTokenRemoved(_smartToken);
    }

    /**
      * @dev adds a liquidity pool
      * 
      * @param _liquidityPool liquidity pool
    */
    function addLiquidityPool(IBancorConverterRegistryData _converterRegistryData, address _liquidityPool) internal {
        _converterRegistryData.addLiquidityPool(_liquidityPool);
        emit LiquidityPoolAdded(_liquidityPool);
    }

    /**
      * @dev removes a liquidity pool
      * 
      * @param _liquidityPool liquidity pool
    */
    function removeLiquidityPool(IBancorConverterRegistryData _converterRegistryData, address _liquidityPool) internal {
        _converterRegistryData.removeLiquidityPool(_liquidityPool);
        emit LiquidityPoolRemoved(_liquidityPool);
    }

    /**
      * @dev adds a convertible token
      * 
      * @param _convertibleToken convertible token
      * @param _smartToken associated smart token
    */
    function addConvertibleToken(IBancorConverterRegistryData _converterRegistryData, address _convertibleToken, address _smartToken) internal {
        _converterRegistryData.addConvertibleToken(_convertibleToken, _smartToken);
        emit ConvertibleTokenAdded(_convertibleToken, _smartToken);
    }

    /**
      * @dev removes a convertible token
      * 
      * @param _convertibleToken convertible token
      * @param _smartToken associated smart token
    */
    function removeConvertibleToken(IBancorConverterRegistryData _converterRegistryData, address _convertibleToken, address _smartToken) internal {
        _converterRegistryData.removeConvertibleToken(_convertibleToken, _smartToken);
        emit ConvertibleTokenRemoved(_convertibleToken, _smartToken);
    }
}
