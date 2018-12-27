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
const FinancieNotifier = artifacts.require('FinancieNotifier.sol');
const FinancieManagedContracts = artifacts.require('FinancieManagedContracts.sol');

const FinancieInternalWallet = artifacts.require('FinancieInternalWallet.sol');

const weight10Percent = 100000;
const gasPrice = 22000000000;
const gasPriceBad = 22000000001;

contract('FinancieBancorConverter', (accounts) => {
    const hero_id = 100;
    let managedContracts;
    let platformToken;
    let currencyToken;
    let financieNotifier;
    let cardToken;
    let smartToken;
    let bancor;
    let smartToken1QuickBuyPath;
    let bancorNetwork;

    before(async () => {
        console.log('[FinancieBancorConverter]initialize');

        contracts = await FinancieManagedContracts.new();
        platformToken = await FinanciePlatformToken.new('PF Token', 'ERC PF', 10000000000 * (10 ** 18));
        currencyToken = await SmartToken.new('Test', 'TST', 18);
        financieNotifier = await FinancieNotifier.new(contracts.address, platformToken.address, currencyToken.address);

        cardToken = await FinancieCardToken.new(
            'Financie Card Token',
            'FNCD',
            hero_id,
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

        bancorNetwork = await BancorNetwork.new(contractRegistry.address);
        let bancorNetworkId = await contractIds.BANCOR_NETWORK.call();
        await contractRegistry.registerAddress(bancorNetworkId, bancorNetwork.address);
        await bancorNetwork.setSignerAddress(accounts[0]);

        let internalWallet = await FinancieInternalWallet.new("0xA0d6B46ab1e40BEfc073E510e92AdB88C0A70c5C", currencyToken.address);

        bancor = await FinancieBancorConverter.new(
            smartToken.address,
            currencyToken.address,
            cardToken.address,
            "0xA0d6B46ab1e40BEfc073E510e92AdB88C0A70c5C",
            "0x46a254FD6134eA0f564D07A305C0Db119a858d66",
            contractRegistry.address,
            financieNotifier.address,
            15000,
            15000,
            10000,
            internalWallet.address
        );

        console.log('[FinancieBancorConverter]begin setup');

        await currencyToken.issue(accounts[0], 2 * (10 ** 5));

        await bancor.addConnector(currencyToken.address, 10000, false);

        await currencyToken.transfer(bancor.address, 2 * (10 ** 5));

        await smartToken.issue(bancor.address, 1000000 * (10 ** 5));

        let balanceOfCurrencyToken = await currencyToken.balanceOf(bancor.address);
        assert.equal(200000, balanceOfCurrencyToken);

        await cardToken.transfer(bancor.address, 20000 * (10 ** 5));

        await smartToken.transferOwnership(bancor.address);

        await bancor.acceptTokenOwnership();

        await bancor.startTrading();

        let connectorTokenCount = await bancor.connectorTokenCount();
        assert.equal(2, connectorTokenCount);

        console.log('[FinancieBancorConverter]end setup');
    });

    it('getCrossConnectorReturn', async () => {
      let amount;
      let fee;
      let amountSellCard = 100 * (10 ** 5);

      [amount, fee] = await bancor.getCrossConnectorReturn(cardToken.address, currencyToken.address, amountSellCard);
      console.log('[FinancieBancorConverter]getCrossConnectorReturn amount:' + amount.toFixed());
      console.log('[FinancieBancorConverter]getCrossConnectorReturn fee:' + fee.toFixed());
      console.log(await currencyToken.totalSupply());
    });

    it('sellCards', async () => {
        let amountSellCard = 100 * (10 ** 5);
        let estimationSell;
        let sellFee;

        let smartToken1BuyPath = [currencyToken.address, smartToken.address, cardToken.address];

        [estimationSell,sellFee] = await bancor.getReturn(cardToken.address, currencyToken.address, amountSellCard);
        console.log('[FinancieBancorConverter]estimationSell:' + estimationSell.toFixed());

        await cardToken.approve(bancor.address, amountSellCard);
        console.log('[FinancieBancorConverter]approve cards');

        let allowanceOfCardToken = await cardToken.allowance(accounts[0], bancor.address);
        console.log('[FinancieBancorConverter]allowanceOfCardToken:' + allowanceOfCardToken);

        await bancor.sellCards(amountSellCard, estimationSell, {gasPrice: gasPrice});
        console.log('[FinancieBancorConverter]sell cards');
    });

    it('buyCards', async () => {
        let estimationBuy;
        let Fee;

        await currencyToken.issue(accounts[0], 10 ** 5);

        [estimationBuy, Fee] = await bancor.getReturn(currencyToken.address, cardToken.address, 10 ** 5);
        console.log('[FinancieBancorConverter]estimationBuy:' + estimationBuy.toFixed());

        let beforeBuy = await cardToken.balanceOf(accounts[0]);
        console.log('[FinancieBancorConverter]balance of card token before:' + beforeBuy.toFixed());

        let currencyTokenBefore = await currencyToken.balanceOf(accounts[0]);
        console.log('[FinancieBancorConverter]balance of currency token before:' + currencyTokenBefore.toFixed());

        await currencyToken.approve(bancor.address, 0);
        await currencyToken.approve(bancor.address, 10 ** 5);
        await bancor.buyCards(10 ** 5, estimationBuy, {gasPrice: gasPrice});
        console.log('[FinancieBancorConverter]buy cards');

        let afterBuy = await cardToken.balanceOf(accounts[0]);
        console.log('[FinancieBancorConverter]balance of card token after:' + afterBuy.toFixed());

        try {
            await bancor.buyCards(10 ** 5, estimationBuy, {gasPrice: gasPriceBad});
            assert.fail('Should not reach here because of invalid gas price');
        } catch ( e ) {
            // should reach here because of invalid gas price
        }
    });

    it('Confirm that quickConvert() is not executed', async () => {
        smartToken1QuickBuyPath = [currencyToken.address, smartToken.address, smartToken.address];
        // await bancor.setQuickBuyPath(smartToken1QuickBuyPath);
        let prevBalance = await smartToken.balanceOf.call(accounts[1]);

        try {
            await bancor.quickConvert(smartToken1QuickBuyPath, 100, 1, { from: accounts[1], value: 100 });
            assert(false, "exception not thrown");
        }
        catch (error) {
            assert(true, "exception throw");
        }
    });

    it('Confirm that change() is not executed', async () => {
        try {
            await bancor.change(currencyToken.address, bancor.address, 10, 10);
            assert(false, "exception not thrown");
        }
        catch (error) {
            assert(true, "exception throw");
        }
    });
});
