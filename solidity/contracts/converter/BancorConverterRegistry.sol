pragma solidity 0.4.26;
import '../utility/TokenHandler.sol';
import '../utility/ContractRegistryClient.sol';
import './interfaces/IBancorConverterFactory.sol';
import './interfaces/IBancorConverterRegistry.sol';
import './interfaces/IBancorConverterRegistryData.sol';
import '../token/interfaces/ISmartTokenController.sol';
import '../token/SmartToken.sol';

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
contract BancorConverterRegistry is IBancorConverterRegistry, ContractRegistryClient, TokenHandler {
    address private constant ETH_RESERVE_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

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
      * @dev creates a liquid-token converter and adds it to the registry
      * 
      * @param _type                converter type, see BancorConverter contract main doc
      * @param _smartTokenName      token name
      * @param _smartTokenSymbol    token symbol
      * @param _smartTokenDecimals  token decimals
      * @param _maxConversionFee    maximum conversion-fee
      * @param _reserveToken        reserve token
      * @param _reserveWeight       reserve weight
      * @param _reserveAmount       reserve amount
    */
    function newLiquidToken(
        uint8 _type,
        string _smartTokenName,
        string _smartTokenSymbol,
        uint8 _smartTokenDecimals,
        uint32 _maxConversionFee,
        IERC20Token _reserveToken,
        uint32 _reserveWeight,
        uint256 _reserveAmount
    )
    public payable
    {
        IBancorConverterFactory factory = IBancorConverterFactory(addressOf(BANCOR_CONVERTER_FACTORY));
        SmartToken token = new SmartToken(_smartTokenName, _smartTokenSymbol, _smartTokenDecimals);
        IBancorConverter converter = IBancorConverter(factory.createConverter(_type, token, registry, _maxConversionFee));

        converter.acceptOwnership();

        if (_reserveToken == IERC20Token(ETH_RESERVE_ADDRESS)) {
            require(msg.value == _reserveAmount);
            converter.addReserve(_reserveToken, _reserveWeight);
            address(converter).transfer(_reserveAmount);
        }
        else {
            require(msg.value == 0);
            converter.addReserve(_reserveToken, _reserveWeight);
            safeTransferFrom(_reserveToken, msg.sender, converter, _reserveAmount);
        }

        token.issue(msg.sender, _reserveAmount);
        token.transferOwnership(converter);
        converter.acceptTokenOwnership();
        converter.transferOwnership(msg.sender);

        addConverterInternal(converter);
    }

    /**
      * @dev creates a liquidity-pool converter and adds it to the registry
      * 
      * @param _type                converter type, see BancorConverter contract main doc
      * @param _smartTokenName      token name
      * @param _smartTokenSymbol    token symbol
      * @param _smartTokenDecimals  token decimals
      * @param _maxConversionFee    maximum conversion-fee
      * @param _reserveTokens       reserve tokens
      * @param _reserveWeights      reserve weights
      * @param _reserveAmounts      reserve amounts
    */
    function newLiquidityPool(
        uint8 _type,
        string _smartTokenName,
        string _smartTokenSymbol,
        uint8 _smartTokenDecimals,
        uint32 _maxConversionFee,
        IERC20Token[] memory _reserveTokens,
        uint32[] memory _reserveWeights,
        uint256[] memory _reserveAmounts
    )
    public payable
    {
        uint256 length = _reserveTokens.length;
        require(length == _reserveWeights.length);
        require(length == _reserveAmounts.length);
        require(length > 1);
        require(getLiquidityPoolByReserveConfig(_reserveTokens, _reserveWeights) == ISmartToken(0));

        IBancorConverterFactory factory = IBancorConverterFactory(addressOf(BANCOR_CONVERTER_FACTORY));
        SmartToken token = new SmartToken(_smartTokenName, _smartTokenSymbol, _smartTokenDecimals);
        IBancorConverter converter = IBancorConverter(factory.createConverter(_type, token, registry, _maxConversionFee));

        converter.acceptOwnership();

        for (uint256 i = 0; i < length; i++) {
            if (_reserveTokens[i] == IERC20Token(ETH_RESERVE_ADDRESS)) {
                converter.addReserve(_reserveTokens[i], _reserveWeights[i]);
            }
            else {
                converter.addReserve(_reserveTokens[i], _reserveWeights[i]);
                safeTransferFrom(_reserveTokens[i], msg.sender, this, _reserveAmounts[i]);
                safeApprove(_reserveTokens[i], converter, _reserveAmounts[i]);
            }
        }

        token.transferOwnership(converter);
        converter.acceptTokenOwnership();
        converter.addLiquidity.value(msg.value)(_reserveTokens, _reserveAmounts, 1);
        converter.transferOwnership(msg.sender);
        token.transfer(msg.sender, token.totalSupply());

        addConverterInternal(converter);
    }

    /**
      * @dev adds an existing converter to the registry
      * can only be called by the owner
      * 
      * @param _converter converter
    */
    function addConverter(IBancorConverter _converter) public ownerOnly {
        require(isConverterValid(_converter));
        addConverterInternal(_converter);
    }

    /**
      * @dev removes a converter from the registry
      * anyone can remove an existing converter from the registry, as long as the converter is invalid
      * note that the owner can also remove valid converters
      * 
      * @param _converter converter
    */
    function removeConverter(IBancorConverter _converter) public {
        require(msg.sender == owner || !isConverterValid(_converter));
        removeConverterInternal(_converter);
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
        if (token.owner() != address(_converter))
            return false;

        return true;
    }

    /**
      * @dev checks if a liquidity pool with given reserve tokens/weights is already registered
      * 
      * @param _converter converter with specific reserve tokens/weights
      * @return if a liquidity pool with the same reserve tokens/weights is already registered
    */
    function isSimilarLiquidityPoolRegistered(IBancorConverter _converter) public view returns (bool) {
        uint reserveTokenCount = _converter.connectorTokenCount();
        IERC20Token[] memory reserveTokens = new IERC20Token[](reserveTokenCount);
        uint32[] memory reserveWeights = new uint32[](reserveTokenCount);

        // get the reserve-configuration of the converter
        for (uint i = 0; i < reserveTokenCount; i++) {
            IERC20Token reserveToken = _converter.connectorTokens(i);
            reserveTokens[i] = reserveToken;
            reserveWeights[i] = getReserveWeight(_converter, reserveToken);
        }

        // return if a liquidity pool with the same reserve tokens/weights is already registered
        return getLiquidityPoolByReserveConfig(reserveTokens, reserveWeights) != ISmartToken(0);
    }

    /**
      * @dev searches for a liquidity pool with specific reserve tokens/weights
      * 
      * @param _reserveTokens   reserve tokens
      * @param _reserveWeights  reserve weights
      * @return the liquidity pool, or zero if no such liquidity pool exists
    */
    function getLiquidityPoolByReserveConfig(IERC20Token[] memory _reserveTokens, uint32[] memory _reserveWeights) public view returns (ISmartToken) {
        // verify that the input parameters represent a valid liquidity pool
        if (_reserveTokens.length == _reserveWeights.length && _reserveTokens.length > 1) {
            // get the smart tokens of the least frequent token (optimization)
            address[] memory convertibleTokenSmartTokens = getLeastFrequentTokenSmartTokens(_reserveTokens);
            // search for a converter with an identical reserve-configuration
            for (uint i = 0; i < convertibleTokenSmartTokens.length; i++) {
                ISmartToken smartToken = ISmartToken(convertibleTokenSmartTokens[i]);
                IBancorConverter converter = IBancorConverter(smartToken.owner());
                if (isConverterReserveConfigEqual(converter, _reserveTokens, _reserveWeights))
                    return smartToken;
            }
        }

        return ISmartToken(0);
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

    function addConverterInternal(IBancorConverter _converter) private {
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

    function removeConverterInternal(IBancorConverter _converter) private {
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

    function getLeastFrequentTokenSmartTokens(IERC20Token[] memory _reserveTokens) private view returns (address[] memory) {
        IBancorConverterRegistryData bancorConverterRegistryData = IBancorConverterRegistryData(addressOf(BANCOR_CONVERTER_REGISTRY_DATA));
        uint minSmartTokenCount = bancorConverterRegistryData.getConvertibleTokenSmartTokenCount(_reserveTokens[0]);
        uint index = 0;

        // find the reserve token which has the smallest number of smart tokens
        for (uint i = 1; i < _reserveTokens.length; i++) {
            uint convertibleTokenSmartTokenCount = bancorConverterRegistryData.getConvertibleTokenSmartTokenCount(_reserveTokens[i]);
            if (minSmartTokenCount > convertibleTokenSmartTokenCount) {
                minSmartTokenCount = convertibleTokenSmartTokenCount;
                index = i;
            }
        }

        return bancorConverterRegistryData.getConvertibleTokenSmartTokens(_reserveTokens[index]);
    }

    function isConverterReserveConfigEqual(IBancorConverter _converter, IERC20Token[] memory _reserveTokens, uint32[] memory _reserveWeights) private view returns (bool) {
        if (_reserveTokens.length != _converter.connectorTokenCount())
            return false;

        for (uint i = 0; i < _reserveTokens.length; i++) {
            if (_reserveWeights[i] != getReserveWeight(_converter, _reserveTokens[i]))
                return false;
        }

        return true;
    }

    bytes4 private constant CONNECTORS_FUNC_SELECTOR = bytes4(keccak256("connectors(address)"));

    function getReserveWeight(address _converter, address _reserveToken) private view returns (uint32) {
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

        return uint32(ret[1]);
    }
}
