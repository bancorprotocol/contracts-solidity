pragma solidity 0.4.26;
import '../utility/ContractRegistryClient.sol';
import './interfaces/IBancorConverterRegistryData.sol';
import './interfaces/IBancorConverter.sol';
import '../token/interfaces/IERC20Token.sol';
import '../token/interfaces/ISmartToken.sol';
import '../token/interfaces/ISmartTokenController.sol';

contract BancorConverterRegistryLogic is ContractRegistryClient {
    /**
      * @dev emitted when a Bancor Converter is added
      * 
      * @param _bancorConverter Bancor Converter
    */
    event BancorConverterAdded(IBancorConverter indexed _bancorConverter);

    /**
      * @dev emitted when a Bancor Converter is removed
      * 
      * @param _bancorConverter Bancor Converter
    */
    event BancorConverterRemoved(IBancorConverter indexed _bancorConverter);

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
        require(_bancorConverter.registry() == registry);
        IBancorConverterRegistryData bancorConverterRegistryData = IBancorConverterRegistryData(addressOf(BANCOR_CONVERTER_REGISTRY_DATA));
        ISmartToken token = ISmartTokenController(_bancorConverter).token();
        require(isOperative(token, _bancorConverter));
        uint connectorTokenCount = _bancorConverter.connectorTokenCount();
        if (connectorTokenCount > 1)
            bancorConverterRegistryData.addLiquidityPool(token);
        for (uint i = 0; i < connectorTokenCount; i++)
            bancorConverterRegistryData.addConvertibleToken(_bancorConverter.connectorTokens(i), token);
        emit BancorConverterAdded(_bancorConverter);
    }

    /**
      * @dev remove a Bancor Converter
      * 
      * @param _bancorConverter Bancor Converter
    */
    function removeBancorConverter(IBancorConverter _bancorConverter) external {
        require(_bancorConverter.registry() == registry);
        IBancorConverterRegistryData bancorConverterRegistryData = IBancorConverterRegistryData(addressOf(BANCOR_CONVERTER_REGISTRY_DATA));
        ISmartToken token = ISmartTokenController(_bancorConverter).token();
        require(msg.sender == owner || !isOperative(token, _bancorConverter));
        uint connectorTokenCount = _bancorConverter.connectorTokenCount();
        if (connectorTokenCount > 1)
            bancorConverterRegistryData.removeLiquidityPool(token);
        for (uint i = 0; i < connectorTokenCount; i++)
            bancorConverterRegistryData.removeConvertibleToken(_bancorConverter.connectorTokens(i), token);
        emit BancorConverterRemoved(_bancorConverter);
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
}
