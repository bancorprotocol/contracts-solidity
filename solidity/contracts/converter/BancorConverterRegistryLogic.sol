pragma solidity 0.4.26;
import '../utility/ContractRegistryClient.sol';
import './interfaces/IBancorConverterRegistryData.sol';
import './interfaces/IBancorConverter.sol';
import '../token/interfaces/IERC20Token.sol';
import '../token/interfaces/ISmartToken.sol';
import '../token/interfaces/ISmartTokenController.sol';

contract BancorConverterRegistryLogic is ContractRegistryClient {
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
      * @dev initialize a new BancorConverterRegistryLogic instance
      * 
      * @param _registry address of a contract registry contract
    */
    constructor(IContractRegistry _registry) ContractRegistryClient(_registry) public {
    }

    /**
      * @dev add a Bancor Converter
      * 
      * @param _bancorConverter Bancor Converter
    */
    function addBancorConverter(IBancorConverter _bancorConverter) external {
        IBancorConverterRegistryData bancorConverterRegistryData = IBancorConverterRegistryData(addressOf(BANCOR_CONVERTER_REGISTRY_DATA));
        ISmartToken token = ISmartTokenController(_bancorConverter).token();
        require(isOperative(token, _bancorConverter));
        uint connectorTokenCount = _bancorConverter.connectorTokenCount();
        if (connectorTokenCount > 1)
            addLiquidityPool(bancorConverterRegistryData, token);
        else
            addConvertibleToken(bancorConverterRegistryData, token, token);
        for (uint i = 0; i < connectorTokenCount; i++)
            addConvertibleToken(bancorConverterRegistryData, _bancorConverter.connectorTokens(i), token);
    }

    /**
      * @dev remove a Bancor Converter
      * 
      * @param _bancorConverter Bancor Converter
    */
    function removeBancorConverter(IBancorConverter _bancorConverter) external {
        IBancorConverterRegistryData bancorConverterRegistryData = IBancorConverterRegistryData(addressOf(BANCOR_CONVERTER_REGISTRY_DATA));
        ISmartToken token = ISmartTokenController(_bancorConverter).token();
        require(msg.sender == owner || !isOperative(token, _bancorConverter));
        uint connectorTokenCount = _bancorConverter.connectorTokenCount();
        if (connectorTokenCount > 1)
            removeLiquidityPool(bancorConverterRegistryData, token);
        else
            removeConvertibleToken(bancorConverterRegistryData, token, token);
        for (uint i = 0; i < connectorTokenCount; i++)
            removeConvertibleToken(bancorConverterRegistryData, _bancorConverter.connectorTokens(i), token);
    }

    /**
      * @dev check whether or not a given token is operative in a given converter
      * 
      * @param _smartToken Smart Token
      * @param _bancorConverter Bancor Converter
      * @return whether or not the given token is operative in the given converter
    */
    function isOperative(ISmartToken _smartToken, IBancorConverter _bancorConverter) internal view returns (bool) {
        return _smartToken.totalSupply() > 0 && _smartToken.owner() == address(_bancorConverter);
    }

    function addLiquidityPool(IBancorConverterRegistryData _bancorConverterRegistryData, address _liquidityPool) internal {
        _bancorConverterRegistryData.addLiquidityPool(_liquidityPool);
        emit LiquidityPoolAdded(_liquidityPool);
    }

    function removeLiquidityPool(IBancorConverterRegistryData _bancorConverterRegistryData, address _liquidityPool) internal {
        _bancorConverterRegistryData.removeLiquidityPool(_liquidityPool);
        emit LiquidityPoolRemoved(_liquidityPool);
    }

    function addConvertibleToken(IBancorConverterRegistryData _bancorConverterRegistryData, address _convertibleToken, address _smartToken) internal {
        _bancorConverterRegistryData.addConvertibleToken(_convertibleToken, _smartToken);
        emit ConvertibleTokenAdded(_convertibleToken, _smartToken);
    }

    function removeConvertibleToken(IBancorConverterRegistryData _bancorConverterRegistryData, address _convertibleToken, address _smartToken) internal {
        _bancorConverterRegistryData.removeConvertibleToken(_convertibleToken, _smartToken);
        emit ConvertibleTokenRemoved(_convertibleToken, _smartToken);
    }
}
