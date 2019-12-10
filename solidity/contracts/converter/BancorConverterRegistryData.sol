pragma solidity 0.4.26;
import '../utility/ContractRegistryClient.sol';
import './interfaces/IBancorConverterRegistryData.sol';

contract BancorConverterRegistryData is IBancorConverterRegistryData, ContractRegistryClient {
    struct Item {
        bool valid;
        uint index;
    }

    struct List {
        uint index;
        address[] array;
        mapping(address => Item) table;
    }

    struct Items {
        address[] array;
        mapping(address => Item) table;
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
        Item storage item = smartTokens.table[_smartToken];

        require(item.valid == false);

        item.index = smartTokens.array.push(_smartToken) - 1;
        item.valid = true;
    }

    /**
      * @dev remove a smart token
      * 
      * @param _smartToken smart token
    */
    function removeSmartToken(address _smartToken) external only(BANCOR_CONVERTER_REGISTRY) {
        Item storage item = smartTokens.table[_smartToken];

        require(item.valid == true);

        address lastSmartToken = smartTokens.array[smartTokens.array.length - 1];
        smartTokens.table[lastSmartToken].index = item.index;
        smartTokens.array[item.index] = lastSmartToken;
        smartTokens.array.length--;
        delete smartTokens.table[_smartToken];
    }

    /**
      * @dev add a liquidity pool
      * 
      * @param _liquidityPool liquidity pool
    */
    function addLiquidityPool(address _liquidityPool) external only(BANCOR_CONVERTER_REGISTRY) {
        Item storage item = liquidityPools.table[_liquidityPool];

        require(item.valid == false);

        item.index = liquidityPools.array.push(_liquidityPool) - 1;
        item.valid = true;
    }

    /**
      * @dev remove a liquidity pool
      * 
      * @param _liquidityPool liquidity pool
    */
    function removeLiquidityPool(address _liquidityPool) external only(BANCOR_CONVERTER_REGISTRY) {
        Item storage item = liquidityPools.table[_liquidityPool];

        require(item.valid == true);

        address lastLiquidityPool = liquidityPools.array[liquidityPools.array.length - 1];
        liquidityPools.table[lastLiquidityPool].index = item.index;
        liquidityPools.array[item.index] = lastLiquidityPool;
        liquidityPools.array.length--;
        delete liquidityPools.table[_liquidityPool];
    }

    /**
      * @dev add a convertible token
      * 
      * @param _convertibleToken convertible token
      * @param _smartToken associated smart token
    */
    function addConvertibleToken(address _convertibleToken, address _smartToken) external only(BANCOR_CONVERTER_REGISTRY) {
        List storage list = convertibleTokens.table[_convertibleToken];
        Item storage item = list.table[_smartToken];

        require(item.valid == false);

        if (list.array.length == 0)
            list.index = convertibleTokens.array.push(_convertibleToken) - 1;
        item.index = list.array.push(_smartToken) - 1;
        item.valid = true;
    }

    /**
      * @dev remove a convertible token
      * 
      * @param _convertibleToken convertible token
      * @param _smartToken associated smart token
    */
    function removeConvertibleToken(address _convertibleToken, address _smartToken) external only(BANCOR_CONVERTER_REGISTRY) {
        List storage list = convertibleTokens.table[_convertibleToken];
        Item storage item = list.table[_smartToken];

        require(item.valid == true);

        address lastSmartToken = list.array[list.array.length - 1];
        list.table[lastSmartToken].index = item.index;
        list.array[item.index] = lastSmartToken;
        list.array.length--;
        delete list.table[_smartToken];

        if (list.array.length == 0) {
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
        return convertibleTokens.table[_convertibleToken].array.length;
    }

    function getConvertibleTokenSmartTokens(address _convertibleToken) external view returns (address[]) {
        return convertibleTokens.table[_convertibleToken].array;
    }

    function getConvertibleTokenSmartToken(address _convertibleToken, uint _index) external view returns (address) {
        return convertibleTokens.table[_convertibleToken].array[_index];
    }
}
