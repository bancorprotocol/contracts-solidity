pragma solidity 0.4.26;

contract BancorConverterRegistryData {
    struct SmartTokenInfo {
        bool valid;
        uint index;
    }

    struct ERC20TokenInfo {
        uint index;
        address[] smartTokenArray;
        mapping(address => SmartTokenInfo) smartTokenTable;
    }

    address[] erc20TokenArray;
    mapping(address => ERC20TokenInfo) erc20TokenTable;

    /**
      * @dev emitted when a mapping is added to the registry
      * 
      * @param _erc20Token the address of a ERC20Token contract instance
      * @param _smartToken the address of a SmartToken contract instance
    */
    event Added(address indexed _erc20Token, address indexed _smartToken);

    /**
      * @dev emitted when a mapping is removed from the registry
      * 
      * @param _erc20Token the address of a ERC20Token contract instance
      * @param _smartToken the address of a SmartToken contract instance
    */
    event Removed(address indexed _erc20Token, address indexed _smartToken);

    /**
      * @dev add a mapping to the registry
      * 
      * @param _erc20Token the address of a ERC20Token contract instance
      * @param _smartToken the address of a SmartToken contract instance
    */
    function add(address _erc20Token, address _smartToken) public {
        ERC20TokenInfo storage erc20TokenInfo = erc20TokenTable[_erc20Token];
        SmartTokenInfo storage smartTokenInfo = erc20TokenInfo.smartTokenTable[_smartToken];

        require(smartTokenInfo.valid == false);

        if (erc20TokenInfo.smartTokenArray.length == 0)
            erc20TokenInfo.index = erc20TokenArray.push(_erc20Token) - 1;
        smartTokenInfo.index = erc20TokenInfo.smartTokenArray.push(_smartToken) - 1;
        smartTokenInfo.valid = true;

        emit Added(_erc20Token, _smartToken);
    }

    /**
      * @dev remove a mapping from the registry
      * 
      * @param _erc20Token the address of a ERC20Token contract instance
      * @param _smartToken the address of a SmartToken contract instance
    */
    function remove(address _erc20Token, address _smartToken) public {
        ERC20TokenInfo storage erc20TokenInfo = erc20TokenTable[_erc20Token];
        SmartTokenInfo storage smartTokenInfo = erc20TokenInfo.smartTokenTable[_smartToken];

        require(smartTokenInfo.valid == true);

        address lastSmartToken = erc20TokenInfo.smartTokenArray[erc20TokenInfo.smartTokenArray.length - 1];
        erc20TokenInfo.smartTokenTable[lastSmartToken].index = smartTokenInfo.index;
        erc20TokenInfo.smartTokenArray[smartTokenInfo.index] = lastSmartToken;
        erc20TokenInfo.smartTokenArray.length--;
        delete erc20TokenInfo.smartTokenTable[_smartToken];

        if (erc20TokenInfo.smartTokenArray.length == 0) {
            address lastERC20Token = erc20TokenArray[erc20TokenArray.length - 1];
            erc20TokenTable[lastERC20Token].index = erc20TokenInfo.index;
            erc20TokenArray[erc20TokenInfo.index] = lastERC20Token;
            erc20TokenArray.length--;
            delete erc20TokenTable[_erc20Token];
        }

        emit Removed(_erc20Token, _smartToken);
    }

    function getERC20TokenCount() public view returns (uint) {
        return erc20TokenArray.length;
    }

    function getERC20TokenArray() public view returns (address[]) {
        return erc20TokenArray;
    }

    function getERC20Token(uint _index) public view returns (address) {
        return erc20TokenArray[_index];
    }

    function getSmartTokenCount(address _erc20Token) public view returns (uint) {
        return erc20TokenTable[_erc20Token].smartTokenArray.length;
    }

    function getSmartTokenArray(address _erc20Token) public view returns (address[]) {
        return erc20TokenTable[_erc20Token].smartTokenArray;
    }

    function getSmartToken(address _erc20Token, uint _index) public view returns (address) {
        return erc20TokenTable[_erc20Token].smartTokenArray[_index];
    }
}
