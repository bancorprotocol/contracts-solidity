/* global artifacts, contract, before, it, assert */
/* eslint-disable prefer-reflect */

// Bancor components
const SmartToken = artifacts.require('SmartToken.sol');
const EtherToken = artifacts.require('EtherToken.sol');
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
const IFinancieNotifier = artifacts.require('IFinancieNotifier.sol');
const FinancieTicketStore = artifacts.require('FinancieTicketStore.sol');
const FinancieManagedContracts = artifacts.require('FinancieManagedContracts.sol');

const weight10Percent = 100000;
const gasPrice = 22000000000;
const gasPriceBad = 22000000001;

contract('FinancieBancorConverter', (accounts) => {
    let managedContracts;
    let platformToken;
    let etherToken;
    let financieNotifier;
    let cardToken;
    let smartToken;
    let bancor;
    let smartToken1QuickBuyPath;

    before(async () => {
        console.log('[FinancieBancorConverter]initialize');

        contracts = await FinancieManagedContracts.new();
        platformToken = await FinanciePlatformToken.new('PF Token', 'ERC PF', 10000000000 * (10 ** 18));
        etherToken = await EtherToken.new();
        financieNotifier = await FinancieNotifier.new(contracts.address, platformToken.address, etherToken.address);

        cardToken = await FinancieCardToken.new(
            'Financie Card Token',
            'FNCD',
            '0xA0d6B46ab1e40BEfc073E510e92AdB88C0A70c5C',
            financieNotifier.address);

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

        let bancorNetwork = await BancorNetwork.new(contractRegistry.address);
        let bancorNetworkId = await contractIds.BANCOR_NETWORK.call();
        await contractRegistry.registerAddress(bancorNetworkId, bancorNetwork.address);
        await bancorNetwork.setSignerAddress(accounts[0]);
        await bancorNetwork.registerEtherToken(etherToken.address, true);

        bancor = await FinancieBancorConverter.new(
            smartToken.address,
            etherToken.address,
            cardToken.address,
            "0xA0d6B46ab1e40BEfc073E510e92AdB88C0A70c5C",
            "0x46a254FD6134eA0f564D07A305C0Db119a858d66",
            contractRegistry.address,
            financieNotifier.address,
            15000,
            15000,
            10000);

        console.log('[FinancieBancorConverter]begin setup');

        etherToken.sendTransaction({from: accounts[0], value:2 * (10 ** 5)});

        bancor.addConnector(etherToken.address, 10000, false);

        etherToken.transfer(bancor.address, 2 * (10 ** 5));

        await smartToken.issue(bancor.address, 1000000 * (10 ** 5));

        let balanceOfEtherToken = await etherToken.balanceOf(bancor.address);
        assert.equal(200000, balanceOfEtherToken);

        cardToken.transfer(bancor.address, 20000 * (10 ** 5));

        smartToken.transferOwnership(bancor.address);

        await bancor.acceptTokenOwnership();

        await bancor.startTrading();

        let connectorTokenCount = await bancor.connectorTokenCount();
        assert.equal(2, connectorTokenCount);

        console.log('[FinancieBancorConverter]end setup');
    });

    it('sellCards', async () => {
        let amountSellCard = 10000 * (10 ** 5);

        let estimationSell = await bancor.getReturn(cardToken.address, etherToken.address, amountSellCard);
        console.log('[FinancieBancorConverter]estimationSell:' + estimationSell.toFixed());

        await cardToken.approve(bancor.address, amountSellCard);
        console.log('[FinancieBancorConverter]approve cards');

        let allowanceOfCardToken = await cardToken.allowance(accounts[0], bancor.address);
        console.log('[FinancieBancorConverter]allowanceOfCardToken:' + allowanceOfCardToken);

        await bancor.sellCards(amountSellCard, estimationSell, {gasPrice: gasPrice});
        console.log('[FinancieBancorConverter]sell cards');
    });

    it('buyCards', async () => {
        let estimationBuy = await bancor.getReturn(etherToken.address, cardToken.address, 10 ** 5);
        console.log('[FinancieBancorConverter]estimationBuy:' + estimationBuy.toFixed());

        let beforeBuy = await cardToken.balanceOf(accounts[0]);
        console.log('[FinancieBancorConverter]balance of card token before:' + beforeBuy.toFixed());

        await bancor.buyCards(10 ** 5, estimationBuy, {gasPrice: gasPrice, from: accounts[0], value: 10 ** 5});
        console.log('[FinancieBancorConverter]buy cards');

        let afterBuy = await cardToken.balanceOf(accounts[0]);
        console.log('[FinancieBancorConverter]balance of card token after:' + afterBuy.toFixed());

        try {
            await bancor.buyCards(10 ** 5, estimationBuy, {gasPrice: gasPriceBad, from: accounts[0], value: 10 ** 5});
            assert.fail('Should not reach here because of invalid gas price');
        } catch ( e ) {
            // should reach here because of invalid gas price
        }
    });

    it('Confirm that quickConvert() is not executed', async () => {
        smartToken1QuickBuyPath = [etherToken.address, smartToken.address, smartToken.address];
        await bancor.setQuickBuyPath(smartToken1QuickBuyPath);
        let prevBalance = await smartToken.balanceOf.call(accounts[1]);

        try {
          await bancor.quickConvert(smartToken1QuickBuyPath, 100, 1, { from: accounts[1], value: 100 });
        }
        catch (error) {
            assert(true, "exception throw");
        }
    });

    it('Confirm that change() is not executed', async () => {
        try {
          await bancor.change(etherToken.address, bancor.address, 10, 10);
        }
        catch (error) {
            assert(true, "exception throw");
        }
    });
});
