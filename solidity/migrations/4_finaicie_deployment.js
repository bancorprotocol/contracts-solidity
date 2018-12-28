/* global artifacts */
/* eslint-disable prefer-reflect */

const FinancieInternalWallet = artifacts.require('FinancieInternalWallet.sol');
const FinancieInternalWalletData = artifacts.require('FinancieInternalWalletData.sol');
const FinanciePlatformToken = artifacts.require('FinanciePlatformToken.sol');
const FinancieManagedContracts = artifacts.require('FinancieManagedContracts.sol');
const SmartToken = artifacts.require('SmartToken.sol');

module.exports = function(deployer, _network, _accounts) {
  let managedContracts;
  return deployer.deploy(SmartToken, "Fiat Token(JPY)", "JPYT", 18)
    .then(() => {
      return deployer.deploy(FinanciePlatformToken, 'PF Token', 'ERC PF', 10000000000 * (10 ** 18));
    })
    .then(() => {
      return deployer.deploy(FinancieManagedContracts);
    })
    .then(() => {
      return deployer.deploy(FinancieInternalWalletData, FinancieManagedContracts.address, FinanciePlatformToken.address, SmartToken.address);
    })
    .then(() => {
      return deployer.deploy(FinancieInternalWallet, "0x619dd467d76fb4a15e52deffd8c17a9c762d46b1", SmartToken.address, FinancieInternalWalletData.address);
    })
};
