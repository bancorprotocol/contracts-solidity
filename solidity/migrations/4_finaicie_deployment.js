/* global artifacts */
/* eslint-disable prefer-reflect */

const FinancieInternalWallet = artifacts.require('FinancieInternalWallet.sol');
const FinancieInternalBank = artifacts.require('FinancieInternalBank.sol');
const SmartToken = artifacts.require('SmartToken.sol');

module.exports = function(deployer, _network, _accounts) {
  let bank;
  let wallet;
  return deployer
    .then(() => {
        if ( process.env.FINANCIE_CURRENCY_TOKEN_CONTRACT_ADDRESS === undefined ) {
            return deployer.deploy(SmartToken, "Fiat Token(JPY)", "JPYT", 18)
        }
    })
    .then(() => {
        if ( process.env.FINANCIE_INTERNAL_BANK_CONTRACT_ADDRESS === undefined ) {
            return deployer.deploy(FinancieInternalBank);
        }
    })
    .then((instance) => {
        if ( process.env.FINANCIE_INTERNAL_WALLET_CONTRACT_ADDRESS === undefined ) {
            bank = instance;
            return deployer.deploy(
                FinancieInternalWallet,
                "0x619dd467d76fb4a15e52deffd8c17a9c762d46b1",
                SmartToken.address);
        }
    })
    .then((instance) => {
        if ( process.env.FINANCIE_INTERNAL_WALLET_CONTRACT_ADDRESS === undefined ) {
            wallet = instance;
            return bank.transferOwnership(FinancieInternalWallet.address);
        }
    }).then(() => {
        if ( process.env.FINANCIE_INTERNAL_WALLET_CONTRACT_ADDRESS === undefined &&
            process.env.FINANCIE_INTERNAL_BANK_CONTRACT_ADDRESS === undefined ) {
            return wallet.setInternalBank(FinancieInternalBank.address);
        }
    })
};
