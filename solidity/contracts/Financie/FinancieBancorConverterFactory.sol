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
    // Receiver wallet address for hero fee
    address public hero_wallet;
    // Receiver wallet address for team fee
    address public team_wallet;
    // Notifier contract address
    address public notifier_address;
    // Ether Tokens
    IEtherToken public etherToken;
    /**
        @dev constructor
    */
    constructor(
      address _hero_wallet,
      address _team_wallet,
      uint32 _heroFee,
      uint32 _teamFee,
      address _notifier_address,
      IEtherToken _etherToken)
      public
    {
      heroFee = _heroFee;
      teamFee = _teamFee;
      hero_wallet = _hero_wallet;
      team_wallet = _team_wallet;
      notifier_address = _notifier_address;
      etherToken = _etherToken;
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
            etherToken,
            _connectorToken,
            hero_wallet,
            team_wallet,
            _registry,
            notifier_address,
            heroFee,
            teamFee,
            _connectorWeight
        );

        converter.transferOwnership(msg.sender);
        converter.transferManagement(msg.sender);

        address _converterAddress = address(converter);
        emit NewConverter(_converterAddress, msg.sender);
        return _converterAddress;
    }

}
