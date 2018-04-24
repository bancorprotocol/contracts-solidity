pragma solidity ^0.4.18;
import './Owned.sol';
import './interfaces/IBancorConverterFactory.sol';

/*
    Bancor converter dedicated interface
*/
contract IBancorConverter is IOwned {
    function token() public view returns (ISmartToken) {}
    function extensions() public view returns (IBancorConverterExtensions) {}
    function quickBuyPath(uint256 _index) public view returns (IERC20Token) {}
    function maxConversionFee() public view returns (uint32) {}
    function conversionFee() public view returns (uint32) {}
    function connectorTokenCount() public view returns (uint16);
    function reserveTokenCount() public view returns (uint16);
    function connectorTokens(uint256 _index) public view returns (IERC20Token) {}
    function reserveTokens(uint256 _index) public view returns (IERC20Token) {}
    function setExtensions(IBancorConverterExtensions _extensions) public view;
    function getQuickBuyPathLength() public view returns (uint256);
    function transferTokenOwnership(address _newOwner) public view;
    function withdrawTokens(IERC20Token _token, address _to, uint256 _amount) public view;
    function acceptTokenOwnership() public view;
    function transferManagement(address _newManager) public view;
    function acceptManagement() public;
    function setConversionFee(uint32 _conversionFee) public view;
    function setQuickBuyPath(IERC20Token[] _path) public view;
    function addConnector(IERC20Token _token, uint32 _weight, bool _enableVirtualBalance) public view;
    function getConnectorBalance(IERC20Token _connectorToken) public view returns (uint256);
    function getReserveBalance(IERC20Token _reserveToken) public view returns (uint256);
    function connectors(address _address) public view returns (
        uint256 virtualBalance, 
        uint32 weight, 
        bool isVirtualBalanceEnabled, 
        bool isPurchaseEnabled, 
        bool isSet
    );
    function reserves(address _address) public view returns (
        uint256 virtualBalance, 
        uint32 weight, 
        bool isVirtualBalanceEnabled, 
        bool isPurchaseEnabled, 
        bool isSet
    );
}

