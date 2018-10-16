/* global artifacts */
/* eslint-disable prefer-reflect */

const FinancieInternalWallet = artifacts.require('FinancieInternalWallet.sol');

module.exports = function(deployer, _network, _accounts) {
  deployer.deploy(FinancieInternalWallet, "0x619dd467d76fb4a15e52deffd8c17a9c762d46b1");
};
