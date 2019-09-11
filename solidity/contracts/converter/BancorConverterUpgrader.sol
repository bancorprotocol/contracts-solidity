pragma solidity ^0.4.24;
import './interfaces/IBancorConverter.sol';
import './interfaces/IBancorConverterUpgrader.sol';
import './interfaces/IBancorConverterFactory.sol';
import '../utility/Owned.sol';
import '../utility/interfaces/IContractRegistry.sol';
import '../utility/interfaces/IContractFeatures.sol';
import '../utility/interfaces/IWhitelist.sol';
import '../ContractIds.sol';
import '../FeatureIds.sol';

/*
    Bancor converter dedicated interface
*/
contract IBancorConverterExtended is IBancorConverter, IOwned {
    function token() public view returns (ISmartToken) {}
    function maxConversionFee() public view returns (uint32) {}
    function conversionFee() public view returns (uint32) {}
    function reserveTokenCount() public view returns (uint16);
    function reserveTokens(uint256 _index) public view returns (IERC20Token) { _index; }
    function setConversionWhitelist(IWhitelist _whitelist) public;
    function transferTokenOwnership(address _newOwner) public;
    function withdrawTokens(IERC20Token _token, address _to, uint256 _amount) public;
    function acceptTokenOwnership() public;
    function transferManagement(address _newManager) public;
    function acceptManagement() public;
    function setConversionFee(uint32 _conversionFee) public;
    function addReserve(IERC20Token _token, uint32 _ratio, bool _enableVirtualBalance) public;
    function updateReserve(IERC20Token _reserveToken, uint32 _ratio, bool _enableVirtualBalance, uint256 _virtualBalance) public;
    function getReserveBalance(IERC20Token _reserveToken) public view returns (uint256);
}

