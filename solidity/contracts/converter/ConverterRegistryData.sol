// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;
import "../utility/ContractRegistryClient.sol";
import "./interfaces/IConverterRegistryData.sol";

/**
  * @dev The ConverterRegistryData contract is an integral part of the converter registry
  * as it serves as the database contract that holds all registry data.
  *
  * The registry is separated into two different contracts for upgradability - the data contract
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

    Items private smartTokens;
    Items private liquidityPools;
    Lists private convertibleTokens;

    /**
      * @dev initializes a new ConverterRegistryData instance
      *
      * @param _registry address of a contract registry contract
    */
    constructor(IContractRegistry _registry) ContractRegistryClient(_registry) public {
    }

    /**
      * @dev adds a smart token
      *
      * @param _anchor smart token
    */
    function addSmartToken(IConverterAnchor _anchor) external override only(CONVERTER_REGISTRY) {
        addItem(smartTokens, address(_anchor));
    }

    /**
      * @dev removes a smart token
      *
      * @param _anchor smart token
    */
    function removeSmartToken(IConverterAnchor _anchor) external override only(CONVERTER_REGISTRY) {
        removeItem(smartTokens, address(_anchor));
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
      * @param _anchor              associated smart token
    */
    function addConvertibleToken(IERC20Token _convertibleToken, IConverterAnchor _anchor) external override only(CONVERTER_REGISTRY) {
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
      * @param _anchor              associated smart token
    */
    function removeConvertibleToken(IERC20Token _convertibleToken, IConverterAnchor _anchor) external override only(CONVERTER_REGISTRY) {
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
      * @dev returns the number of smart tokens
      *
      * @return number of smart tokens
    */
    function getSmartTokenCount() external override view returns (uint256) {
        return smartTokens.array.length;
    }

    /**
      * @dev returns the list of smart tokens
      *
      * @return list of smart tokens
    */
    function getSmartTokens() external override view returns (address[] memory) {
        return smartTokens.array;
    }

    /**
      * @dev returns the smart token at a given index
      *
      * @param _index index
      * @return smart token at the given index
    */
    function getSmartToken(uint256 _index) external override view returns (IConverterAnchor) {
        return IConverterAnchor(smartTokens.array[_index]);
    }

    /**
      * @dev checks whether or not a given value is a smart token
      *
      * @param _value value
      * @return true if the given value is a smart token, false if not
    */
    function isSmartToken(address _value) external override view returns (bool) {
        return smartTokens.table[_value].valid;
    }

    /**
      * @dev returns the number of liquidity pools
      *
      * @return number of liquidity pools
    */
    function getLiquidityPoolCount() external override view returns (uint256) {
        return liquidityPools.array.length;
    }

    /**
      * @dev returns the list of liquidity pools
      *
      * @return list of liquidity pools
    */
    function getLiquidityPools() external override view returns (address[] memory) {
        return liquidityPools.array;
    }

    /**
      * @dev returns the liquidity pool at a given index
      *
      * @param _index index
      * @return liquidity pool at the given index
    */
    function getLiquidityPool(uint256 _index) external override view returns (IConverterAnchor) {
        return IConverterAnchor(liquidityPools.array[_index]);
    }

    /**
      * @dev checks whether or not a given value is a liquidity pool
      *
      * @param _value value
      * @return true if the given value is a liquidity pool, false if not
    */
    function isLiquidityPool(address _value) external override view returns (bool) {
        return liquidityPools.table[_value].valid;
    }

    /**
      * @dev returns the number of convertible tokens
      *
      * @return number of convertible tokens
    */
    function getConvertibleTokenCount() external override view returns (uint256) {
        return convertibleTokens.array.length;
    }

    /**
      * @dev returns the list of convertible tokens
      *
      * @return list of convertible tokens
    */
    function getConvertibleTokens() external override view returns (address[] memory) {
        return convertibleTokens.array;
    }

    /**
      * @dev returns the convertible token at a given index
      *
      * @param _index index
      * @return convertible token at the given index
    */
    function getConvertibleToken(uint256 _index) external override view returns (IERC20Token) {
        return IERC20Token(convertibleTokens.array[_index]);
    }

    /**
      * @dev checks whether or not a given value is a convertible token
      *
      * @param _value value
      * @return true if the given value is a convertible token, false if not
    */
    function isConvertibleToken(address _value) external override view returns (bool) {
        return convertibleTokens.table[_value].items.array.length > 0;
    }

    /**
      * @dev returns the number of smart tokens associated with a given convertible token
      *
      * @param _convertibleToken convertible token
      * @return number of smart tokens associated with the given convertible token
    */
    function getConvertibleTokenSmartTokenCount(IERC20Token _convertibleToken) external override view returns (uint256) {
        return convertibleTokens.table[address(_convertibleToken)].items.array.length;
    }

    /**
      * @dev returns the list of smart tokens associated with a given convertible token
      *
      * @param _convertibleToken convertible token
      * @return list of smart tokens associated with the given convertible token
    */
    function getConvertibleTokenSmartTokens(IERC20Token _convertibleToken) external override view returns (address[] memory) {
        return convertibleTokens.table[address(_convertibleToken)].items.array;
    }

    /**
      * @dev returns the smart token associated with a given convertible token at a given index
      *
      * @param _index index
      * @return smart token associated with the given convertible token at the given index
    */
    function getConvertibleTokenSmartToken(IERC20Token _convertibleToken, uint256 _index) external override view returns (IConverterAnchor) {
        return IConverterAnchor(convertibleTokens.table[address(_convertibleToken)].items.array[_index]);
    }

    /**
      * @dev checks whether or not a given value is a smart token of a given convertible token
      *
      * @param _convertibleToken convertible token
      * @param _value value
      * @return true if the given value is a smart token of the given convertible token, false it not
    */
    function isConvertibleTokenSmartToken(IERC20Token _convertibleToken, address _value) external override view returns (bool) {
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
