pragma solidity ^0.4.18;
import './FinancieBancorConverter.sol';
import '../converter/BancorConverterFactory.sol';

/**
* Financie Bancor Converter Factory
*
*  Based on BancorConverterFactory, extended and overriden for...
*    - allow conversion only from ETH/Card to Card/ETH
*    - ignore base fee model and use Financie fee model
*
*/
contract FinancieBancorConverterFactory is BancorConverterFactory {
    // Fee percentage in ppm for hero
    uint32 public heroFee;
    // Fee percentage in ppm for team
    uint32 public teamFee;
    // Receiver wallet id for hero fee
    uint32 public hero_id;
    // Receiver wallet address for team fee
    address public team_wallet;
    // Notifier contract address
    address public notifier_address;
    // Currency Tokens
    IERC20Token public currencyToken;
    // Internal wallet address
    address public internalWallet;

    /**
        @dev constructor
    */
    constructor(
        uint32  _hero_id,
        address _team_wallet,
        uint32  _heroFee,
        uint32  _teamFee,
        address _notifier_address,
        IERC20Token _currencyToken,
        address _internalWallet
    )
        public
    {
        heroFee = _heroFee;
        teamFee = _teamFee;
        hero_id = _hero_id;
        team_wallet = _team_wallet;
        notifier_address = _notifier_address;
        currencyToken = _currencyToken;
        internalWallet = _internalWallet;
    }

    /**
        @dev creates a new converter with the given arguments and transfers
        the ownership and management to the sender.

        @param  _token              smart token governed by the converter
        @param  _registry           address of a contract registry contract
        @param  _maxConversionFee   maximum conversion fee, represented in ppm
        @param  _connectorToken     optional, initial connector, allows defining the first connector at deployment time
        @param  _connectorWeight    optional, weight for the initial connector

        @return a new converter
    */
    function createConverter(
        ISmartToken _token,
        IContractRegistry _registry,
        uint32 _maxConversionFee,
        IERC20Token _connectorToken,
        uint32 _connectorWeight
    ) public returns(address converterAddress) {
        FinancieBancorConverter converter = new FinancieBancorConverter(
            _token,
            currencyToken,
            _connectorToken,
            hero_id,
            team_wallet,
            _registry,
            notifier_address,
            heroFee,
            teamFee,
            _connectorWeight,
            internalWallet
        );

        converter.transferOwnership(msg.sender);
        converter.transferManagement(msg.sender);

        address _converterAddress = address(converter);
        emit NewConverter(_converterAddress, msg.sender);
        return _converterAddress;
    }

}
