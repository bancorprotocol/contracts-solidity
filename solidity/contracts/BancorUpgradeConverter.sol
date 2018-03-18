pragma solidity ^0.4.18;
import './BancorConverter.sol';
import './interfaces/ISmartToken.sol';
import './interfaces/IERC20Token.sol';

/*
    Bancor converter dedicated interface
*/
contract IBancorConverter is IOwned {
    function token() public view returns (ISmartToken) {}
    function extensions() public view returns (IBancorConverterExtensions) {}
    function quickBuyPath(uint256 _index) public view returns (IERC20Token) {}
    function maxConversionFee() public view returns (uint32) {}
    function conversionFee() public view returns (uint32) {}
    function version() internal view returns (string);
    function convertibleTokenCount() public view returns (uint16);
    function convertibleToken(uint16 _tokenIndex) public view returns (address);
    function setExtensions(IBancorConverterExtensions _extensions) public view;
    function getQuickBuyPathLength() public view returns (uint256);
    function transferTokenOwnership(address _newOwner) public view;
    function withdrawTokens(IERC20Token _token, address _to, uint256 _amount) public view;
    function acceptTokenOwnership() public view;
    function transferManagement(address _newManager) public view;
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
    Bancor Upgrade Converter

    The Bancor upgrade converter contract allows converter upgrade from old versions (0.4 and up) to the latest version.
    Contract deployment proccess will be without arguments.
    For begining upgrading a converter with contract instance on the network, first transfer the ownership to
    the upgrade contract instance address and then call to upgradeConverter function.
    Ownership of the current converter will be transfered back to the given new owner as the ownership of the new converter.
    You can find the address of the new converter at ConverterCreated event.

    WARNING: The contract assumes that it owned the current converter.
*/
contract BancorUpgradeConverter is Owned {

    // triggered when the contract accept a converter ownership
    event ConverterOwned(address indexed _converter, address indexed _owner);
    // triggered when the upgrading process is done
    event ConverterCreated(address indexed _fromConverter, address indexed _toConverter);

    /**
        @dev constructor
    */
    function BancorUpgradeConverter()
        public
    {}

    /**
        @dev upgrade from old converter versions to the latest version
        will throw if transfer ownership request was not sent before calling this function.
        ownership of the current and new converter will be transfered to a given owner address.
        when process is finish the function fired an event.

        @param _fromConverter   converter to upgrade
        @param _version         current conveter version
    */
    function upgradeConverter(IBancorConverter _fromConverter, bytes32 _version)
        public
    {
        bool formerVersions = false;
        if (_version == "0.4")
            formerVersions = true;
        acceptConverterOwnership(_fromConverter);
        IBancorConverter toConverter = createConverter(_fromConverter);
        copyConnectors(_fromConverter, toConverter, formerVersions);
        copyConvertionFee(_fromConverter, toConverter);
        copyQuickBuyPath(_fromConverter, toConverter);
        transferConnectorsBalances(_fromConverter, toConverter, formerVersions);
        _fromConverter.transferTokenOwnership(toConverter);
        toConverter.acceptTokenOwnership();
        _fromConverter.transferOwnership(msg.sender);
        toConverter.transferOwnership(msg.sender);
        toConverter.transferManagement(msg.sender);
        ConverterCreated(address(_fromConverter), address(toConverter));
    }

    /**
        @dev first step when upgrading a converter is to transfer the ownership to the upgrade converter
        contract instance. since transferring ownership has two steps, the instance must to accept the
        ownership before it can proceed the upgrading process.
        notice that even that the ownership transfered to the contract, only the current owner can 
        execute the upgrade process.
        when the process is finish, the function fired an event.

        @param _fromConverter       converter to accept its ownership request

        @return the new converter
    */
    function acceptConverterOwnership(IBancorConverter _fromConverter) private ownerOnly {
        _fromConverter.acceptOwnership();
        ConverterOwned(_fromConverter, this);
    }

    /**
        @dev create a new converter with same token and the same max conversion fee and the same 
        extensions address as set in the given converter.
        the new converter has no connectors.

        @param _fromConverter       converter to read from

        @return the new converter
    */
    function createConverter(IBancorConverter _fromConverter) private returns(IBancorConverter) {
        IERC20Token emptyConnector = IERC20Token(address(0));
        ISmartToken token = _fromConverter.token();
        IBancorConverterExtensions extensions = _fromConverter.extensions();
        uint32 maxConversionFee = _fromConverter.maxConversionFee();
        BancorConverter converter = new BancorConverter(
            token,
            extensions,
            maxConversionFee,
            emptyConnector,
            0
        );
        return IBancorConverter(converter);
    }

    /**
        @dev copies the connectors from the current converter to the new one

        @param _fromConverter       current converter to copy from
        @param _toConverter         new converter to add connectors
        @param _formerVersions      true if the converter version is under 0.5
    */
    function copyConnectors(IBancorConverter _fromConverter, IBancorConverter _toConverter, bool _formerVersions)
        private
    {
        uint256 virtualBalance;
        uint32 weight;
        bool isVirtualBalanceEnabled;
        bool isPurchaseEnabled;
        bool isSet;
        for (uint16 i = 1; i < _fromConverter.convertibleTokenCount(); i++) {
            address connectorAddress = _fromConverter.convertibleToken(i);
            (virtualBalance, weight, isVirtualBalanceEnabled, isPurchaseEnabled, isSet) = readConnector(
                _fromConverter,
                connectorAddress,
                _formerVersions
            );
            ISmartToken connectorToken = ISmartToken(connectorAddress);
            _toConverter.addConnector(connectorToken, weight, isVirtualBalanceEnabled);
        }
    }

    /**
        @dev copies the conversion fee from the current converter to the new one

        @param _fromConverter       current converter to copy from
        @param _toConverter         new converter to add a conversion fee
    */
    function copyConvertionFee(IBancorConverter _fromConverter, IBancorConverter _toConverter)
        private
    {
        uint32 conversionFee = _fromConverter.conversionFee();
        _toConverter.setConversionFee(conversionFee);
    }

    /**
        @dev copies the quick buy path array from the current converter to the new one

        @param _fromConverter       current converter to copy from
        @param _toConverter         new converter to add a path
    */
    function copyQuickBuyPath(IBancorConverter _fromConverter, IBancorConverter _toConverter)
        private
    {
        uint256 quickBuyPathLength = _fromConverter.getQuickBuyPathLength();
        if (quickBuyPathLength > 0) {
            IERC20Token[] memory path = new IERC20Token[](quickBuyPathLength);
            for (uint256 i = 0; i < quickBuyPathLength; i++) {
                path[i] = _fromConverter.quickBuyPath(i);
            }
            _toConverter.setQuickBuyPath(path);
        }
    }

    /**
        @dev for each connector of the current converter, the function transfers its balance to the new converter.
        notice that the function assumes that the new converter has exact the same connectors as the current
        converter owned.

        @param _fromConverter       current converter to withdraw from
        @param _toConverter         new converter to deposit
        @param _formerVersions      true if the converter version is under 0.5
    */
    function transferConnectorsBalances(IBancorConverter _fromConverter, IBancorConverter _toConverter, bool _formerVersions)
        private
    {
        uint256 connectorBalance;
        for (uint16 i = 1; i < _fromConverter.convertibleTokenCount(); i++) {
            IERC20Token connector = IERC20Token(_fromConverter.convertibleToken(i));
            connectorBalance = _formerVersions ? _fromConverter.getReserveBalance(connector) : _fromConverter.getConnectorBalance(connector);
            _fromConverter.withdrawTokens(connector, address(_toConverter), connectorBalance);
        }
    }

    /**
        @dev returns the connector settings

        @param _converter           converter to read from
        @param _address             connector's address to read from
        @param _formerVersions      true if the converter version is under 0.5

        @return connector's settings
    */
    function readConnector(IBancorConverter _converter, address _address, bool _formerVersions) 
        private
        view
        returns(uint256 virtualBalance, uint32 weight, bool isVirtualBalanceEnabled, bool isPurchaseEnabled, bool isSet)
    {
        return _formerVersions ? _converter.reserves(_address) : _converter.connectors(_address);
    }
}