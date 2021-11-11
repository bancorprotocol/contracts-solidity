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

    Items private _anchors;
    Items private _liquidityPools;
    Lists private _convertibleTokens;

    /**
     * @dev initializes a new ConverterRegistryData instance
     */
    constructor(IContractRegistry registry) public ContractRegistryClient(registry) {}

    /**
     * @dev adds an anchor
     */
    function addSmartToken(IConverterAnchor anchor) external override only(CONVERTER_REGISTRY) {
        _addItem(_anchors, address(anchor));
    }

    /**
     * @dev removes an anchor
     */
    function removeSmartToken(IConverterAnchor anchor) external override only(CONVERTER_REGISTRY) {
        _removeItem(_anchors, address(anchor));
    }

    /**
     * @dev adds a liquidity pool
     */
    function addLiquidityPool(IConverterAnchor liquidityPoolAnchor) external override only(CONVERTER_REGISTRY) {
        _addItem(_liquidityPools, address(liquidityPoolAnchor));
    }

    /**
     * @dev removes a liquidity pool
     */
    function removeLiquidityPool(IConverterAnchor liquidityPoolAnchor) external override only(CONVERTER_REGISTRY) {
        _removeItem(_liquidityPools, address(liquidityPoolAnchor));
    }

    /**
     * @dev adds a convertible token
     */
    function addConvertibleToken(IReserveToken convertibleToken, IConverterAnchor anchor)
        external
        override
        only(CONVERTER_REGISTRY)
    {
        List storage list = _convertibleTokens.table[address(convertibleToken)];
        if (list.items.array.length == 0) {
            list.index = _convertibleTokens.array.length;
            _convertibleTokens.array.push(address(convertibleToken));
        }
        _addItem(list.items, address(anchor));
    }

    /**
     * @dev removes a convertible token
     */
    function removeConvertibleToken(IReserveToken convertibleToken, IConverterAnchor anchor)
        external
        override
        only(CONVERTER_REGISTRY)
    {
        List storage list = _convertibleTokens.table[address(convertibleToken)];
        _removeItem(list.items, address(anchor));
        if (list.items.array.length == 0) {
            address lastConvertibleToken = _convertibleTokens.array[_convertibleTokens.array.length - 1];
            _convertibleTokens.table[lastConvertibleToken].index = list.index;
            _convertibleTokens.array[list.index] = lastConvertibleToken;
            _convertibleTokens.array.pop();
            delete _convertibleTokens.table[address(convertibleToken)];
        }
    }

    /**
     * @dev returns the number of anchors
     */
    function getSmartTokenCount() external view override returns (uint256) {
        return _anchors.array.length;
    }

    /**
     * @dev returns the list of anchors
     */
    function getSmartTokens() external view override returns (address[] memory) {
        return _anchors.array;
    }

    /**
     * @dev returns the anchor at a given index
     */
    function getSmartToken(uint256 index) external view override returns (IConverterAnchor) {
        return IConverterAnchor(_anchors.array[index]);
    }

    /**
     * @dev checks whether or not a given value is an anchor
     */
    function isSmartToken(address value) external view override returns (bool) {
        return _anchors.table[value].valid;
    }

    /**
     * @dev returns the number of liquidity pools
     */
    function getLiquidityPoolCount() external view override returns (uint256) {
        return _liquidityPools.array.length;
    }

    /**
     * @dev returns the list of liquidity pools
     */
    function getLiquidityPools() external view override returns (address[] memory) {
        return _liquidityPools.array;
    }

    /**
     * @dev returns the liquidity pool at a given index
     */
    function getLiquidityPool(uint256 index) external view override returns (IConverterAnchor) {
        return IConverterAnchor(_liquidityPools.array[index]);
    }

    /**
     * @dev checks whether or not a given value is a liquidity pool
     */
    function isLiquidityPool(address value) external view override returns (bool) {
        return _liquidityPools.table[value].valid;
    }

    /**
     * @dev returns the number of convertible tokens
     */
    function getConvertibleTokenCount() external view override returns (uint256) {
        return _convertibleTokens.array.length;
    }

    /**
     * @dev returns the list of convertible tokens
     */
    function getConvertibleTokens() external view override returns (address[] memory) {
        return _convertibleTokens.array;
    }

    /**
     * @dev returns the convertible token at a given index
     */
    function getConvertibleToken(uint256 index) external view override returns (IReserveToken) {
        return IReserveToken(_convertibleTokens.array[index]);
    }

    /**
     * @dev checks whether or not a given value is a convertible token
     */
    function isConvertibleToken(address value) external view override returns (bool) {
        return _convertibleTokens.table[value].items.array.length > 0;
    }

    /**
     * @dev returns the number of anchors associated with a given convertible token
     */
    function getConvertibleTokenSmartTokenCount(IReserveToken convertibleToken)
        external
        view
        override
        returns (uint256)
    {
        return _convertibleTokens.table[address(convertibleToken)].items.array.length;
    }

    /**
     * @dev returns the list of anchors associated with a given convertible token
     */
    function getConvertibleTokenSmartTokens(IReserveToken convertibleToken)
        external
        view
        override
        returns (address[] memory)
    {
        return _convertibleTokens.table[address(convertibleToken)].items.array;
    }

    /**
     * @dev returns the anchor associated with a given convertible token at a given index
     */
    function getConvertibleTokenSmartToken(IReserveToken convertibleToken, uint256 index)
        external
        view
        override
        returns (IConverterAnchor)
    {
        return IConverterAnchor(_convertibleTokens.table[address(convertibleToken)].items.array[index]);
    }

    /**
     * @dev checks whether or not a given value is an anchor of a given convertible token
     */
    function isConvertibleTokenSmartToken(IReserveToken convertibleToken, address value)
        external
        view
        override
        returns (bool)
    {
        return _convertibleTokens.table[address(convertibleToken)].items.table[value].valid;
    }

    /**
     * @dev adds an item to a list of items
     */
    function _addItem(Items storage items, address value) internal validAddress(value) {
        Item storage item = items.table[value];
        require(!item.valid, "ERR_INVALID_ITEM");

        item.index = items.array.length;
        items.array.push(value);
        item.valid = true;
    }

    /**
     * @dev removes an item from a list of items
     */
    function _removeItem(Items storage items, address value) internal validAddress(value) {
        Item storage item = items.table[value];
        require(item.valid, "ERR_INVALID_ITEM");

        address lastValue = items.array[items.array.length - 1];
        items.table[lastValue].index = item.index;
        items.array[item.index] = lastValue;
        items.array.pop();
        delete items.table[value];
    }
}
