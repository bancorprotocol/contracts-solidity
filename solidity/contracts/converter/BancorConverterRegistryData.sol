pragma solidity 0.4.26;
import '../utility/ContractRegistryClient.sol';
import './interfaces/IBancorConverterRegistryData.sol';

/**
  * @dev The BancorConverterRegistryData contract is an integral part of the Bancor converter registry
  * as it serves as the database contract that holds all registry data.
  *
  * The registry is separated into two different contracts for upgradability - the data contract
  * is harder to upgrade as it requires migrating all registry data into a new contract, while
  * the registry contract itself can be easily upgraded.
  *
  * For that same reason, the data contract is simple and contains no logic beyond the basic data
  * access utilities that it exposes.
*/
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
      * @dev initializes a new BancorConverterRegistryData instance
      * 
      * @param _registry address of a contract registry contract
    */
    constructor(IContractRegistry _registry) ContractRegistryClient(_registry) public {
    }

    /**
      * @dev adds a smart token
      * 
      * @param _smartToken smart token
    */
    function addSmartToken(address _smartToken) external only(BANCOR_CONVERTER_REGISTRY) {
        addItem(smartTokens, _smartToken);
    }

    /**
      * @dev removes a smart token
      * 
      * @param _smartToken smart token
    */
    function removeSmartToken(address _smartToken) external only(BANCOR_CONVERTER_REGISTRY) {
        removeItem(smartTokens, _smartToken);
    }

    /**
      * @dev adds a liquidity pool
      * 
      * @param _liquidityPool liquidity pool
    */
    function addLiquidityPool(address _liquidityPool) external only(BANCOR_CONVERTER_REGISTRY) {
        addItem(liquidityPools, _liquidityPool);
    }

    /**
      * @dev removes a liquidity pool
      * 
      * @param _liquidityPool liquidity pool
    */
    function removeLiquidityPool(address _liquidityPool) external only(BANCOR_CONVERTER_REGISTRY) {
        removeItem(liquidityPools, _liquidityPool);
    }

    /**
      * @dev adds a convertible token
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
      * @dev removes a convertible token
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

    /**
      * @dev returns the number of smart tokens
      * 
      * @return number of smart tokens
    */
    function getSmartTokenCount() external view returns (uint) {
        return smartTokens.array.length;
    }

    /**
      * @dev returns the list of smart tokens
      * 
      * @return list of smart tokens
    */
    function getSmartTokens() external view returns (address[]) {
        return smartTokens.array;
    }

    /**
      * @dev returns the smart token at a given index
      * 
      * @param _index index
      * @return smart token at the given index
    */
    function getSmartToken(uint _index) external view returns (address) {
        return smartTokens.array[_index];
    }

    /**
      * @dev checks whether or not a given value is a smart token
      * 
      * @param _value value
      * @return true if the given value is a smart token, false if not
    */
    function isSmartToken(address _value) external view returns (bool) {
        return smartTokens.table[_value].valid;
    }

    /**
      * @dev returns the number of liquidity pools
      * 
      * @return number of liquidity pools
    */
    function getLiquidityPoolCount() external view returns (uint) {
        return liquidityPools.array.length;
    }

    /**
      * @dev returns the list of liquidity pools
      * 
      * @return list of liquidity pools
    */
    function getLiquidityPools() external view returns (address[]) {
        return liquidityPools.array;
    }

    /**
      * @dev returns the liquidity pool at a given index
      * 
      * @param _index index
      * @return liquidity pool at the given index
    */
    function getLiquidityPool(uint _index) external view returns (address) {
        return liquidityPools.array[_index];
    }

    /**
      * @dev checks whether or not a given value is a liquidity pool
      * 
      * @param _value value
      * @return true if the given value is a liquidity pool, false if not
    */
    function isLiquidityPool(address _value) external view returns (bool) {
        return liquidityPools.table[_value].valid;
    }

    /**
      * @dev returns the number of convertible tokens
      * 
      * @return number of convertible tokens
    */
    function getConvertibleTokenCount() external view returns (uint) {
        return convertibleTokens.array.length;
    }

    /**
      * @dev returns the list of convertible tokens
      * 
      * @return list of convertible tokens
    */
    function getConvertibleTokens() external view returns (address[]) {
        return convertibleTokens.array;
    }

    /**
      * @dev returns the convertible token at a given index
      * 
      * @param _index index
      * @return convertible token at the given index
    */
    function getConvertibleToken(uint _index) external view returns (address) {
        return convertibleTokens.array[_index];
    }

    /**
      * @dev checks whether or not a given value is a convertible token
      * 
      * @param _value value
      * @return true if the given value is a convertible token, false if not
    */
    function isConvertibleToken(address _value) external view returns (bool) {
        return convertibleTokens.table[_value].items.array.length > 0;
    }

    /**
      * @dev returns the number of smart tokens associated with a given convertible token
      * 
      * @param _convertibleToken convertible token
      * @return number of smart tokens associated with the given convertible token
    */
    function getConvertibleTokenSmartTokenCount(address _convertibleToken) external view returns (uint) {
        return convertibleTokens.table[_convertibleToken].items.array.length;
    }

    /**
      * @dev returns the list of smart tokens associated with a given convertible token
      * 
      * @param _convertibleToken convertible token
      * @return list of smart tokens associated with the given convertible token
    */
    function getConvertibleTokenSmartTokens(address _convertibleToken) external view returns (address[]) {
        return convertibleTokens.table[_convertibleToken].items.array;
    }

    /**
      * @dev returns the smart token associated with a given convertible token at a given index
      * 
      * @param _index index
      * @return smart token associated with the given convertible token at the given index
    */
    function getConvertibleTokenSmartToken(address _convertibleToken, uint _index) external view returns (address) {
        return convertibleTokens.table[_convertibleToken].items.array[_index];
    }

    /**
      * @dev checks whether or not a given value is a smart token of a given convertible token
      * 
      * @param _convertibleToken convertible token
      * @param _value value
      * @return true if the given value is a smart token of the given convertible token, false it not
    */
    function isConvertibleTokenSmartToken(address _convertibleToken, address _value) external view returns (bool) {
        return convertibleTokens.table[_convertibleToken].items.table[_value].valid;
    }

    /**
      * @dev adds an item to a list of items
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
      * @dev removes an item from a list of items
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
