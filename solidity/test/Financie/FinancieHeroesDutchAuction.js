/* global artifacts, contract, before, it, assert */
/* eslint-disable prefer-reflect */

// Bancor components
const SmartToken = artifacts.require('SmartToken.sol');

// Financie components
const FinanciePlatformToken = artifacts.require('FinanciePlatformToken.sol');
const FinancieCardToken = artifacts.require('FinancieCardToken.sol');
const FinancieHeroesDutchAuction = artifacts.require('FinancieHeroesDutchAuction.sol');
const FinancieNotifier = artifacts.require('FinancieNotifier.sol');
const FinancieManagedContracts = artifacts.require('FinancieManagedContracts.sol');

const FinancieInternalWallet = artifacts.require('FinancieInternalWallet.sol');

contract('FinancieHeroesDutchAuction', (accounts) => {
    let managedContracts;
    let auction;
    let platformToken;
    let currencyToken;
    let financieNotifier;
    let cardToken;
    let smartToken;

    before(async () => {
        console.log('[FinancieHeroesDutchAuction]initialize');

        managedContracts = await FinancieManagedContracts.new();
        platformToken = await FinanciePlatformToken.new('PF Token', 'ERC PF', 10000000000 * (10 ** 18));
        currencyToken = await SmartToken.new('Test', 'TST', 18);
        financieNotifier = await FinancieNotifier.new(managedContracts.address, platformToken.address, currencyToken.address);

        cardToken = await FinancieCardToken.new(
            'Financie Card Token',
            'FNCD',
            '0xA0d6B46ab1e40BEfc073E510e92AdB88C0A70c5C',
            financieNotifier.address);

        new Promise(() => console.log('[FinancieHeroesDutchAuction]card:' + cardToken.address));

        let internalWallet = await FinancieInternalWallet.new("0xA0d6B46ab1e40BEfc073E510e92AdB88C0A70c5C", currencyToken.address);

        auction = await FinancieHeroesDutchAuction.new(
            '0xA0d6B46ab1e40BEfc073E510e92AdB88C0A70c5C',
            '0x46a254FD6134eA0f564D07A305C0Db119a858d66',
            accounts[0],
            1000000 / 10,
            0x1bc16d674ec80000 / 10000,
            0x5ddb1980,
            3,
            financieNotifier.address,
            currencyToken.address,
            internalWallet.address
        );
        new Promise(() => console.log('[FinancieHeroesDutchAuction]auction:' + auction.address));

        console.log('[FinancieHeroesDutchAuction]begin setup');

        await managedContracts.activateTargetContract(cardToken.address, true);
        console.log('[FinancieHeroesDutchAuction]activateTargetContract card OK');

        await cardToken.transfer(auction.address, 200000 * (10 ** 18));
        console.log('[FinancieHeroesDutchAuction]card transfer to auction OK');

        await auction.setup(cardToken.address);
        console.log('[FinancieHeroesDutchAuction]setup OK');

        await auction.startAuction();
        console.log('[FinancieHeroesDutchAuction]start OK');

        await managedContracts.activateTargetContract(auction.address, true);
        console.log('[FinancieHeroesDutchAuction]activateTargetContract auction OK');

        let stage = await auction.stage();
        console.log('[FinancieHeroesDutchAuction]stage:' + stage);
        assert.equal(2, stage);

        console.log('[FinancieHeroesDutchAuction]end setup');
    });

    it('bid', async () => {
        await currencyToken.issue(accounts[0], 10 ** 5);
        await currencyToken.approve(auction.address, 10 ** 5);
        await auction.bidToken(1 * (10 ** 5));
        console.log('[FinancieHeroesDutchAuction]bid OK');
    });
});
