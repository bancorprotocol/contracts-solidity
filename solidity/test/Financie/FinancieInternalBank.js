/* global artifacts, contract, before, it, assert */
/* eslint-disable prefer-reflect */

// Bancor components
const SmartToken = artifacts.require('SmartToken.sol');
const BancorNetwork = artifacts.require('BancorNetwork.sol');
const ContractIds = artifacts.require('ContractIds.sol');
const BancorFormula = artifacts.require('BancorFormula.sol');
const BancorGasPriceLimit = artifacts.require('BancorGasPriceLimit.sol');
const ContractRegistry = artifacts.require('ContractRegistry.sol');
const ContractFeatures = artifacts.require('ContractFeatures.sol');

// Financie components
const FinancieBancorConverter = artifacts.require('FinancieBancorConverter.sol');
const FinanciePlatformToken = artifacts.require('FinanciePlatformToken.sol');
const FinancieCardToken = artifacts.require('FinancieCardToken.sol');
const FinancieHeroesDutchAuction = artifacts.require('FinancieHeroesDutchAuction.sol');
const FinancieNotifier = artifacts.require('FinancieNotifier.sol');
const FinancieTicketStore = artifacts.require('FinancieTicketStore.sol');
const FinancieManagedContracts = artifacts.require('FinancieManagedContracts.sol');

const FinancieInternalWallet = artifacts.require('FinancieInternalWallet.sol');
const FinancieInternalBank = artifacts.require('FinancieInternalBank.sol');

const weight10Percent = 100000;
const gasPrice = 22000000000;
const gasPriceBad = 22000000001;

