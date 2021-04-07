// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "../utility/ContractRegistryClient.sol";

import "../token/interfaces/IDSToken.sol";

import "./interfaces/IConverter.sol";
import "./interfaces/IConverterFactory.sol";
import "./interfaces/IConverterRegistry.sol";
import "./interfaces/IConverterRegistryData.sol";

/**
 * @dev This contract maintains a list of all active converters in the Bancor Network.
 *
 * Since converters can be upgraded and thus their address can change, the registry actually keeps
 * converter anchors internally and not the converters themselves.
 * The active converter for each anchor can be easily accessed by querying the anchor's owner.
 *
 * The registry exposes 3 different lists that can be accessed and iterated, based on the use-case of the caller:
 * - Anchors - can be used to get all the latest / historical data in the network
 * - Liquidity pools - can be used to get all liquidity pools for funding, liquidation etc.
 * - Convertible tokens - can be used to get all tokens that can be converted in the network (excluding pool
 *   tokens), and for each one - all anchors that hold it in their reserves
 *
 *
 * The contract fires events whenever one of the primitives is added to or removed from the registry
 *
 * The contract is upgradable.
 */
contract ConverterRegistry is IConverterRegistry, ContractRegistryClient {
    /**
     * @dev triggered when a converter anchor is added to the registry
     *
     * @param _anchor anchor token
     */
    event ConverterAnchorAdded(IConverterAnchor indexed _anchor);

    /**
     * @dev triggered when a converter anchor is removed from the registry
     *
     * @param _anchor anchor token
     */
    event ConverterAnchorRemoved(IConverterAnchor indexed _anchor);

    /**
     * @dev triggered when a liquidity pool is added to the registry
     *
     * @param _liquidityPool liquidity pool
     */
    event LiquidityPoolAdded(IConverterAnchor indexed _liquidityPool);

    /**
     * @dev triggered when a liquidity pool is removed from the registry
     *
     * @param _liquidityPool liquidity pool
     */
    event LiquidityPoolRemoved(IConverterAnchor indexed _liquidityPool);

    /**
     * @dev triggered when a convertible token is added to the registry
     *
     * @param _convertibleToken convertible token
     * @param _smartToken associated anchor token
     */
    event ConvertibleTokenAdded(IReserveToken indexed _convertibleToken, IConverterAnchor indexed _smartToken);

    /**
     * @dev triggered when a convertible token is removed from the registry
     *
     * @param _convertibleToken convertible token
     * @param _smartToken associated anchor token
     */
    event ConvertibleTokenRemoved(IReserveToken indexed _convertibleToken, IConverterAnchor indexed _smartToken);

    /**
     * @dev deprecated, backward compatibility, use `ConverterAnchorAdded`
     */
    event SmartTokenAdded(IConverterAnchor indexed _smartToken);

    /**
     * @dev deprecated, backward compatibility, use `ConverterAnchorRemoved`
     */
    event SmartTokenRemoved(IConverterAnchor indexed _smartToken);

    /**
     * @dev initializes a new ConverterRegistry instance
     *
     * @param _registry address of a contract registry contract
     */
    constructor(IContractRegistry _registry) public ContractRegistryClient(_registry) {}

    /**
     * @dev creates a zero supply liquid token / empty liquidity pool and adds its converter to the registry
     *
     * @param _type                converter type, see ConverterBase contract main doc
     * @param _name                token / pool name
     * @param _symbol              token / pool symbol
     * @param _decimals            token / pool decimals
     * @param _maxConversionFee    maximum conversion-fee
     * @param _reserveTokens       reserve tokens
     * @param _reserveWeights      reserve weights
     *
     * @return new converter
     */
    function newConverter(
        uint16 _type,
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        uint32 _maxConversionFee,
        IReserveToken[] memory _reserveTokens,
        uint32[] memory _reserveWeights
    ) public virtual returns (IConverter) {
        uint256 length = _reserveTokens.length;
        require(length == _reserveWeights.length, "ERR_INVALID_RESERVES");

        // for standard pools, change type 1 to type 3
        if (_type == 1 && isStandardPool(_reserveWeights)) {
            _type = 3;
        }

        require(
            getLiquidityPoolByConfig(_type, _reserveTokens, _reserveWeights) == IConverterAnchor(0),
            "ERR_ALREADY_EXISTS"
        );

        IConverterFactory factory = IConverterFactory(addressOf(CONVERTER_FACTORY));
        IConverterAnchor anchor = IConverterAnchor(factory.createAnchor(_type, _name, _symbol, _decimals));
        IConverter converter = IConverter(factory.createConverter(_type, anchor, registry, _maxConversionFee));

        anchor.acceptOwnership();
        converter.acceptOwnership();

        for (uint256 i = 0; i < length; i++) {
            converter.addReserve(_reserveTokens[i], _reserveWeights[i]);
        }

        anchor.transferOwnership(address(converter));
        converter.acceptAnchorOwnership();
        converter.transferOwnership(msg.sender);

        addConverterInternal(converter);
        return converter;
    }

    /**
     * @dev adds an existing converter to the registry
     * can only be called by the owner
     *
     * @param _converter converter
     */
    function addConverter(IConverter _converter) public ownerOnly {
        require(isConverterValid(_converter), "ERR_INVALID_CONVERTER");
        addConverterInternal(_converter);
    }

    /**
     * @dev removes a converter from the registry
     * anyone can remove an existing converter from the registry, as long as the converter is invalid
     * note that the owner can also remove valid converters
     *
     * @param _converter converter
     */
    function removeConverter(IConverter _converter) public {
        require(msg.sender == owner || !isConverterValid(_converter), "ERR_ACCESS_DENIED");
        removeConverterInternal(_converter);
    }

    /**
     * @dev returns the number of converter anchors in the registry
     *
     * @return number of anchors
     */
    function getAnchorCount() public view override returns (uint256) {
        return IConverterRegistryData(addressOf(CONVERTER_REGISTRY_DATA)).getSmartTokenCount();
    }

    /**
     * @dev returns the list of converter anchors in the registry
     *
     * @return list of anchors
     */
    function getAnchors() public view override returns (address[] memory) {
        return IConverterRegistryData(addressOf(CONVERTER_REGISTRY_DATA)).getSmartTokens();
    }

    /**
     * @dev returns the converter anchor at a given index
     *
     * @param _index index
     * @return anchor at the given index
     */
    function getAnchor(uint256 _index) public view override returns (IConverterAnchor) {
        return IConverterRegistryData(addressOf(CONVERTER_REGISTRY_DATA)).getSmartToken(_index);
    }

    /**
     * @dev checks whether or not a given value is a converter anchor
     *
     * @param _value value
     * @return true if the given value is an anchor, false if not
     */
    function isAnchor(address _value) public view override returns (bool) {
        return IConverterRegistryData(addressOf(CONVERTER_REGISTRY_DATA)).isSmartToken(_value);
    }

    /**
     * @dev returns the number of liquidity pools in the registry
     *
     * @return number of liquidity pools
     */
    function getLiquidityPoolCount() public view override returns (uint256) {
        return IConverterRegistryData(addressOf(CONVERTER_REGISTRY_DATA)).getLiquidityPoolCount();
    }

    /**
     * @dev returns the list of liquidity pools in the registry
     *
     * @return list of liquidity pools
     */
    function getLiquidityPools() public view override returns (address[] memory) {
        return IConverterRegistryData(addressOf(CONVERTER_REGISTRY_DATA)).getLiquidityPools();
    }

    /**
     * @dev returns the liquidity pool at a given index
     *
     * @param _index index
     * @return liquidity pool at the given index
     */
    function getLiquidityPool(uint256 _index) public view override returns (IConverterAnchor) {
        return IConverterRegistryData(addressOf(CONVERTER_REGISTRY_DATA)).getLiquidityPool(_index);
    }

    /**
     * @dev checks whether or not a given value is a liquidity pool
     *
     * @param _value value
     * @return true if the given value is a liquidity pool, false if not
     */
    function isLiquidityPool(address _value) public view override returns (bool) {
        return IConverterRegistryData(addressOf(CONVERTER_REGISTRY_DATA)).isLiquidityPool(_value);
    }

    /**
     * @dev returns the number of convertible tokens in the registry
     *
     * @return number of convertible tokens
     */
    function getConvertibleTokenCount() public view override returns (uint256) {
        return IConverterRegistryData(addressOf(CONVERTER_REGISTRY_DATA)).getConvertibleTokenCount();
    }

    /**
     * @dev returns the list of convertible tokens in the registry
     *
     * @return list of convertible tokens
     */
    function getConvertibleTokens() public view override returns (address[] memory) {
        return IConverterRegistryData(addressOf(CONVERTER_REGISTRY_DATA)).getConvertibleTokens();
    }

    /**
     * @dev returns the convertible token at a given index
     *
     * @param _index index
     * @return convertible token at the given index
     */
    function getConvertibleToken(uint256 _index) public view override returns (IReserveToken) {
        return IConverterRegistryData(addressOf(CONVERTER_REGISTRY_DATA)).getConvertibleToken(_index);
    }

    /**
     * @dev checks whether or not a given value is a convertible token
     *
     * @param _value value
     * @return true if the given value is a convertible token, false if not
     */
    function isConvertibleToken(address _value) public view override returns (bool) {
        return IConverterRegistryData(addressOf(CONVERTER_REGISTRY_DATA)).isConvertibleToken(_value);
    }

    /**
     * @dev returns the number of converter anchors associated with a given convertible token
     *
     * @param _convertibleToken convertible token
     * @return number of anchors associated with the given convertible token
     */
    function getConvertibleTokenAnchorCount(IReserveToken _convertibleToken) public view override returns (uint256) {
        return
            IConverterRegistryData(addressOf(CONVERTER_REGISTRY_DATA)).getConvertibleTokenSmartTokenCount(
                _convertibleToken
            );
    }

    /**
     * @dev returns the list of converter anchors associated with a given convertible token
     *
     * @param _convertibleToken convertible token
     * @return list of anchors associated with the given convertible token
     */
    function getConvertibleTokenAnchors(IReserveToken _convertibleToken)
        public
        view
        override
        returns (address[] memory)
    {
        return
            IConverterRegistryData(addressOf(CONVERTER_REGISTRY_DATA)).getConvertibleTokenSmartTokens(
                _convertibleToken
            );
    }

    /**
     * @dev returns the converter anchor associated with a given convertible token at a given index
     *
     * @param _index index
     * @return anchor associated with the given convertible token at the given index
     */
    function getConvertibleTokenAnchor(IReserveToken _convertibleToken, uint256 _index)
        public
        view
        override
        returns (IConverterAnchor)
    {
        return
            IConverterRegistryData(addressOf(CONVERTER_REGISTRY_DATA)).getConvertibleTokenSmartToken(
                _convertibleToken,
                _index
            );
    }

    /**
     * @dev checks whether or not a given value is a converter anchor of a given convertible token
     *
     * @param _convertibleToken convertible token
     * @param _value value
     * @return true if the given value is an anchor of the given convertible token, false if not
     */
    function isConvertibleTokenAnchor(IReserveToken _convertibleToken, address _value)
        public
        view
        override
        returns (bool)
    {
        return
            IConverterRegistryData(addressOf(CONVERTER_REGISTRY_DATA)).isConvertibleTokenSmartToken(
                _convertibleToken,
                _value
            );
    }

    /**
     * @dev returns a list of converters for a given list of anchors
     * this is a utility function that can be used to reduce the number of calls to the contract
     *
     * @param _anchors list of converter anchors
     * @return list of converters
     */
    function getConvertersByAnchors(address[] memory _anchors) public view returns (IConverter[] memory) {
        IConverter[] memory converters = new IConverter[](_anchors.length);

        for (uint256 i = 0; i < _anchors.length; i++) {
            converters[i] = IConverter(payable(IConverterAnchor(_anchors[i]).owner()));
        }

        return converters;
    }

    /**
     * @dev checks whether or not a given converter is valid
     *
     * @param _converter converter
     * @return true if the given converter is valid, false if not
     */
    function isConverterValid(IConverter _converter) public view returns (bool) {
        // verify that the converter is active
        return _converter.token().owner() == address(_converter);
    }

    /**
     * @dev checks if a liquidity pool with given configuration is already registered
     *
     * @param _converter converter with specific configuration
     * @return if a liquidity pool with the same configuration is already registered
     */
    function isSimilarLiquidityPoolRegistered(IConverter _converter) public view returns (bool) {
        uint256 reserveTokenCount = _converter.connectorTokenCount();
        IReserveToken[] memory reserveTokens = new IReserveToken[](reserveTokenCount);
        uint32[] memory reserveWeights = new uint32[](reserveTokenCount);

        // get the reserve-configuration of the converter
        for (uint256 i = 0; i < reserveTokenCount; i++) {
            IReserveToken reserveToken = _converter.connectorTokens(i);
            reserveTokens[i] = reserveToken;
            reserveWeights[i] = getReserveWeight(_converter, reserveToken);
        }

        // return if a liquidity pool with the same configuration is already registered
        return
            getLiquidityPoolByConfig(getConverterType(_converter, reserveTokenCount), reserveTokens, reserveWeights) !=
            IConverterAnchor(0);
    }

    /**
     * @dev searches for a liquidity pool with specific configuration
     *
     * @param _type            converter type, see ConverterBase contract main doc
     * @param _reserveTokens   reserve tokens
     * @param _reserveWeights  reserve weights
     * @return the liquidity pool, or zero if no such liquidity pool exists
     */
    function getLiquidityPoolByConfig(
        uint16 _type,
        IReserveToken[] memory _reserveTokens,
        uint32[] memory _reserveWeights
    ) public view override returns (IConverterAnchor) {
        // verify that the input parameters represent a valid liquidity pool
        if (_reserveTokens.length == _reserveWeights.length && _reserveTokens.length > 1) {
            // get the anchors of the least frequent token (optimization)
            address[] memory convertibleTokenAnchors = getLeastFrequentTokenAnchors(_reserveTokens);
            // search for a converter with the same configuration
            for (uint256 i = 0; i < convertibleTokenAnchors.length; i++) {
                IConverterAnchor anchor = IConverterAnchor(convertibleTokenAnchors[i]);
                IConverter converter = IConverter(payable(anchor.owner()));
                if (isConverterReserveConfigEqual(converter, _type, _reserveTokens, _reserveWeights)) {
                    return anchor;
                }
            }
        }

        return IConverterAnchor(0);
    }

    /**
     * @dev adds a converter anchor to the registry
     *
     * @param _anchor converter anchor
     */
    function addAnchor(IConverterRegistryData _converterRegistryData, IConverterAnchor _anchor) internal {
        _converterRegistryData.addSmartToken(_anchor);
        emit ConverterAnchorAdded(_anchor);
        emit SmartTokenAdded(_anchor);
    }

    /**
     * @dev removes a converter anchor from the registry
     *
     * @param _anchor converter anchor
     */
    function removeAnchor(IConverterRegistryData _converterRegistryData, IConverterAnchor _anchor) internal {
        _converterRegistryData.removeSmartToken(_anchor);
        emit ConverterAnchorRemoved(_anchor);
        emit SmartTokenRemoved(_anchor);
    }

    /**
     * @dev adds a liquidity pool to the registry
     *
     * @param _liquidityPoolAnchor liquidity pool converter anchor
     */
    function addLiquidityPool(IConverterRegistryData _converterRegistryData, IConverterAnchor _liquidityPoolAnchor)
        internal
    {
        _converterRegistryData.addLiquidityPool(_liquidityPoolAnchor);
        emit LiquidityPoolAdded(_liquidityPoolAnchor);
    }

    /**
     * @dev removes a liquidity pool from the registry
     *
     * @param _liquidityPoolAnchor liquidity pool converter anchor
     */
    function removeLiquidityPool(IConverterRegistryData _converterRegistryData, IConverterAnchor _liquidityPoolAnchor)
        internal
    {
        _converterRegistryData.removeLiquidityPool(_liquidityPoolAnchor);
        emit LiquidityPoolRemoved(_liquidityPoolAnchor);
    }

    /**
     * @dev adds a convertible token to the registry
     *
     * @param _convertibleToken    convertible token
     * @param _anchor              associated converter anchor
     */
    function addConvertibleToken(
        IConverterRegistryData _converterRegistryData,
        IReserveToken _convertibleToken,
        IConverterAnchor _anchor
    ) internal {
        _converterRegistryData.addConvertibleToken(_convertibleToken, _anchor);
        emit ConvertibleTokenAdded(_convertibleToken, _anchor);
    }

    /**
     * @dev removes a convertible token from the registry
     *
     * @param _convertibleToken    convertible token
     * @param _anchor              associated converter anchor
     */
    function removeConvertibleToken(
        IConverterRegistryData _converterRegistryData,
        IReserveToken _convertibleToken,
        IConverterAnchor _anchor
    ) internal {
        _converterRegistryData.removeConvertibleToken(_convertibleToken, _anchor);
        emit ConvertibleTokenRemoved(_convertibleToken, _anchor);
    }

    /**
     * @dev checks whether or not a given configuration depicts a standard pool
     *
     * @param _reserveWeights  reserve weights
     *
     * @return true if the given configuration depicts a standard pool, false otherwise
     */
    function isStandardPool(uint32[] memory _reserveWeights) internal view virtual returns (bool) {
        this; // silent state mutability warning without generating additional bytecode
        return
            _reserveWeights.length == 2 &&
            _reserveWeights[0] == PPM_RESOLUTION / 2 &&
            _reserveWeights[1] == PPM_RESOLUTION / 2;
    }

    function addConverterInternal(IConverter _converter) private {
        IConverterRegistryData converterRegistryData = IConverterRegistryData(addressOf(CONVERTER_REGISTRY_DATA));
        IConverterAnchor anchor = IConverter(_converter).token();
        uint256 reserveTokenCount = _converter.connectorTokenCount();

        // add the converter anchor
        addAnchor(converterRegistryData, anchor);
        if (reserveTokenCount > 1) {
            addLiquidityPool(converterRegistryData, anchor);
        } else {
            addConvertibleToken(converterRegistryData, IReserveToken(address(anchor)), anchor);
        }

        // add all reserve tokens
        for (uint256 i = 0; i < reserveTokenCount; i++) {
            addConvertibleToken(converterRegistryData, _converter.connectorTokens(i), anchor);
        }
    }

    function removeConverterInternal(IConverter _converter) private {
        IConverterRegistryData converterRegistryData = IConverterRegistryData(addressOf(CONVERTER_REGISTRY_DATA));
        IConverterAnchor anchor = IConverter(_converter).token();
        uint256 reserveTokenCount = _converter.connectorTokenCount();

        // remove the converter anchor
        removeAnchor(converterRegistryData, anchor);
        if (reserveTokenCount > 1) {
            removeLiquidityPool(converterRegistryData, anchor);
        } else {
            removeConvertibleToken(converterRegistryData, IReserveToken(address(anchor)), anchor);
        }

        // remove all reserve tokens
        for (uint256 i = 0; i < reserveTokenCount; i++) {
            removeConvertibleToken(converterRegistryData, _converter.connectorTokens(i), anchor);
        }
    }

    function getLeastFrequentTokenAnchors(IReserveToken[] memory _reserveTokens)
        private
        view
        returns (address[] memory)
    {
        IConverterRegistryData converterRegistryData = IConverterRegistryData(addressOf(CONVERTER_REGISTRY_DATA));
        uint256 minAnchorCount = converterRegistryData.getConvertibleTokenSmartTokenCount(_reserveTokens[0]);
        uint256 index = 0;

        // find the reserve token which has the smallest number of converter anchors
        for (uint256 i = 1; i < _reserveTokens.length; i++) {
            uint256 convertibleTokenAnchorCount =
                converterRegistryData.getConvertibleTokenSmartTokenCount(_reserveTokens[i]);
            if (minAnchorCount > convertibleTokenAnchorCount) {
                minAnchorCount = convertibleTokenAnchorCount;
                index = i;
            }
        }

        return converterRegistryData.getConvertibleTokenSmartTokens(_reserveTokens[index]);
    }

    function isConverterReserveConfigEqual(
        IConverter _converter,
        uint16 _type,
        IReserveToken[] memory _reserveTokens,
        uint32[] memory _reserveWeights
    ) private view returns (bool) {
        uint256 reserveTokenCount = _converter.connectorTokenCount();

        if (_type != getConverterType(_converter, reserveTokenCount)) {
            return false;
        }

        if (_reserveTokens.length != reserveTokenCount) {
            return false;
        }

        for (uint256 i = 0; i < _reserveTokens.length; i++) {
            if (_reserveWeights[i] != getReserveWeight(_converter, _reserveTokens[i])) {
                return false;
            }
        }

        return true;
    }

    // utility to get the reserve weight (including from older converters that don't support the new getReserveWeight function)
    function getReserveWeight(IConverter _converter, IReserveToken _reserveToken) private view returns (uint32) {
        (, uint32 weight, , , ) = _converter.connectors(_reserveToken);
        return weight;
    }

    bytes4 private constant CONVERTER_TYPE_FUNC_SELECTOR = bytes4(keccak256("converterType()"));

    // utility to get the converter type (including from older converters that don't support the new converterType function)
    function getConverterType(IConverter _converter, uint256 _reserveTokenCount) private view returns (uint16) {
        (bool success, bytes memory returnData) =
            address(_converter).staticcall(abi.encodeWithSelector(CONVERTER_TYPE_FUNC_SELECTOR));
        if (success && returnData.length == 32) {
            return abi.decode(returnData, (uint16));
        }

        return _reserveTokenCount > 1 ? 1 : 0;
    }

    /**
     * @dev deprecated, backward compatibility, use `getAnchorCount`
     */
    function getSmartTokenCount() public view returns (uint256) {
        return getAnchorCount();
    }

    /**
     * @dev deprecated, backward compatibility, use `getAnchors`
     */
    function getSmartTokens() public view returns (address[] memory) {
        return getAnchors();
    }

    /**
     * @dev deprecated, backward compatibility, use `getAnchor`
     */
    function getSmartToken(uint256 _index) public view returns (IConverterAnchor) {
        return getAnchor(_index);
    }

    /**
     * @dev deprecated, backward compatibility, use `isAnchor`
     */
    function isSmartToken(address _value) public view returns (bool) {
        return isAnchor(_value);
    }

    /**
     * @dev deprecated, backward compatibility, use `getConvertibleTokenAnchorCount`
     */
    function getConvertibleTokenSmartTokenCount(IReserveToken _convertibleToken) public view returns (uint256) {
        return getConvertibleTokenAnchorCount(_convertibleToken);
    }

    /**
     * @dev deprecated, backward compatibility, use `getConvertibleTokenAnchors`
     */
    function getConvertibleTokenSmartTokens(IReserveToken _convertibleToken) public view returns (address[] memory) {
        return getConvertibleTokenAnchors(_convertibleToken);
    }

    /**
     * @dev deprecated, backward compatibility, use `getConvertibleTokenAnchor`
     */
    function getConvertibleTokenSmartToken(IReserveToken _convertibleToken, uint256 _index)
        public
        view
        returns (IConverterAnchor)
    {
        return getConvertibleTokenAnchor(_convertibleToken, _index);
    }

    /**
     * @dev deprecated, backward compatibility, use `isConvertibleTokenAnchor`
     */
    function isConvertibleTokenSmartToken(IReserveToken _convertibleToken, address _value) public view returns (bool) {
        return isConvertibleTokenAnchor(_convertibleToken, _value);
    }

    /**
     * @dev deprecated, backward compatibility, use `getConvertersByAnchors`
     */
    function getConvertersBySmartTokens(address[] memory _smartTokens) public view returns (IConverter[] memory) {
        return getConvertersByAnchors(_smartTokens);
    }

    /**
     * @dev deprecated, backward compatibility, use `getLiquidityPoolByConfig`
     */
    function getLiquidityPoolByReserveConfig(IReserveToken[] memory _reserveTokens, uint32[] memory _reserveWeights)
        public
        view
        returns (IConverterAnchor)
    {
        return getLiquidityPoolByConfig(_reserveTokens.length > 1 ? 1 : 0, _reserveTokens, _reserveWeights);
    }
}
