pragma solidity 0.4.26;
import "./interfaces/IConverter.sol";
import "./interfaces/IConverterUpgrader.sol";
import "./interfaces/IConverterFactory.sol";
import "../utility/ContractRegistryClient.sol";
import "../utility/interfaces/IWhitelist.sol";
import "../token/interfaces/IEtherToken.sol";

/**
  * @dev Converter Upgrader
  *
  * The converter upgrader contract allows upgrading an older converter contract (0.4 and up)
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
contract ConverterUpgrader is IConverterUpgrader, ContractRegistryClient {
    address private constant ETH_RESERVE_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
    IEtherToken etherToken;

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
      * @dev initializes a new ConverterUpgrader instance
      *
      * @param _registry    address of a contract registry contract
    */
    constructor(IContractRegistry _registry, IEtherToken _etherToken) ContractRegistryClient(_registry) public {
        etherToken = _etherToken;
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
        upgradeOld(IConverter(msg.sender), _version);
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
        upgradeOld(IConverter(msg.sender), bytes32(_version));
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
    function upgradeOld(IConverter _converter, bytes32 _version) public {
        _version;
        IConverter converter = IConverter(_converter);
        address prevOwner = converter.owner();
        acceptConverterOwnership(converter);
        IConverter newConverter = createConverter(converter);
        copyConnectors(converter, newConverter);
        copyConversionFee(converter, newConverter);
        transferConnectorsBalances(converter, newConverter);
        IConverterAnchor anchor = converter.token();

        if (anchor.owner() == address(converter)) {
            converter.transferTokenOwnership(newConverter);
            newConverter.acceptAnchorOwnership();
        }

        converter.transferOwnership(prevOwner);
        newConverter.transferOwnership(prevOwner);

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
    function acceptConverterOwnership(IConverter _oldConverter) private {
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
    function createConverter(IConverter _oldConverter) private returns (IConverter) {
        IConverterAnchor anchor = _oldConverter.token();
        uint32 maxConversionFee = _oldConverter.maxConversionFee();
        uint16 connectorTokenCount = _oldConverter.connectorTokenCount();

        // determine new converter type
        uint8 newType = 0;
        // new converter - get the type from the converter itself
        if (isV28OrHigherConverter(_oldConverter))
            newType = _oldConverter.converterType();
        // old converter - if it has 1 reserve token, the type is a liquid token, otherwise the type liquidity pool
        else if (connectorTokenCount > 1)
            newType = 1;

        IConverterFactory converterFactory = IConverterFactory(addressOf(CONVERTER_FACTORY));
        IConverter converter = converterFactory.createConverter(newType, anchor, registry, maxConversionFee);

        converter.acceptOwnership();
        return converter;
    }

    /**
      * @dev copies the reserves from the old converter to the new one.
      * note that this will not work for an unlimited number of reserves due to block gas limit constraints.
      *
      * @param _oldConverter    old converter contract address
      * @param _newConverter    new converter contract address
    */
    function copyConnectors(IConverter _oldConverter, IConverter _newConverter)
        private
    {
        uint16 connectorTokenCount = _oldConverter.connectorTokenCount();

        for (uint16 i = 0; i < connectorTokenCount; i++) {
            address connectorAddress = _oldConverter.connectorTokens(i);
            (, uint32 weight, , , ) = _oldConverter.connectors(connectorAddress);

            // Ether reserve
            if (connectorAddress == ETH_RESERVE_ADDRESS) {
                _newConverter.addReserve(IERC20Token(ETH_RESERVE_ADDRESS), weight);
            }
            // Ether reserve token
            else if (connectorAddress == address(etherToken)) {
                _newConverter.addReserve(IERC20Token(ETH_RESERVE_ADDRESS), weight);
            }
            // ERC20 reserve token
            else {
                _newConverter.addReserve(IERC20Token(connectorAddress), weight);
            }
        }
    }

    /**
      * @dev copies the conversion fee from the old converter to the new one
      *
      * @param _oldConverter    old converter contract address
      * @param _newConverter    new converter contract address
    */
    function copyConversionFee(IConverter _oldConverter, IConverter _newConverter) private {
        uint32 conversionFee = _oldConverter.conversionFee();
        _newConverter.setConversionFee(conversionFee);
    }

    /**
      * @dev transfers the balance of each connector in the old converter to the new one.
      * note that the function assumes that the new converter already has the exact same number of
      * also, this will not work for an unlimited number of reserves due to block gas limit constraints.
      *
      * @param _oldConverter    old converter contract address
      * @param _newConverter    new converter contract address
    */
    function transferConnectorsBalances(IConverter _oldConverter, IConverter _newConverter)
        private
    {
        uint256 connectorBalance;
        uint16 connectorTokenCount = _oldConverter.connectorTokenCount();

        for (uint16 i = 0; i < connectorTokenCount; i++) {
            address connectorAddress = _oldConverter.connectorTokens(i);
            // Ether reserve
            if (connectorAddress == ETH_RESERVE_ADDRESS) {
                _oldConverter.withdrawETH(address(_newConverter));
            }
            // Ether reserve token
            else if (connectorAddress == address(etherToken)) {
                connectorBalance = etherToken.balanceOf(_oldConverter);
                _oldConverter.withdrawTokens(etherToken, address(this), connectorBalance);
                etherToken.withdrawTo(address(_newConverter), connectorBalance);
            }
            // ERC20 reserve token
            else {
                IERC20Token connector = IERC20Token(connectorAddress);
                connectorBalance = connector.balanceOf(_oldConverter);
                _oldConverter.withdrawTokens(connector, address(_newConverter), connectorBalance);
            }
        }
    }

    bytes4 private constant IS_V28_OR_HIGHER_FUNC_SELECTOR = bytes4(keccak256("isV28OrHigher()"));

    function isV28OrHigherConverter(IConverter _converter) internal view returns (bool) {
        bool success;
        uint256[1] memory ret;
        bytes memory data = abi.encodeWithSelector(IS_V28_OR_HIGHER_FUNC_SELECTOR);

        assembly {
            success := staticcall(
                gas,           // gas remaining
                _converter,    // destination address
                add(data, 32), // input buffer (starts after the first 32 bytes in the `data` array)
                mload(data),   // input length (loaded from the first 32 bytes in the `data` array)
                ret,           // output buffer
                32             // output length
            )
        }

        return success;
    }
}
