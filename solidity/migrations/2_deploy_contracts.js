/* global artifacts */
/* eslint-disable prefer-reflect */

const SafeMath = artifacts.require('SafeMath.sol');
const Owned = artifacts.require('Owned.sol');
const BancorFormula = artifacts.require('BancorFormula.sol');
const ERC20Token = artifacts.require('ERC20Token.sol');
const EtherToken = artifacts.require('EtherToken.sol');

module.exports = (deployer) => {
    deployer.deploy(SafeMath);
    deployer.deploy(Owned);
    deployer.deploy(BancorFormula);
    deployer.deploy(ERC20Token, 'DummyToken', 'DUM');
    deployer.deploy(EtherToken);
};