/**
  * @dev Bancor Converter Upgrader
  * 
  * The Bancor converter upgrader contract allows upgrading an older Bancor converter contract (0.4 and up)
  * to the latest version.
  * To begin the upgrade process, simply execute the 'upgrade' function.
  * At the end of the process, the ownership of the newly upgraded converter will be transferred
  * back to the original owner and the original owner will need to execute the 'acceptOwnership' function.
  * 
  * The address of the new converter is available in the ConverterUpgrade event.
  * 
  * Note that for older converters that don't yet have the 'upgrade' function, ownership should first
  * be transferred manually to the ConverterUpgrader contract using the 'transferOwnership' function
  * and then the upgrader 'upgrade' function should be executed directly.
*/
contract BancorConverterUpgrader is IBancorConverterUpgrader, Owned, ContractIds, FeatureIds {
    string public version = '0.3';

    IContractRegistry public registry;                      // contract registry contract address

    /**
      * @dev triggered when the contract accept a converter ownership
      * 
      * @param _converter   converter address
      * @param _owner       new owner - local upgrader address
    */
    event ConverterOwned(address indexed _converter, address indexed _owner);

    /**
      * @dev triggered when the upgrading process is done
      * 
      * @param _oldConverter    old converter address
      * @param _newConverter    new converter address
    */
    event ConverterUpgrade(address indexed _oldConverter, address indexed _newConverter);

    /**
      * @dev initializes a new BancorConverterUpgrader instance
    */
    constructor(IContractRegistry _registry) public {
        registry = _registry;
    }

    /**
      * @dev allows the owner to update the contract registry contract address
      * 
      * @param _registry   address of a contract registry contract
    */
    function setRegistry(IContractRegistry _registry) public ownerOnly {
        registry = _registry;
    }

    /**
      * @dev upgrades an old converter to the latest version
      * will throw if ownership wasn't transferred to the upgrader before calling this function.
      * ownership of the new converter will be transferred back to the original owner.
      * fires the ConverterUpgrade event upon success.
      * can only be called by a converter
      * 
      * @param _version old converter version
    */
    function upgrade(bytes32 _version) public {
        upgradeOld(IBancorConverter(msg.sender), _version);
    }

    /**
      * @dev upgrades an old converter to the latest version
      * will throw if ownership wasn't transferred to the upgrader before calling this function.
      * ownership of the new converter will be transferred back to the original owner.
      * fires the ConverterUpgrade event upon success.
      * can only be called by a converter
      * 
      * @param _version old converter version
    */
    function upgrade(uint16 _version) public {
        upgradeOld(IBancorConverter(msg.sender), bytes32(_version));
    }

    /**
      * @dev upgrades an old converter to the latest version
      * will throw if ownership wasn't transferred to the upgrader before calling this function.
      * ownership of the new converter will be transferred back to the original owner.
      * fires the ConverterUpgrade event upon success.
      * 
      * @param _converter   old converter contract address
      * @param _version     old converter version
    */
    function upgradeOld(IBancorConverter _converter, bytes32 _version) public {
        bool formerVersions = false;
        if (_version == "0.4")
            formerVersions = true;
        IBancorConverterExtended converter = IBancorConverterExtended(_converter);
        address prevOwner = converter.owner();
        acceptConverterOwnership(converter);
        IBancorConverterExtended newConverter = createConverter(converter);
        copyReserves(converter, newConverter, formerVersions);
        copyConversionFee(converter, newConverter);
        transferReservesBalances(converter, newConverter, formerVersions);                
        ISmartToken token = converter.token();

        if (token.owner() == address(converter)) {
            converter.transferTokenOwnership(newConverter);
            newConverter.acceptTokenOwnership();
        }

        converter.transferOwnership(prevOwner);
        newConverter.transferOwnership(prevOwner);
        newConverter.transferManagement(prevOwner);

        emit ConverterUpgrade(address(converter), address(newConverter));
    }

    /**
      * @dev the first step when upgrading a converter is to transfer the ownership to the local contract.
      * the upgrader contract then needs to accept the ownership transfer before initiating
      * the upgrade process.
      * fires the ConverterOwned event upon success
      * 
      * @param _oldConverter       converter to accept ownership of
    */
    function acceptConverterOwnership(IBancorConverterExtended _oldConverter) private {
        _oldConverter.acceptOwnership();
        emit ConverterOwned(_oldConverter, this);
    }

    /**
      * @dev creates a new converter with same basic data as the original old converter
      * the newly created converter will have no reserves at this step.
      * 
      * @param _oldConverter    old converter contract address
      * 
      * @return the new converter  new converter contract address
    */
    function createConverter(IBancorConverterExtended _oldConverter) private returns(IBancorConverterExtended) {
        IWhitelist whitelist;
        ISmartToken token = _oldConverter.token();
        uint32 maxConversionFee = _oldConverter.maxConversionFee();

        IBancorConverterFactory converterFactory = IBancorConverterFactory(registry.addressOf(ContractIds.BANCOR_CONVERTER_FACTORY));
        address converterAddress  = converterFactory.createConverter(
            token,
            registry,
            maxConversionFee,
            IERC20Token(address(0)),
            0
        );

        IBancorConverterExtended converter = IBancorConverterExtended(converterAddress);
        converter.acceptOwnership();
        converter.acceptManagement();

        // get the contract features address from the registry
        IContractFeatures features = IContractFeatures(registry.addressOf(ContractIds.CONTRACT_FEATURES));

        if (features.isSupported(_oldConverter, FeatureIds.CONVERTER_CONVERSION_WHITELIST)) {
            whitelist = _oldConverter.conversionWhitelist();
            if (whitelist != address(0))
                converter.setConversionWhitelist(whitelist);
        }

        return converter;
    }

    /**
      * @dev copies the reserves from the old converter to the new one.
      * note that this will not work for an unlimited number of reserves due to block gas limit constraints.
      * 
      * @param _oldConverter    old converter contract address
      * @param _newConverter    new converter contract address
      * @param _isLegacyVersion true if the converter version is under 0.5
    */
    function copyReserves(IBancorConverterExtended _oldConverter, IBancorConverterExtended _newConverter, bool _isLegacyVersion)
        private
    {
        uint256 virtualBalance;
        uint32 ratio;
        bool isVirtualBalanceEnabled;
        bool isSaleEnabled;
        bool isSet;
        uint16 reserveTokenCount = _isLegacyVersion ? _oldConverter.reserveTokenCount() : _oldConverter.reserveTokenCount();

        for (uint16 i = 0; i < reserveTokenCount; i++) {
            address reserveAddress = _isLegacyVersion ? _oldConverter.reserveTokens(i) : _oldConverter.reserveTokens(i);
            (virtualBalance, ratio, isVirtualBalanceEnabled, isSaleEnabled, isSet) = readReserve(
                _oldConverter,
                reserveAddress,
                _isLegacyVersion
            );

            IERC20Token reserveToken = IERC20Token(reserveAddress);
            _newConverter.addReserve(reserveToken, ratio, isVirtualBalanceEnabled);

            if (isVirtualBalanceEnabled)
                _newConverter.updateReserve(reserveToken, ratio, isVirtualBalanceEnabled, virtualBalance);
        }
    }

    /**
      * @dev copies the conversion fee from the old converter to the new one
      * 
      * @param _oldConverter    old converter contract address
      * @param _newConverter    new converter contract address
    */
    function copyConversionFee(IBancorConverterExtended _oldConverter, IBancorConverterExtended _newConverter) private {
        uint32 conversionFee = _oldConverter.conversionFee();
        _newConverter.setConversionFee(conversionFee);
    }

    /**
      * @dev transfers the balance of each reserve in the old converter to the new one.
      * note that the function assumes that the new converter already has the exact same number of
      * also, this will not work for an unlimited number of reserves due to block gas limit constraints.
      * 
      * @param _oldConverter    old converter contract address
      * @param _newConverter    new converter contract address
      * @param _isLegacyVersion true if the converter version is under 0.5
    */
    function transferReservesBalances(IBancorConverterExtended _oldConverter, IBancorConverterExtended _newConverter, bool _isLegacyVersion)
        private
    {
        uint256 reserveBalance;
        uint16 reserveTokenCount = _isLegacyVersion ? _oldConverter.reserveTokenCount() : _oldConverter.reserveTokenCount();

        for (uint16 i = 0; i < reserveTokenCount; i++) {
            address reserveAddress = _isLegacyVersion ? _oldConverter.reserveTokens(i) : _oldConverter.reserveTokens(i);
            IERC20Token reserve = IERC20Token(reserveAddress);
            reserveBalance = reserve.balanceOf(_oldConverter);
            _oldConverter.withdrawTokens(reserve, address(_newConverter), reserveBalance);
        }
    }

    /**
      * @dev returns the reserve settings
      * 
      * @param _converter       old converter contract address
      * @param _address         reserve's address to read from
      * @param _isLegacyVersion true if the converter version is under 0.5
      * 
      * @return reserve's settings
    */
    function readReserve(IBancorConverterExtended _converter, address _address, bool _isLegacyVersion) 
        private
        view
        returns(uint256 virtualBalance, uint32 ratio, bool isVirtualBalanceEnabled, bool isSaleEnabled, bool isSet)
    {
        return _isLegacyVersion ? _converter.reserves(_address) : _converter.reserves(_address);
    }
}
