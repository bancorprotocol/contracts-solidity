/* global artifacts */
/* eslint-disable prefer-reflect */

const BancorFormula = artifacts.require('BancorFormula.sol');
const ERC20Token = artifacts.require('ERC20Token.sol');
const EtherToken = artifacts.require('EtherToken.sol');

module.exports = (deployer) => {
    deployer.deploy(BancorFormula);
    deployer.deploy(ERC20Token, 'DummyToken', 'DUM');
    deployer.deploy(EtherToken);
};
