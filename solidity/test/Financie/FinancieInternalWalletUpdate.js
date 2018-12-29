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
const FinancieInternalWalletUpdate = artifacts.require('FinancieInternalWalletUpgrade.sol');
const FinancieInternalWalletFactory = artifacts.require('FinancieInternalWalletFactory.sol');

const weight10Percent = 100000;
const gasPrice = 22000000000;
const gasPriceBad = 22000000001;

contract('FinancieInternalWalletData', (accounts) => {
    let internalWallet;
    let internalNewWallet;
    let internalWalletUpgrade;
    let internalWalletFactory;

    let managedContracts;
    let platformToken;
    let currencyToken;
    let financieNotifier;
    let cardToken;
    let smartToken;
    let bancor;
    let bancorNetwork;

    let auction;

    const hero_id = 100;
    const user_id = 1;
    const user_id_noone = 2;
    const team_wallet = "0xA0d6B46ab1e40BEfc073E510e92AdB88C0A70c5C";

    before(async () => {
        console.log('[FinancieHeroesDutchAuction]initialize');

        managedContracts = await FinancieManagedContracts.new();
        platformToken = await FinanciePlatformToken.new('PF Token', 'ERC PF', 10000000000 * (10 ** 18));
        currencyToken = await SmartToken.new('Test', 'TST', 18);
        financieNotifier = await FinancieNotifier.new(managedContracts.address, platformToken.address, currencyToken.address);

        console.log('[FinancieInternalBank]initialize');
        internalWalletData = await FinancieInternalBank.new();
        console.log(internalWalletData.address);

        console.log('[FinancieInternalWallet]initialize');
        internalWallet = await FinancieInternalWallet.new(team_wallet, currencyToken.address);
        await internalWalletData.transferOwnership(internalWallet.address);
        await internalWallet.setInternalBank(internalWalletData.address);
        internalWalletFactory = await FinancieInternalWalletFactory.new();
        internalWalletUpgrade = await FinancieInternalWalletUpdate.new(internalWalletFactory.address, team_wallet, currencyToken.address, internalWalletData.address);


        cardToken = await FinancieCardToken.new(
            'Financie Card Token',
            'FNCD',
            '0xA0d6B46ab1e40BEfc073E510e92AdB88C0A70c5C',
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
            "0xA0d6B46ab1e40BEfc073E510e92AdB88C0A70c5C",
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

    it('verfy bank upgrade', async () => {
      await currencyToken.issue(accounts[0], 1 * (10 ** 5));
      await currencyToken.approve(internalWallet.address, 1 * (10 ** 5));
      await internalWallet.depositTokens(user_id, 1 * (10 ** 5), currencyToken.address);

      [estimationBuy, fee] = await bancor.getReturn(currencyToken.address, cardToken.address, 10 ** 5);
      console.log('[FinancieInternalWallet]estimationBuy ' + estimationBuy + ' / ' + fee);

      let beforeBuy = await cardToken.balanceOf(internalWallet.address);
      console.log('[FinancieInternalWallet]balance of card token before buying:' + beforeBuy.toFixed());
      assert.equal(0, beforeBuy);

      let currencyBeforeBuy = await currencyToken.balanceOf(internalWalletData.address);
      console.log('[FinancieInternalWallet]total currencyBeforeBuy ' + currencyBeforeBuy.toFixed());
      assert.equal(10 ** 5, currencyBeforeBuy.toFixed());

      await internalWallet.delegateBuyCards(user_id, 1 * (10 ** 5), estimationBuy, cardToken.address, bancor.address, {gasPrice: gasPrice});
      console.log('[FinancieInternalWallet]delegateBuy OK/100000');

      let afterBuy = await cardToken.balanceOf(internalWalletData.address);
      console.log('[FinancieInternalWallet]balance of card token after buying:' + afterBuy.toFixed());
      assert.equal(estimationBuy.toFixed(), afterBuy.toFixed());

      let balance = await internalWallet.getBalanceOfToken(cardToken.address, user_id);

      let currencyAfterBuy = await currencyToken.balanceOf(internalWalletData.address);
      console.log('[FinancieInternalWallet]total currencyAfterBuy ' + currencyAfterBuy.toFixed());
      assert.equal(1500, currencyAfterBuy.toFixed());

      currencyBeforeSell = await internalWallet.getBalanceOfToken(currencyToken.address, user_id);
      console.log('[FinancieInternalWallet]user currencyBeforeSell ' + currencyBeforeSell.toFixed());
      assert.equal(0, currencyBeforeSell.toFixed());

      [estimationSell, fee] = await bancor.getReturn(cardToken.address, currencyToken.address, balance);
      console.log('[FinancieInternalWallet]estimationSell ' + estimationSell + ' / ' + fee);

      await internalWallet.delegateSellCards(user_id, balance, 1, cardToken.address, bancor.address, {gasPrice: gasPrice});
      console.log('[FinancieInternalWallet]delegateSell OK/' + balance);

      let afterSell = await cardToken.balanceOf(internalWalletData.address);
      console.log('[FinancieInternalWallet]balance of card token after selling:' + afterSell.toFixed());

      let currencyAfterSell = await internalWallet.getBalanceOfToken(currencyToken.address, user_id);
      console.log('[FinancieInternalWallet]user currencyAfterSell ' + currencyAfterSell.toFixed());
      assert.equal(estimationSell.toFixed(), currencyAfterSell.toFixed());

        let old_num1 = await internalWallet.getBalanceOfToken(cardToken.address, user_id);
        console.log("old_owner=" + old_num1.toFixed());
        let old_num2 = await internalWallet.getBalanceOfToken(currencyToken.address, user_id);
        let old_owner = await internalWalletData.owner();

        internalWallet.transferOwnership(internalWalletUpgrade.address);

        console.log("old_owner=" + old_owner);
        console.log("old_owner=" + internalWallet.address);
        let upgradeRes = await internalWalletUpgrade.upgrade(internalWallet.address);
        await internalWallet.acceptOwnership();
        console.log(upgradeRes.logs);
        console.log(upgradeRes.logs[3]);

        internalNewWallet = FinancieInternalWallet.at(upgradeRes.logs[4].args._newWallet);
        await internalNewWallet.acceptOwnership();

        let new_num1 = await internalNewWallet.getBalanceOfToken(cardToken.address, user_id);
        let new_num2 = await internalNewWallet.getBalanceOfToken(currencyToken.address, user_id);


        assert.equal(new_num1.toFixed(), old_num1.toFixed());
        assert.equal(new_num2.toFixed(), old_num2.toFixed());

        try {
            await await internalWallet.getBalanceOfToken(cardToken.address, user_id);
            assert(false, "exception not thrown / not finalized");
        }
        catch ( error ) {
            assert(true, "exception throw");
        }

        try {
            await await internalNewWallet.getBalanceOfToken(currencyToken.address, user_id);
            assert(false, "exception not thrown / not finalized");
        }
        catch ( error ) {
            assert(true, "exception throw");
        }
    });



});
