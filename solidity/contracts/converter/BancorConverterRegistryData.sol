pragma solidity 0.4.26;
import '../utility/ContractRegistryClient.sol';

contract BancorConverterRegistryData is ContractRegistryClient {
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

    Items liquidityPools;
    Lists convertibleTokens;

    /**
      * @dev emitted when a liquidity pool is added
      * 
      * @param _liquidityPool liquidity pool
    */
    event LiquidityPoolAdded(address indexed _liquidityPool);

    /**
      * @dev emitted when a liquidity pool is removed
      * 
      * @param _liquidityPool liquidity pool
    */
    event LiquidityPoolRemoved(address indexed _liquidityPool);

    /**
      * @dev emitted when a convertible token is added
      * 
      * @param _convertibleToken convertible token
      * @param _smartToken associated smart token
    */
    event ConvertibleTokenAdded(address indexed _convertibleToken, address indexed _smartToken);

    /**
      * @dev emitted when a convertible token is removed
      * 
      * @param _convertibleToken convertible token
      * @param _smartToken associated smart token
    */
    event ConvertibleTokenRemoved(address indexed _convertibleToken, address indexed _smartToken);

    /**
      * @dev initialize a new BancorConverterRegistryData instance
      * 
      * @param _registry address of a contract registry contract
    */
    constructor(IContractRegistry _registry) ContractRegistryClient(_registry) public {
    }

    /**
      * @dev add a liquidity pool
      * 
      * @param _liquidityPool liquidity pool
    */
    function addLiquidityPool(address _liquidityPool) public only(BANCOR_CONVERTER_REGISTRY) {
        Item storage item = liquidityPools.table[_liquidityPool];

        require(item.valid == false);

        item.index = liquidityPools.array.push(_liquidityPool) - 1;
        item.valid = true;

        emit LiquidityPoolAdded(_liquidityPool);
    }

    /**
      * @dev remove a liquidity pool
      * 
      * @param _liquidityPool liquidity pool
    */
    function removeLiquidityPool(address _liquidityPool) public only(BANCOR_CONVERTER_REGISTRY) {
        Item storage item = liquidityPools.table[_liquidityPool];

        require(item.valid == true);

        address lastLiquidityPool = liquidityPools.array[liquidityPools.array.length - 1];
        liquidityPools.table[lastLiquidityPool].index = item.index;
        liquidityPools.array[item.index] = lastLiquidityPool;
        liquidityPools.array.length--;
        delete liquidityPools.table[_liquidityPool];

        emit LiquidityPoolRemoved(_liquidityPool);
    }

    /**
      * @dev add a convertible token
      * 
      * @param _convertibleToken convertible token
      * @param _smartToken associated smart token
    */
    function addConvertibleToken(address _convertibleToken, address _smartToken) only(BANCOR_CONVERTER_REGISTRY) public {
        List storage list = convertibleTokens.table[_convertibleToken];
        Item storage item = list.table[_smartToken];

        require(item.valid == false);

        if (list.array.length == 0)
            list.index = convertibleTokens.array.push(_convertibleToken) - 1;
        item.index = list.array.push(_smartToken) - 1;
        item.valid = true;

        emit ConvertibleTokenAdded(_convertibleToken, _smartToken);
    }

    /**
      * @dev remove a convertible token
      * 
      * @param _convertibleToken convertible token
      * @param _smartToken associated smart token
    */
    function removeConvertibleToken(address _convertibleToken, address _smartToken) only(BANCOR_CONVERTER_REGISTRY) public {
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

        emit ConvertibleTokenRemoved(_convertibleToken, _smartToken);
    }

    function getLiquidityPoolCount() public view returns (uint) {
        return liquidityPools.array.length;
    }

    function getLiquidityPoolArray() public view returns (address[]) {
        return liquidityPools.array;
    }

    function getLiquidityPool(uint _index) public view returns (address) {
        return liquidityPools.array[_index];
    }

    function getConvertibleTokenCount() public view returns (uint) {
        return convertibleTokens.array.length;
    }

    function getConvertibleTokenArray() public view returns (address[]) {
        return convertibleTokens.array;
    }

    function getConvertibleToken(uint _index) public view returns (address) {
        return convertibleTokens.array[_index];
    }

    function getSmartTokenCount(address _convertibleToken) public view returns (uint) {
        return convertibleTokens.table[_convertibleToken].array.length;
    }

    function getSmartTokenArray(address _convertibleToken) public view returns (address[]) {
        return convertibleTokens.table[_convertibleToken].array;
    }

    function getSmartToken(address _convertibleToken, uint _index) public view returns (address) {
        return convertibleTokens.table[_convertibleToken].array[_index];
    }
}
