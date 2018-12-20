/* global artifacts */
/* eslint-disable prefer-reflect */

const FinancieInternalWallet = artifacts.require('FinancieInternalWallet.sol');
const SmartToken = artifacts.require('SmartToken.sol');

module.exports = function(deployer, _network, _accounts) {
  return deployer.deploy(SmartToken, "Fiat Token(JPY)", "JPYT", 18)
    .then(() => {
      return deployer.deploy(FinancieInternalWallet, "0x619dd467d76fb4a15e52deffd8c17a9c762d46b1", SmartToken.address);
    })
};