contract('FinancieInternalBank', (accounts) => {
    let internalWallet;
    let internalBank;

    let managedContracts;
    let platformToken;
    let currencyToken;
    let financieNotifier;
    let cardToken;
    let smartToken;
    let bancor;
    let bancorNetwork;

    const hero_id = 100;
    const user_id = 1;
    const user_id_noone = 2;

    before(async () => {
        console.log('[FinancieHeroesDutchAuction]initialize');
        currencyToken = await SmartToken.new('Test', 'TST', 18);
        managedContracts = await FinancieManagedContracts.new();
        platformToken = await FinanciePlatformToken.new('PF Token', 'ERC PF', 10000000000 * (10 ** 18));
        financieNotifier = await FinancieNotifier.new(managedContracts.address, platformToken.address, currencyToken.address);

        console.log('[FinancieInternalBank]initialize');
        internalBank = await FinancieInternalBank.new(
            currencyToken.address
        );
        console.log(internalBank.address);

        console.log('[FinancieInternalWallet]initialize');
        internalWallet = await FinancieInternalWallet.new("0xA0d6B46ab1e40BEfc073E510e92AdB88C0A70c5C", currencyToken.address);
        // await internalBank.transferOwnership(internalWallet.address);
        // internalWallet.setInternalBank(internalBank.address);

        cardToken = await FinancieCardToken.new(
            'Financie Card Token',
            'FNCD',
            hero_id,
            financieNotifier.address);

        new Promise(() => console.log('[FinancieHeroesDutchAuction]card:' + cardToken.address));
        await managedContracts.activateTargetContract(cardToken.address, true);

        auction = await FinancieHeroesDutchAuction.new(
            hero_id,
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

        managedContracts.activateTargetContract(cardToken.address, true);
        console.log('[FinancieHeroesDutchAuction]activateTargetContract card OK');

        cardToken.transfer(auction.address, 200000 * (10 ** 18));
        console.log('[FinancieHeroesDutchAuction]card transfer to auction OK');

        auction.setup(cardToken.address);
        console.log('[FinancieHeroesDutchAuction]setup OK');

        await auction.startAuction();
        console.log('[FinancieHeroesDutchAuction]start OK');

        await managedContracts.activateTargetContract(auction.address, true);
        console.log('[FinancieHeroesDutchAuction]activateTargetContract auction OK');

        let stage = await auction.stage();
        console.log('[FinancieHeroesDutchAuction]stage:' + stage);
        assert.equal(2, stage);

        console.log('[FinancieHeroesDutchAuction]end setup');

        console.log('[FinancieBancorConverter]initialize');

        smartToken = await SmartToken.new('Token1', 'TKN', 0);

        let contractRegistry = await ContractRegistry.new();
        let contractIds = await ContractIds.new();

        contractFeatures = await ContractFeatures.new();
        let contractFeaturesId = await contractIds.CONTRACT_FEATURES.call();
        await contractRegistry.registerAddress(contractFeaturesId, contractFeatures.address);

        let gasPriceLimit = await BancorGasPriceLimit.new(gasPrice);
        let gasPriceLimitId = await contractIds.BANCOR_GAS_PRICE_LIMIT.call();
        await contractRegistry.registerAddress(gasPriceLimitId, gasPriceLimit.address);

        let formula = await BancorFormula.new();
        let formulaId = await contractIds.BANCOR_FORMULA.call();
        await contractRegistry.registerAddress(formulaId, formula.address);

        bancorNetwork = await BancorNetwork.new(contractRegistry.address);
        let bancorNetworkId = await contractIds.BANCOR_NETWORK.call();
        await contractRegistry.registerAddress(bancorNetworkId, bancorNetwork.address);
        await bancorNetwork.setSignerAddress(accounts[0]);

        bancor = await FinancieBancorConverter.new(
            smartToken.address,
            currencyToken.address,
            cardToken.address,
            hero_id,
            "0x46a254FD6134eA0f564D07A305C0Db119a858d66",
            contractRegistry.address,
            financieNotifier.address,
            15000,
            15000,
            10000,
            internalWallet.address
          );
        await managedContracts.activateTargetContract(bancor.address, true);

        console.log('[FinancieBancorConverter]begin setup');

        currencyToken.issue(accounts[0], 2 * (10 ** 5));

        bancor.addConnector(currencyToken.address, 10000, false);

        currencyToken.transfer(bancor.address, 2 * (10 ** 5));

        await smartToken.issue(bancor.address, 1000000 * (10 ** 5));

        let balanceOfCurrencyToken = await currencyToken.balanceOf(bancor.address);
        assert.equal(200000, balanceOfCurrencyToken);

        cardToken.transfer(bancor.address, 20000 * (10 ** 5));

        smartToken.transferOwnership(bancor.address);

        await bancor.acceptTokenOwnership();

        await bancor.startTrading();

        let connectorTokenCount = await bancor.connectorTokenCount();
        assert.equal(2, connectorTokenCount);

        console.log('[FinancieBancorConverter]end setup');
    });

    it('setBalanceOfToken/getBalanceOfToken', async () => {

        await internalBank.setBalanceOfToken(cardToken.address, user_id, 2);
        console.log('setBalanceOfToken OK');

        let amount = await internalBank.getBalanceOfToken(cardToken.address, user_id);

        console.log('getBalanceOfToken OK');

        assert.equal(amount.toFixed(),2);
    });

    it('setHolderOfToken/getHolderOfToken', async () => {

        await internalBank.setHolderOfToken(cardToken.address, user_id, true);
        console.log('setHolderOfToken OK');

        let flg = await internalBank.getHolderOfToken(cardToken.address, user_id);

        console.log('getHolderOfToken OK');

        assert.equal(flg,true);
    });

    it('setBidsOfAuctions/getBidsOfAuctions', async () => {

        await internalBank.setBidsOfAuctions(auction.address, user_id, 1000);
        console.log('setBidsOfAuctions OK');

        let amount = await internalBank.getBidsOfAuctions(auction.address, user_id);

        console.log('getBidsOfAuctions OK');

        assert.equal(amount.toFixed(),1000);
    });

    it('setTotalBidsOfAuctions/getTotalBidsOfAuctions', async () => {

        await internalBank.setTotalBidsOfAuctions(auction.address, 10000);
        console.log('setTotalBidsOfAuctions OK');

        let amount = await internalBank.getTotalBidsOfAuctions(auction.address);

        console.log('getTotalBidsOfAuctions OK');

        assert.equal(amount.toFixed(),10000);
    });

    it('setRecvCardsOfAuctions/getRecvCardsOfAuctions', async () => {

        await internalBank.setRecvCardsOfAuctions(auction.address, 100000);
        console.log('setRecvCardsOfAuctions OK');

        let amount = await internalBank.getRecvCardsOfAuctions(auction.address);

        console.log('getRecvCardsOfAuctions OK');

        assert.equal(amount.toFixed(),100000);
    });

});
