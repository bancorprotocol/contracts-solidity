/* global artifacts, contract, before, it, assert */
/* eslint-disable prefer-reflect */

// Bancor components
const SmartToken = artifacts.require('SmartToken.sol');
const EtherToken = artifacts.require('EtherToken.sol');
const BancorConverterExtensions = artifacts.require('BancorConverterExtensions.sol');

// Financie components
const FinancieBancorConverter = artifacts.require('FinancieBancorConverter.sol');
const FinanciePlatformToken = artifacts.require('FinanciePlatformToken.sol');
const FinancieCardToken = artifacts.require('FinancieCardToken.sol');
const FinancieHeroesDutchAuction = artifacts.require('FinancieHeroesDutchAuction.sol');
const FinancieNotifier = artifacts.require('FinancieNotifier.sol');
const IFinancieNotifier = artifacts.require('IFinancieNotifier.sol');
const FinancieTicketStore = artifacts.require('FinancieTicketStore.sol');
const FinancieManagedContracts = artifacts.require('FinancieManagedContracts.sol');

const weight10Percent = 100000;
const gasPrice = 22000000000;
const gasPriceBad = 22000000001;

contract('FinancieNotifier', (accounts) => {
    let managedContracts;
    let platformToken;
    let etherToken;
    let financieNotifier;
    before(async () => {
        managedContracts = await FinancieManagedContracts.new();
        platformToken = await FinanciePlatformToken.new('PF Token', 'ERC PF', 10000000000 * (10 ** 18));
        etherToken = await EtherToken.new();
        financieNotifier = await FinancieNotifier.new(managedContracts.address, platformToken.address, etherToken.address);
    });

    it('migration test', async () => {
        let newFinancieNotifier = await FinancieNotifier.new(managedContracts.address, platformToken.address, etherToken.address);
        await financieNotifier.setLatestNotifier(newFinancieNotifier.address);
        let latest = await financieNotifier.latestNotifier.call();
        assert.equal(latest, newFinancieNotifier.address);
    })
});
