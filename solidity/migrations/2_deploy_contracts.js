/* global artifacts */
/* eslint-disable prefer-reflect */

const Utils = artifacts.require('Utils');
const Owned = artifacts.require('Owned');
const Managed = artifacts.require('Managed');
const TokenHolder = artifacts.require('TokenHolder');
const ERC20Token = artifacts.require('ERC20Token');
const EtherToken = artifacts.require('EtherToken');
const ContractRegistry = artifacts.require('ContractRegistry');
const ContractFeatures = artifacts.require('ContractFeatures');
const Whitelist = artifacts.require('Whitelist');
const SmartToken = artifacts.require('SmartToken');
const SmartTokenController = artifacts.require('SmartTokenController');
const BancorNetwork = artifacts.require('BancorNetwork');
const BancorX = artifacts.require('BancorX');
const XTransferRerouter = artifacts.require('XTransferRerouter');
const BancorFormula = artifacts.require('BancorFormula');
const BancorGasPriceLimit = artifacts.require('BancorGasPriceLimit');
const BancorConverter = artifacts.require('BancorConverter');
const BancorConverterFactory = artifacts.require('BancorConverterFactory');
const BancorConverterUpgrader = artifacts.require('BancorConverterUpgrader');
const BancorConverterRegistry = artifacts.require('BancorConverterRegistry');
const CrowdsaleController = artifacts.require('CrowdsaleController');

module.exports = function(deployer, network, accounts) {
    if (network == "production") {
        deployer.deploy(Utils);
        deployer.deploy(Owned);
        deployer.deploy(Managed);
        deployer.deploy(TokenHolder);
        deployer.deploy(ERC20Token, 'DummyToken', 'DUM', 0);
        deployer.deploy(EtherToken);
        deployer.deploy(ContractRegistry);
        deployer.deploy(ContractFeatures);
        deployer.deploy(Whitelist);
        deployer.deploy(SmartToken, 'Token1', 'TKN1', 2);
        deployer.deploy(SmartTokenController, SmartToken.address);
        deployer.deploy(BancorFormula);
        deployer.deploy(BancorGasPriceLimit, '22000000000');
        deployer.deploy(BancorNetwork, ContractRegistry.address);
        deployer.deploy(BancorConverter, SmartToken.address, ContractRegistry.address, 0, '0x0', 0);

        deployer.deploy(BancorConverterFactory);
        deployer.deploy(BancorConverterUpgrader, ContractRegistry.address);

        deployer.deploy(BancorConverterRegistry);

        deployer.deploy(CrowdsaleController, SmartToken.address, 4102444800, '0x125', '0x126', 1);
        deployer.deploy(XTransferRerouter, true);
    }
};
