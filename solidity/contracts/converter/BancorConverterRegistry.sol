pragma solidity 0.4.26;
import '../utility/ContractRegistryClient.sol';
import './interfaces/IBancorConverterRegistry.sol';
import './interfaces/IBancorConverterRegistryData.sol';
import '../token/interfaces/ISmartToken.sol';
import '../token/interfaces/ISmartTokenController.sol';

/**
  * @dev The BancorConverterRegistry maintains a list of all active converters in the Bancor Network.
  *
  * Since converters can be upgraded and thus their address can change, the registry actually keeps smart tokens internally and not the converters themselves.
  * The active converter for each smart token can be easily accessed by querying the smart token owner.
  *
  * The registry exposes 3 differnet lists that can be accessed and iterated, based on the use-case of the caller:
  * - Smart tokens - can be used to get all the latest / historical data in the network
  * - Liquidity pools - can be used to get all liquidity pools for funding, liquidation etc.
  * - Convertible tokens - can be used to get all tokens that can be converted in the network (excluding pool
  *   tokens), and for each one - all smart tokens that hold it in their reserves
  *
  *
  * The contract fires events whenever one of the primitives is added to or removed from the registry
  *
  * The contract is upgradable.
*/
contract BancorConverterRegistry is IBancorConverterRegistry, ContractRegistryClient {
    /**
      * @dev triggered when a smart token is added to the registry
      * 
      * @param _smartToken smart token
    */
    event SmartTokenAdded(address indexed _smartToken);

    /**
      * @dev triggered when a smart token is removed from the registry
      * 
      * @param _smartToken smart token
    */
    event SmartTokenRemoved(address indexed _smartToken);

    /**
      * @dev triggered when a liquidity pool is added to the registry
      * 
      * @param _liquidityPool liquidity pool
    */
    event LiquidityPoolAdded(address indexed _liquidityPool);

    /**
      * @dev triggered when a liquidity pool is removed from the registry
      * 
      * @param _liquidityPool liquidity pool
    */
    event LiquidityPoolRemoved(address indexed _liquidityPool);

    /**
      * @dev triggered when a convertible token is added to the registry
      * 
      * @param _convertibleToken convertible token
      * @param _smartToken associated smart token
    */
    event ConvertibleTokenAdded(address indexed _convertibleToken, address indexed _smartToken);

    /**
      * @dev triggered when a convertible token is removed from the registry
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
      * @dev adds a converter to the registry
      * anyone can add a converter to the registry, as long as the converter is active and valid
      * note that a liquidity pool converter can be added only if no converter with the same reserve-configuration is already registered
      * 
      * @param _converter converter
    */
    function addConverter(IBancorConverter _converter) external {
        // validate input
        require(isConverterValid(_converter) && !isSimilarLiquidityPoolRegistered(_converter));

        IBancorConverterRegistryData converterRegistryData = IBancorConverterRegistryData(addressOf(BANCOR_CONVERTER_REGISTRY_DATA));
        ISmartToken token = ISmartTokenController(_converter).token();
        uint reserveTokenCount = _converter.connectorTokenCount();

        // add the smart token
        addSmartToken(converterRegistryData, token);
        if (reserveTokenCount > 1)
            addLiquidityPool(converterRegistryData, token);
        else
            addConvertibleToken(converterRegistryData, token, token);

        // add all reserve tokens
        for (uint i = 0; i < reserveTokenCount; i++)
            addConvertibleToken(converterRegistryData, _converter.connectorTokens(i), token);
    }

    /**
      * @dev removes a converter from the registry
      * anyone can remove invalid or inactive converters from the registry
      * note that the owner can also remove valid converters
      * 
      * @param _converter converter
    */
    function removeConverter(IBancorConverter _converter) external {
      // validate input
        require(msg.sender == owner || !isConverterValid(_converter));

        IBancorConverterRegistryData converterRegistryData = IBancorConverterRegistryData(addressOf(BANCOR_CONVERTER_REGISTRY_DATA));
        ISmartToken token = ISmartTokenController(_converter).token();
        uint reserveTokenCount = _converter.connectorTokenCount();

        // remove the smart token
        removeSmartToken(converterRegistryData, token);
        if (reserveTokenCount > 1)
            removeLiquidityPool(converterRegistryData, token);
        else
            removeConvertibleToken(converterRegistryData, token, token);

        // remove all reserve tokens
        for (uint i = 0; i < reserveTokenCount; i++)
            removeConvertibleToken(converterRegistryData, _converter.connectorTokens(i), token);
    }

    /**
      * @dev returns the number of smart tokens in the registry
      * 
      * @return number of smart tokens
    */
    function getSmartTokenCount() external view returns (uint) {
        return IBancorConverterRegistryData(addressOf(BANCOR_CONVERTER_REGISTRY_DATA)).getSmartTokenCount();
    }

    /**
      * @dev returns the list of smart tokens in the registry
      * 
      * @return list of smart tokens
    */
    function getSmartTokens() external view returns (address[]) {
        return IBancorConverterRegistryData(addressOf(BANCOR_CONVERTER_REGISTRY_DATA)).getSmartTokens();
    }

    /**
      * @dev returns the smart token at a given index
      * 
      * @param _index index
      * @return smart token at the given index
    */
    function getSmartToken(uint _index) external view returns (address) {
        return IBancorConverterRegistryData(addressOf(BANCOR_CONVERTER_REGISTRY_DATA)).getSmartToken(_index);
    }

    /**
      * @dev checks whether or not a given value is a smart token
      * 
      * @param _value value
      * @return true if the given value is a smart token, false if not
    */
    function isSmartToken(address _value) external view returns (bool) {
        return IBancorConverterRegistryData(addressOf(BANCOR_CONVERTER_REGISTRY_DATA)).isSmartToken(_value);
    }

    /**
      * @dev returns the number of liquidity pools in the registry
      * 
      * @return number of liquidity pools
    */
    function getLiquidityPoolCount() external view returns (uint) {
        return IBancorConverterRegistryData(addressOf(BANCOR_CONVERTER_REGISTRY_DATA)).getLiquidityPoolCount();
    }

    /**
      * @dev returns the list of liquidity pools in the registry
      * 
      * @return list of liquidity pools
    */
    function getLiquidityPools() external view returns (address[]) {
        return IBancorConverterRegistryData(addressOf(BANCOR_CONVERTER_REGISTRY_DATA)).getLiquidityPools();
    }

    /**
      * @dev returns the liquidity pool at a given index
      * 
      * @param _index index
      * @return liquidity pool at the given index
    */
    function getLiquidityPool(uint _index) external view returns (address) {
        return IBancorConverterRegistryData(addressOf(BANCOR_CONVERTER_REGISTRY_DATA)).getLiquidityPool(_index);
    }

    /**
      * @dev checks whether or not a given value is a liquidity pool
      * 
      * @param _value value
      * @return true if the given value is a liquidity pool, false if not
    */
    function isLiquidityPool(address _value) external view returns (bool) {
        return IBancorConverterRegistryData(addressOf(BANCOR_CONVERTER_REGISTRY_DATA)).isLiquidityPool(_value);
    }

    /**
      * @dev returns the number of convertible tokens in the registry
      * 
      * @return number of convertible tokens
    */
    function getConvertibleTokenCount() external view returns (uint) {
        return IBancorConverterRegistryData(addressOf(BANCOR_CONVERTER_REGISTRY_DATA)).getConvertibleTokenCount();
    }

    /**
      * @dev returns the list of convertible tokens in the registry
      * 
      * @return list of convertible tokens
    */
    function getConvertibleTokens() external view returns (address[]) {
        return IBancorConverterRegistryData(addressOf(BANCOR_CONVERTER_REGISTRY_DATA)).getConvertibleTokens();
    }

    /**
      * @dev returns the convertible token at a given index
      * 
      * @param _index index
      * @return convertible token at the given index
    */
    function getConvertibleToken(uint _index) external view returns (address) {
        return IBancorConverterRegistryData(addressOf(BANCOR_CONVERTER_REGISTRY_DATA)).getConvertibleToken(_index);
    }

    /**
      * @dev checks whether or not a given value is a convertible token
      * 
      * @param _value value
      * @return true if the given value is a convertible token, false if not
    */
    function isConvertibleToken(address _value) external view returns (bool) {
        return IBancorConverterRegistryData(addressOf(BANCOR_CONVERTER_REGISTRY_DATA)).isConvertibleToken(_value);
    }

    /**
      * @dev returns the number of smart tokens associated with a given convertible token
      * 
      * @param _convertibleToken convertible token
      * @return number of smart tokens associated with the given convertible token
    */
    function getConvertibleTokenSmartTokenCount(address _convertibleToken) external view returns (uint) {
        return IBancorConverterRegistryData(addressOf(BANCOR_CONVERTER_REGISTRY_DATA)).getConvertibleTokenSmartTokenCount(_convertibleToken);
    }

    /**
      * @dev returns the list of smart tokens associated with a given convertible token
      * 
      * @param _convertibleToken convertible token
      * @return list of smart tokens associated with the given convertible token
    */
    function getConvertibleTokenSmartTokens(address _convertibleToken) external view returns (address[]) {
        return IBancorConverterRegistryData(addressOf(BANCOR_CONVERTER_REGISTRY_DATA)).getConvertibleTokenSmartTokens(_convertibleToken);
    }

    /**
      * @dev returns the smart token associated with a given convertible token at a given index
      * 
      * @param _index index
      * @return smart token associated with the given convertible token at the given index
    */
    function getConvertibleTokenSmartToken(address _convertibleToken, uint _index) external view returns (address) {
        return IBancorConverterRegistryData(addressOf(BANCOR_CONVERTER_REGISTRY_DATA)).getConvertibleTokenSmartToken(_convertibleToken, _index);
    }

    /**
      * @dev checks whether or not a given value is a smart token of a given convertible token
      * 
      * @param _convertibleToken convertible token
      * @param _value value
      * @return true if the given value is a smart token of the given convertible token, false if not
    */
    function isConvertibleTokenSmartToken(address _convertibleToken, address _value) external view returns (bool) {
        return IBancorConverterRegistryData(addressOf(BANCOR_CONVERTER_REGISTRY_DATA)).isConvertibleTokenSmartToken(_convertibleToken, _value);
    }

    /**
      * @dev returns a list of converters for a given list of smart tokens
      * this is a utility function that can be used to reduce the number of calls to the contract
      * 
      * @param _smartTokens list of smart tokens
      * @return list of converters
    */
    function getConvertersBySmartTokens(address[] _smartTokens) external view returns (address[]) {
        address[] memory converters = new address[](_smartTokens.length);

        for (uint i = 0; i < _smartTokens.length; i++)
            converters[i] = ISmartToken(_smartTokens[i]).owner();

        return converters;
    }

    /**
      * @dev checks whether or not a given converter is valid
      * 
      * @param _converter converter
      * @return true if the given converter is valid, false if not
    */
    function isConverterValid(IBancorConverter _converter) public view returns (bool) {
        // verify the the smart token has a supply and that the converter is active
        ISmartToken token = ISmartTokenController(_converter).token();
        if (token.totalSupply() == 0 || token.owner() != address(_converter))
            return false;

        // verify that the converter holds balance in each of its reserves
        uint reserveTokenCount = _converter.connectorTokenCount();
        for (uint i = 0; i < reserveTokenCount; i++) {
            if (_converter.connectorTokens(i).balanceOf(_converter) == 0)
                return false;
        }

        return true;
    }

    /**
      * @dev searches for a liquidity pool with specific reserve tokens/ratios
      * 
      * @param _reserveTokens   reserve tokens
      * @param _reserveRatios   reserve ratios
      * @return the liquidity pool, or zero if no such liquidity pool exists
    */
    function getLiquidityPoolByReserveConfig(address[] memory _reserveTokens, uint[] memory _reserveRatios) public view returns (ISmartToken) {
        // verify that the input parameters represent a valid liquidity pool
        if (_reserveTokens.length == _reserveRatios.length && _reserveTokens.length > 1) {
            // get the smart tokens of the least frequent token (optimization)
            address[] memory convertibleTokenSmartTokens = getLeastFrequentTokenSmartTokens(_reserveTokens);
            // search for a converter with an identical reserve-configuration
            for (uint i = 0; i < convertibleTokenSmartTokens.length; i++) {
                ISmartToken smartToken = ISmartToken(convertibleTokenSmartTokens[i]);
                IBancorConverter converter = IBancorConverter(smartToken.owner());
                if (isConverterReserveConfigEqual(converter, _reserveTokens, _reserveRatios))
                    return smartToken;
            }
        }

        return ISmartToken(0);
    }

    /**
      * @dev checks if a liquidity pool with given reserve tokens/ratios is already registered
      * 
      * @param _converter converter with specific reserve tokens/ratios
      * @return if a liquidity pool with the same reserve tokens/ratios is already registered
    */
    function isSimilarLiquidityPoolRegistered(IBancorConverter _converter) internal view returns (bool) {
        uint reserveTokenCount = _converter.connectorTokenCount();
        address[] memory reserveTokens = new address[](reserveTokenCount);
        uint[] memory reserveRatios = new uint[](reserveTokenCount);

        // get the reserve-configuration of the converter
        for (uint i = 0; i < reserveTokenCount; i++) {
            IERC20Token reserveToken = _converter.connectorTokens(i);
            reserveTokens[i] = reserveToken;
            reserveRatios[i] = getReserveRatio(_converter, reserveToken);
        }

        // return if a liquidity pool with the same reserve tokens/ratios is already registered
        return getLiquidityPoolByReserveConfig(reserveTokens, reserveRatios) != ISmartToken(0);
    }

    /**
      * @dev adds a smart token to the registry
      * 
      * @param _smartToken smart token
    */
    function addSmartToken(IBancorConverterRegistryData _converterRegistryData, address _smartToken) internal {
        _converterRegistryData.addSmartToken(_smartToken);
        emit SmartTokenAdded(_smartToken);
    }

    /**
      * @dev removes a smart token from the registry
      * 
      * @param _smartToken smart token
    */
    function removeSmartToken(IBancorConverterRegistryData _converterRegistryData, address _smartToken) internal {
        _converterRegistryData.removeSmartToken(_smartToken);
        emit SmartTokenRemoved(_smartToken);
    }

    /**
      * @dev adds a liquidity pool to the registry
      * 
      * @param _liquidityPool liquidity pool
    */
    function addLiquidityPool(IBancorConverterRegistryData _converterRegistryData, address _liquidityPool) internal {
        _converterRegistryData.addLiquidityPool(_liquidityPool);
        emit LiquidityPoolAdded(_liquidityPool);
    }

    /**
      * @dev removes a liquidity pool from the registry
      * 
      * @param _liquidityPool liquidity pool
    */
    function removeLiquidityPool(IBancorConverterRegistryData _converterRegistryData, address _liquidityPool) internal {
        _converterRegistryData.removeLiquidityPool(_liquidityPool);
        emit LiquidityPoolRemoved(_liquidityPool);
    }

    /**
      * @dev adds a convertible token to the registry
      * 
      * @param _convertibleToken convertible token
      * @param _smartToken associated smart token
    */
    function addConvertibleToken(IBancorConverterRegistryData _converterRegistryData, address _convertibleToken, address _smartToken) internal {
        _converterRegistryData.addConvertibleToken(_convertibleToken, _smartToken);
        emit ConvertibleTokenAdded(_convertibleToken, _smartToken);
    }

    /**
      * @dev removes a convertible token from the registry
      * 
      * @param _convertibleToken convertible token
      * @param _smartToken associated smart token
    */
    function removeConvertibleToken(IBancorConverterRegistryData _converterRegistryData, address _convertibleToken, address _smartToken) internal {
        _converterRegistryData.removeConvertibleToken(_convertibleToken, _smartToken);
        emit ConvertibleTokenRemoved(_convertibleToken, _smartToken);
    }

    function getLeastFrequentTokenSmartTokens(address[] memory _tokens) private view returns (address[] memory) {
        IBancorConverterRegistryData bancorConverterRegistryData = IBancorConverterRegistryData(addressOf(BANCOR_CONVERTER_REGISTRY_DATA));

        // find the token that has the smallest number of smart tokens
        uint minSmartTokenCount = bancorConverterRegistryData.getConvertibleTokenSmartTokenCount(_tokens[0]);
        address[] memory smartTokens = bancorConverterRegistryData.getConvertibleTokenSmartTokens(_tokens[0]);
        for (uint i = 1; i < _tokens.length; i++) {
            uint convertibleTokenSmartTokenCount = bancorConverterRegistryData.getConvertibleTokenSmartTokenCount(_tokens[i]);
            if (minSmartTokenCount > convertibleTokenSmartTokenCount) {
                minSmartTokenCount = convertibleTokenSmartTokenCount;
                smartTokens = bancorConverterRegistryData.getConvertibleTokenSmartTokens(_tokens[i]);
            }
        }
        return smartTokens;
    }

    function isConverterReserveConfigEqual(IBancorConverter _converter, address[] memory _reserveTokens, uint[] memory _reserveRatios) private view returns (bool) {
        if (_reserveTokens.length != _converter.connectorTokenCount())
            return false;

        for (uint i = 0; i < _reserveTokens.length; i++) {
            if (_reserveRatios[i] != getReserveRatio(_converter, _reserveTokens[i]))
                return false;
        }

        return true;
    }

    bytes4 private constant CONNECTORS_FUNC_SELECTOR = bytes4(uint256(keccak256("connectors(address)") >> (256 - 4 * 8)));

    function getReserveRatio(address _converter, address _reserveToken) private view returns (uint256) {
        uint256[2] memory ret;
        bytes memory data = abi.encodeWithSelector(CONNECTORS_FUNC_SELECTOR, _reserveToken);

        assembly {
            let success := staticcall(
                gas,           // gas remaining
                _converter,    // destination address
                add(data, 32), // input buffer (starts after the first 32 bytes in the `data` array)
                mload(data),   // input length (loaded from the first 32 bytes in the `data` array)
                ret,           // output buffer
                64             // output length
            )
            if iszero(success) {
                revert(0, 0)
            }
        }

        return ret[1];
    }
}
