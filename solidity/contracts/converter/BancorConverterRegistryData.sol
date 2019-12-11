pragma solidity 0.4.26;
import '../utility/ContractRegistryClient.sol';
import './interfaces/IBancorConverterRegistryData.sol';

contract BancorConverterRegistryData is IBancorConverterRegistryData, ContractRegistryClient {
    struct Item {
        bool valid;
        uint index;
    }

    struct Items {
        address[] array;
        mapping(address => Item) table;
    }

    struct List {
        uint index;
        Items items;
    }

    struct Lists {
        address[] array;
        mapping(address => List) table;
    }

    Items smartTokens;
    Items liquidityPools;
    Lists convertibleTokens;

    /**
      * @dev initialize a new BancorConverterRegistryData instance
      * 
      * @param _registry address of a contract registry contract
    */
    constructor(IContractRegistry _registry) ContractRegistryClient(_registry) public {
    }

    /**
      * @dev add a smart token
      * 
      * @param _smartToken smart token
    */
    function addSmartToken(address _smartToken) external only(BANCOR_CONVERTER_REGISTRY) {
        addItem(smartTokens, _smartToken);
    }

    /**
      * @dev remove a smart token
      * 
      * @param _smartToken smart token
    */
    function removeSmartToken(address _smartToken) external only(BANCOR_CONVERTER_REGISTRY) {
        removeItem(smartTokens, _smartToken);
    }

    /**
      * @dev add a liquidity pool
      * 
      * @param _liquidityPool liquidity pool
    */
    function addLiquidityPool(address _liquidityPool) external only(BANCOR_CONVERTER_REGISTRY) {
        addItem(liquidityPools, _liquidityPool);
    }

    /**
      * @dev remove a liquidity pool
      * 
      * @param _liquidityPool liquidity pool
    */
    function removeLiquidityPool(address _liquidityPool) external only(BANCOR_CONVERTER_REGISTRY) {
        removeItem(liquidityPools, _liquidityPool);
    }

    /**
      * @dev add a convertible token
      * 
      * @param _convertibleToken convertible token
      * @param _smartToken associated smart token
    */
    function addConvertibleToken(address _convertibleToken, address _smartToken) external only(BANCOR_CONVERTER_REGISTRY) {
        List storage list = convertibleTokens.table[_convertibleToken];
        if (list.items.array.length == 0) {
            list.index = convertibleTokens.array.push(_convertibleToken) - 1;
        }
        addItem(list.items, _smartToken);
    }

    /**
      * @dev remove a convertible token
      * 
      * @param _convertibleToken convertible token
      * @param _smartToken associated smart token
    */
    function removeConvertibleToken(address _convertibleToken, address _smartToken) external only(BANCOR_CONVERTER_REGISTRY) {
        List storage list = convertibleTokens.table[_convertibleToken];
        removeItem(list.items, _smartToken);
        if (list.items.array.length == 0) {
            address lastConvertibleToken = convertibleTokens.array[convertibleTokens.array.length - 1];
            convertibleTokens.table[lastConvertibleToken].index = list.index;
            convertibleTokens.array[list.index] = lastConvertibleToken;
            convertibleTokens.array.length--;
            delete convertibleTokens.table[_convertibleToken];
        }
    }

    function getSmartTokenCount() external view returns (uint) {
        return smartTokens.array.length;
    }

    function getSmartTokens() external view returns (address[]) {
        return smartTokens.array;
    }

    function getSmartToken(uint _index) external view returns (address) {
        return smartTokens.array[_index];
    }

    function getLiquidityPoolCount() external view returns (uint) {
        return liquidityPools.array.length;
    }

    function getLiquidityPools() external view returns (address[]) {
        return liquidityPools.array;
    }

    function getLiquidityPool(uint _index) external view returns (address) {
        return liquidityPools.array[_index];
    }

    function getConvertibleTokenCount() external view returns (uint) {
        return convertibleTokens.array.length;
    }

    function getConvertibleTokens() external view returns (address[]) {
        return convertibleTokens.array;
    }

    function getConvertibleToken(uint _index) external view returns (address) {
        return convertibleTokens.array[_index];
    }

    function getConvertibleTokenSmartTokenCount(address _convertibleToken) external view returns (uint) {
        return convertibleTokens.table[_convertibleToken].items.array.length;
    }

    function getConvertibleTokenSmartTokens(address _convertibleToken) external view returns (address[]) {
        return convertibleTokens.table[_convertibleToken].items.array;
    }

    function getConvertibleTokenSmartToken(address _convertibleToken, uint _index) external view returns (address) {
        return convertibleTokens.table[_convertibleToken].items.array[_index];
    }

    /**
      * @dev add an item to a list of items
      * 
      * @param _items list of items
      * @param _value item's value
    */
    function addItem(Items storage _items, address _value) internal {
        Item storage item = _items.table[_value];

        require(item.valid == false);

        item.index = _items.array.push(_value) - 1;
        item.valid = true;
    }

    /**
      * @dev remove an item from a list of items
      * 
      * @param _items list of items
      * @param _value item's value
    */
    function removeItem(Items storage _items, address _value) internal {
        Item storage item = _items.table[_value];

        require(item.valid == true);

        address lastValue = _items.array[_items.array.length - 1];
        _items.table[lastValue].index = item.index;
        _items.array[item.index] = lastValue;
        _items.array.length--;
        delete _items.table[_value];
    }
}
