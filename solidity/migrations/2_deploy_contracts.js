/* global artifacts */
/* eslint-disable prefer-reflect */

const SafeMath = artifacts.require('SafeMath.sol');
const Owned = artifacts.require('Owned.sol');
const TokenHolder = artifacts.require('TokenHolder.sol');
const ERC20Token = artifacts.require('ERC20Token.sol');
const EtherToken = artifacts.require('EtherToken.sol');
const SmartToken = artifacts.require('SmartToken.sol');
const SmartTokenController = artifacts.require('SmartTokenController.sol');
const BancorFormula = artifacts.require('BancorFormula.sol');
const BancorChanger = artifacts.require('BancorChanger.sol');
const CrowdsaleController = artifacts.require('CrowdsaleController.sol');

module.exports = async (deployer) => {
    deployer.deploy(SafeMath);
    deployer.deploy(Owned);
    deployer.deploy(TokenHolder);
    deployer.deploy(ERC20Token, 'DummyToken', 'DUM', 0);
    deployer.deploy(EtherToken);
    await deployer.deploy(SmartToken, 'Token1', 'TKN1', 2);
    deployer.deploy(SmartTokenController, SmartToken.address);
    deployer.deploy(BancorFormula);
    deployer.deploy(BancorChanger, SmartToken.address, '0x124', '0x0', 0);
    deployer.deploy(CrowdsaleController, SmartToken.address, 4102444800, '0x125', '0x126', 1);
};