/*
    Bancor Converter Upgrader

    The Bancor converter upgrader contract allows upgrading an older Bancor converter
    contract (0.4 and up) to the latest version.
    To begin the upgrade process, first transfer the converter ownership to the upgrader
    contract and then call the upgrade function.
    At the end of the process, the ownership of the newly upgraded converter will be transferred
    back to the original owner.
    The address of the new converter is available in the ConverterUpgrade event.
*/
contract BancorConverterUpgrader is Owned {
    IBancorConverterFactory public bancorConverterFactory;  // bancor converter factory contract

    // triggered when the contract accept a converter ownership
    event ConverterOwned(address indexed _converter, address indexed _owner);
    // triggered when the upgrading process is done
    event ConverterUpgrade(address indexed _oldConverter, address indexed _newConverter);

    /**
        @dev constructor
    */
    function BancorConverterUpgrader(IBancorConverterFactory _bancorConverterFactory)
        public
    {
        bancorConverterFactory = _bancorConverterFactory;
    }

    /*
        @dev allows the owner to update the factory contract address

        @param _bancorConverterFactory    address of a bancor converter factory contract
    */
    function setBancorConverterFactory(IBancorConverterFactory _bancorConverterFactory) public ownerOnly
    {
        bancorConverterFactory = _bancorConverterFactory;
    }

    /**
        @dev upgrade an old converter to the latest version
        will throw if ownership wasn't transferred to the upgrader before calling this function.
        ownership of the new converter will be transferred back to the original owner.
        fires the ConverterUpgrade event upon success.

        @param _oldConverter   old converter contract address
        @param _version        old converter version
    */
    function upgrade(IBancorConverter _oldConverter, bytes32 _version) public {
        bool formerVersions = false;
        if (_version == "0.4")
            formerVersions = true;
        acceptConverterOwnership(_oldConverter);
        IBancorConverter toConverter = createConverter(_oldConverter);
        copyConnectors(_oldConverter, toConverter, formerVersions);
        copyConversionFee(_oldConverter, toConverter);
        copyQuickBuyPath(_oldConverter, toConverter);
        transferConnectorsBalances(_oldConverter, toConverter, formerVersions);
        _oldConverter.transferTokenOwnership(toConverter);
        toConverter.acceptTokenOwnership();
        _oldConverter.transferOwnership(msg.sender);
        toConverter.transferOwnership(msg.sender);
        toConverter.transferManagement(msg.sender);

        ConverterUpgrade(address(_oldConverter), address(toConverter));
    }

    /**
        @dev the first step when upgrading a converter is to transfer the ownership to the local contract.
        the upgrader contract then needs to accept the ownership transfer before initiating
        the upgrade process.
        fires the ConverterOwned event upon success

        @param _oldConverter       converter to accept ownership of
    */
    function acceptConverterOwnership(IBancorConverter _oldConverter) private {
        require(msg.sender == _oldConverter.owner());
        _oldConverter.acceptOwnership();
        ConverterOwned(_oldConverter, this);
    }

    /**
        @dev creates a new converter with same basic data as the original old converter
        the newly created converter will have no connectors at this step.

        @param _oldConverter       old converter contract address

        @return the new converter  new converter contract address
    */
    function createConverter(IBancorConverter _oldConverter) private returns(IBancorConverter) {
        ISmartToken token = _oldConverter.token();
        IBancorConverterExtensions extensions = _oldConverter.extensions();
        uint32 maxConversionFee = _oldConverter.maxConversionFee();

        address converterAdderess  = bancorConverterFactory.createConverter(
            token,
            extensions,
            maxConversionFee,
            IERC20Token(address(0)),
            0
        );

        IBancorConverter converter = IBancorConverter(converterAdderess);
        converter.acceptOwnership();
        converter.acceptManagement();

        return converter;
    }

    /**
        @dev copies the connectors from the old converter to the new one.
        note that this will not work for an unlimited number of connectors due to block gas limit constraints.

        @param _oldConverter    old converter contract address
        @param _newConverter    new converter contract address
        @param _isLegacyVersion true if the converter version is under 0.5
    */
    function copyConnectors(IBancorConverter _oldConverter, IBancorConverter _newConverter, bool _isLegacyVersion)
        private
    {
        uint256 virtualBalance;
        uint32 weight;
        bool isVirtualBalanceEnabled;
        bool isPurchaseEnabled;
        bool isSet;
        uint16 connectorTokenCount = _isLegacyVersion ? _oldConverter.reserveTokenCount() : _oldConverter.connectorTokenCount();

        for (uint16 i = 0; i < connectorTokenCount; i++) {
            address connectorAddress = _isLegacyVersion ? _oldConverter.reserveTokens(i) : _oldConverter.connectorTokens(i);
            (virtualBalance, weight, isVirtualBalanceEnabled, isPurchaseEnabled, isSet) = readConnector(
                _oldConverter,
                connectorAddress,
                _isLegacyVersion
            );

            IERC20Token connectorToken = IERC20Token(connectorAddress);
            _newConverter.addConnector(connectorToken, weight, isVirtualBalanceEnabled);
        }
    }

    /**
        @dev copies the conversion fee from the old converter to the new one

        @param _oldConverter    old converter contract address
        @param _newConverter    new converter contract address
    */
    function copyConversionFee(IBancorConverter _oldConverter, IBancorConverter _newConverter) private {
        uint32 conversionFee = _oldConverter.conversionFee();
        _newConverter.setConversionFee(conversionFee);
    }

    /**
        @dev copies the quick buy path from the old converter to the new one

        @param _oldConverter    old converter contract address
        @param _newConverter    new converter contract address
    */
    function copyQuickBuyPath(IBancorConverter _oldConverter, IBancorConverter _newConverter) private {
        uint256 quickBuyPathLength = _oldConverter.getQuickBuyPathLength();
        if (quickBuyPathLength <= 0)
            return;

        IERC20Token[] memory path = new IERC20Token[](quickBuyPathLength);
        for (uint256 i = 0; i < quickBuyPathLength; i++) {
            path[i] = _oldConverter.quickBuyPath(i);
        }

        _newConverter.setQuickBuyPath(path);
    }

    /**
        @dev transfers the balance of each connector in the old converter to the new one.
        note that the function assumes that the new converter already has the exact same number of
        also, this will not work for an unlimited number of connectors due to block gas limit constraints.

        @param _oldConverter    old converter contract address
        @param _newConverter    new converter contract address
        @param _isLegacyVersion true if the converter version is under 0.5
    */
    function transferConnectorsBalances(IBancorConverter _oldConverter, IBancorConverter _newConverter, bool _isLegacyVersion)
        private
    {
        uint256 connectorBalance;
        uint16 connectorTokenCount = _isLegacyVersion ? _oldConverter.reserveTokenCount() : _oldConverter.connectorTokenCount();

        for (uint16 i = 0; i < connectorTokenCount; i++) {
            address connectorAddress = _isLegacyVersion ? _oldConverter.reserveTokens(i) : _oldConverter.connectorTokens(i);
            IERC20Token connector = IERC20Token(connectorAddress);
            connectorBalance = _isLegacyVersion ? _oldConverter.getReserveBalance(connector) : _oldConverter.getConnectorBalance(connector);
            _oldConverter.withdrawTokens(connector, address(_newConverter), connectorBalance);
        }
    }

    /**
        @dev returns the connector settings

        @param _converter       old converter contract address
        @param _address         connector's address to read from
        @param _isLegacyVersion true if the converter version is under 0.5

        @return connector's settings
    */
    function readConnector(IBancorConverter _converter, address _address, bool _isLegacyVersion) 
        private
        view
        returns(uint256 virtualBalance, uint32 weight, bool isVirtualBalanceEnabled, bool isPurchaseEnabled, bool isSet)
    {
        return _isLegacyVersion ? _converter.reserves(_address) : _converter.connectors(_address);
    }
}