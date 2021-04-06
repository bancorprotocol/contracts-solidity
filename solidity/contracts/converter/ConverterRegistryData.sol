// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "../utility/ContractRegistryClient.sol";
import "./interfaces/IConverterRegistryData.sol";

/**
 * @dev This contract is an integral part of the converter registry,
 * and it serves as the database contract that holds all registry data.
 *
 * The registry is separated into two different contracts for upgradeability - the data contract
 * is harder to upgrade as it requires migrating all registry data into a new contract, while
 * the registry contract itself can be easily upgraded.
 *
 * For that same reason, the data contract is simple and contains no logic beyond the basic data
 * access utilities that it exposes.
 */
contract ConverterRegistryData is IConverterRegistryData, ContractRegistryClient {
    struct Item {
        bool valid;
        uint256 index;
    }

    struct Items {
        address[] array;
        mapping(address => Item) table;
    }

    struct List {
        uint256 index;
        Items items;
    }

    struct Lists {
        address[] array;
        mapping(address => List) table;
    }

    Items private anchors;
    Items private liquidityPools;
    Lists private convertibleTokens;

    /**
     * @dev initializes a new ConverterRegistryData instance
     *
     * @param _registry address of a contract registry contract
     */
    constructor(IContractRegistry _registry) public ContractRegistryClient(_registry) {}

    /**
     * @dev adds an anchor
     *
     * @param _anchor anchor
     */
    function addSmartToken(IConverterAnchor _anchor) external override only(CONVERTER_REGISTRY) {
        addItem(anchors, address(_anchor));
    }

    /**
     * @dev removes an anchor
     *
     * @param _anchor anchor
     */
    function removeSmartToken(IConverterAnchor _anchor) external override only(CONVERTER_REGISTRY) {
        removeItem(anchors, address(_anchor));
    }

    /**
     * @dev adds a liquidity pool
     *
     * @param _liquidityPoolAnchor liquidity pool
     */
    function addLiquidityPool(IConverterAnchor _liquidityPoolAnchor) external override only(CONVERTER_REGISTRY) {
        addItem(liquidityPools, address(_liquidityPoolAnchor));
    }

    /**
     * @dev removes a liquidity pool
     *
     * @param _liquidityPoolAnchor liquidity pool
     */
    function removeLiquidityPool(IConverterAnchor _liquidityPoolAnchor) external override only(CONVERTER_REGISTRY) {
        removeItem(liquidityPools, address(_liquidityPoolAnchor));
    }

    /**
     * @dev adds a convertible token
     *
     * @param _convertibleToken    convertible token
     * @param _anchor              associated anchor
     */
    function addConvertibleToken(IReserveToken _convertibleToken, IConverterAnchor _anchor)
        external
        override
        only(CONVERTER_REGISTRY)
    {
        List storage list = convertibleTokens.table[address(_convertibleToken)];
        if (list.items.array.length == 0) {
            list.index = convertibleTokens.array.length;
            convertibleTokens.array.push(address(_convertibleToken));
        }
        addItem(list.items, address(_anchor));
    }

    /**
     * @dev removes a convertible token
     *
     * @param _convertibleToken    convertible token
     * @param _anchor              associated anchor
     */
    function removeConvertibleToken(IReserveToken _convertibleToken, IConverterAnchor _anchor)
        external
        override
        only(CONVERTER_REGISTRY)
    {
        List storage list = convertibleTokens.table[address(_convertibleToken)];
        removeItem(list.items, address(_anchor));
        if (list.items.array.length == 0) {
            address lastConvertibleToken = convertibleTokens.array[convertibleTokens.array.length - 1];
            convertibleTokens.table[lastConvertibleToken].index = list.index;
            convertibleTokens.array[list.index] = lastConvertibleToken;
            convertibleTokens.array.pop();
            delete convertibleTokens.table[address(_convertibleToken)];
        }
    }

    /**
     * @dev returns the number of anchors
     *
     * @return number of anchors
     */
    function getSmartTokenCount() external view override returns (uint256) {
        return anchors.array.length;
    }

    /**
     * @dev returns the list of anchors
     *
     * @return list of anchors
     */
    function getSmartTokens() external view override returns (address[] memory) {
        return anchors.array;
    }

    /**
     * @dev returns the anchor at a given index
     *
     * @param _index index
     * @return anchor at the given index
     */
    function getSmartToken(uint256 _index) external view override returns (IConverterAnchor) {
        return IConverterAnchor(anchors.array[_index]);
    }

    /**
     * @dev checks whether or not a given value is an anchor
     *
     * @param _value value
     * @return true if the given value is an anchor, false if not
     */
    function isSmartToken(address _value) external view override returns (bool) {
        return anchors.table[_value].valid;
    }

    /**
     * @dev returns the number of liquidity pools
     *
     * @return number of liquidity pools
     */
    function getLiquidityPoolCount() external view override returns (uint256) {
        return liquidityPools.array.length;
    }

    /**
     * @dev returns the list of liquidity pools
     *
     * @return list of liquidity pools
     */
    function getLiquidityPools() external view override returns (address[] memory) {
        return liquidityPools.array;
    }

    /**
     * @dev returns the liquidity pool at a given index
     *
     * @param _index index
     * @return liquidity pool at the given index
     */
    function getLiquidityPool(uint256 _index) external view override returns (IConverterAnchor) {
        return IConverterAnchor(liquidityPools.array[_index]);
    }

    /**
     * @dev checks whether or not a given value is a liquidity pool
     *
     * @param _value value
     * @return true if the given value is a liquidity pool, false if not
     */
    function isLiquidityPool(address _value) external view override returns (bool) {
        return liquidityPools.table[_value].valid;
    }

    /**
     * @dev returns the number of convertible tokens
     *
     * @return number of convertible tokens
     */
    function getConvertibleTokenCount() external view override returns (uint256) {
        return convertibleTokens.array.length;
    }

    /**
     * @dev returns the list of convertible tokens
     *
     * @return list of convertible tokens
     */
    function getConvertibleTokens() external view override returns (address[] memory) {
        return convertibleTokens.array;
    }

    /**
     * @dev returns the convertible token at a given index
     *
     * @param _index index
     * @return convertible token at the given index
     */
    function getConvertibleToken(uint256 _index) external view override returns (IReserveToken) {
        return IReserveToken(convertibleTokens.array[_index]);
    }

    /**
     * @dev checks whether or not a given value is a convertible token
     *
     * @param _value value
     * @return true if the given value is a convertible token, false if not
     */
    function isConvertibleToken(address _value) external view override returns (bool) {
        return convertibleTokens.table[_value].items.array.length > 0;
    }

    /**
     * @dev returns the number of anchors associated with a given convertible token
     *
     * @param _convertibleToken convertible token
     * @return number of anchors
     */
    function getConvertibleTokenSmartTokenCount(IReserveToken _convertibleToken)
        external
        view
        override
        returns (uint256)
    {
        return convertibleTokens.table[address(_convertibleToken)].items.array.length;
    }

    /**
     * @dev returns the list of anchors associated with a given convertible token
     *
     * @param _convertibleToken convertible token
     * @return list of anchors
     */
    function getConvertibleTokenSmartTokens(IReserveToken _convertibleToken)
        external
        view
        override
        returns (address[] memory)
    {
        return convertibleTokens.table[address(_convertibleToken)].items.array;
    }

    /**
     * @dev returns the anchor associated with a given convertible token at a given index
     *
     * @param _index index
     * @return anchor
     */
    function getConvertibleTokenSmartToken(IReserveToken _convertibleToken, uint256 _index)
        external
        view
        override
        returns (IConverterAnchor)
    {
        return IConverterAnchor(convertibleTokens.table[address(_convertibleToken)].items.array[_index]);
    }

    /**
     * @dev checks whether or not a given value is an anchor of a given convertible token
     *
     * @param _convertibleToken convertible token
     * @param _value value
     * @return true if the given value is an anchor of the given convertible token, false it not
     */
    function isConvertibleTokenSmartToken(IReserveToken _convertibleToken, address _value)
        external
        view
        override
        returns (bool)
    {
        return convertibleTokens.table[address(_convertibleToken)].items.table[_value].valid;
    }

    /**
     * @dev adds an item to a list of items
     *
     * @param _items list of items
     * @param _value item's value
     */
    function addItem(Items storage _items, address _value) internal validAddress(_value) {
        Item storage item = _items.table[_value];
        require(!item.valid, "ERR_INVALID_ITEM");

        item.index = _items.array.length;
        _items.array.push(_value);
        item.valid = true;
    }

    /**
     * @dev removes an item from a list of items
     *
     * @param _items list of items
     * @param _value item's value
     */
    function removeItem(Items storage _items, address _value) internal validAddress(_value) {
        Item storage item = _items.table[_value];
        require(item.valid, "ERR_INVALID_ITEM");

        address lastValue = _items.array[_items.array.length - 1];
        _items.table[lastValue].index = item.index;
        _items.array[item.index] = lastValue;
        _items.array.pop();
        delete _items.table[_value];
    }
}
