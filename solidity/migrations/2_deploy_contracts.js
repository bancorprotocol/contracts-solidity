/* global artifacts */
/* eslint-disable prefer-reflect */

const SafeMath = artifacts.require('SafeMath.sol');
const Owned = artifacts.require('Owned.sol');
const ERC20Token = artifacts.require('ERC20Token.sol');
const EtherToken = artifacts.require('EtherToken.sol');
const SmartToken = artifacts.require('SmartToken.sol');
const BancorFormula = artifacts.require('BancorFormula.sol');
const BancorChanger = artifacts.require('BancorChanger.sol');

module.exports = async (deployer) => {
    deployer.deploy(SafeMath);
    deployer.deploy(Owned);
    deployer.deploy(ERC20Token, 'DummyToken', 'DUM');
    deployer.deploy(EtherToken);
    deployer.deploy(SmartToken, 'Token1', 'TKN1', 2);
    deployer.deploy(BancorFormula);
    deployer.deploy(BancorChanger, '0x123', '0x123', '0x0', 0);
};
