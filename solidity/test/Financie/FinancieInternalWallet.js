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

const FinancieInternalBank = artifacts.require('FinancieInternalBank.sol');
const FinancieInternalWallet = artifacts.require('FinancieInternalWallet.sol');

const weight10Percent = 100000;
const gasPrice = 22000000000;
const gasPriceBad = 22000000001;

contract('FinancieInternalWallet', (accounts) => {
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

    let auction;

    let transactionFee;

    const hero_id = 100;
    const user_id = 1;
    const user_id_noone = 2;

    before(async () => {
        console.log('[FinancieInternalWallet]initialize');
        currencyToken = await SmartToken.new('Test', 'TST', 18);
        internalBank = await FinancieInternalBank.new(
            currencyToken.address
        );
        internalWallet = await FinancieInternalWallet.new(
            "0xA0d6B46ab1e40BEfc073E510e92AdB88C0A70c5C",
            currencyToken.address
        );
        await internalBank.transferOwnership(internalWallet.address);
        await internalWallet.setInternalBank(internalBank.address);
        transactionFee = web3.toWei("50", "ether");
        console.log('transaction fee:' + transactionFee);
        await internalWallet.setTransactionFee(transactionFee);

        console.log('[FinancieHeroesDutchAuction]initialize');

        managedContracts = await FinancieManagedContracts.new();
        platformToken = await FinanciePlatformToken.new('PF Token', 'ERC PF', web3.toWei("10000000000", "ether"));
        financieNotifier = await FinancieNotifier.new(managedContracts.address, platformToken.address, currencyToken.address);

        cardToken = await FinancieCardToken.new(
            'Financie Card Token',
            'FNCD',
            hero_id,
            financieNotifier.address
        );

        new Promise(() => console.log('[FinancieHeroesDutchAuction]card:' + cardToken.address));
        await managedContracts.activateTargetContract(cardToken.address, true);

        auction = await FinancieHeroesDutchAuction.new(
            hero_id,
            '0x46a254FD6134eA0f564D07A305C0Db119a858d66',
            accounts[0],
            1000000 / 10,
            0x1bc16d674ec80000 * 10,
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

        await cardToken.transfer(auction.address, web3.toWei("200000", "ether"));
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

        console.log('[FinancieBancorConverter]initialize');

        smartToken = await SmartToken.new('Token1', 'TKN', 0);

        let contractRegistry = await ContractRegistry.new();
        let contractIds = await ContractIds.new();

        let contractFeatures = await ContractFeatures.new();
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

    it('delegateBid/Receive', async () => {
        let bidAmount = new web3.BigNumber(web3.toWei("10000", "ether"));
        totalAmount = bidAmount.add(transactionFee * 2);
        issueAmount = totalAmount.add(transactionFee);
        console.log('bidAmount:' + bidAmount.toFixed());

        let currencyBeforeDeposit = await internalWallet.getBalanceOfConsumableCurrencyToken(user_id);
        console.log('[FinancieInternalWallet]currencyBeforeDeposit(user_id) ' + currencyBeforeDeposit.toFixed());
        assert.equal(0 , currencyBeforeDeposit.toFixed());

        await currencyToken.issue(accounts[0], issueAmount);
        await currencyToken.approve(internalWallet.address, issueAmount);
        await internalWallet.depositConsumableCurrencyTokens(user_id, totalAmount);

        let currencyBeforeBidding = await currencyToken.balanceOf(internalBank.address);
        console.log('[FinancieInternalWallet]total currencyBeforeBidding(total) ' + currencyBeforeBidding.toFixed());

        currencyBeforeBidding = await internalWallet.getBalanceOfConsumableCurrencyToken(user_id);
        console.log('[FinancieInternalWallet]currencyBeforeBidding(user_id) ' + currencyBeforeBidding.toFixed());

        await internalWallet.delegateBidCards(user_id, bidAmount, auction.address);
        console.log('[FinancieInternalWallet]delegateBid OK');

        let estimationTokens = await internalWallet.delegateEstimateClaimTokens(user_id, auction.address);
        console.log('[FinancieInternalWallet]delegateEstimateClaimTokens:' + estimationTokens.toFixed());
        // bid 10000, initial price is 20, then it should be 500(=10000/20)
        assert.equal(web3.toWei("500", "ether"), estimationTokens.toFixed());

        let currencyAfterBidding = await internalWallet.getBalanceOfConsumableCurrencyToken(user_id);
        console.log('[FinancieInternalWallet]currencyAfterBidding(user_id) ' + currencyAfterBidding.toFixed());
        assert.equal(0 , currencyAfterBidding.toFixed());

        currencyAfterBidding = await currencyToken.balanceOf(internalBank.address);
        console.log('[FinancieInternalWallet]total currencyAfterBidding ' + currencyAfterBidding.toFixed());

        bidAmount = await auction.missingFundsToEndAuction();
        totalAmount = bidAmount.add(transactionFee * 2);
        issueAmount = totalAmount.add(transactionFee);
        console.log('[FinancieInternalWallet]missingFund ' + bidAmount.toFixed());

        await currencyToken.issue(accounts[0], issueAmount);
        await currencyToken.approve(internalWallet.address, issueAmount);
        await internalWallet.depositConsumableCurrencyTokens(user_id_noone, totalAmount);

        let currencyBeforeBidding2 = await currencyToken.balanceOf(internalBank.address);
        console.log('[FinancieInternalWallet]total currencyBeforeBidding2 ' + currencyBeforeBidding2.toFixed());

        await internalWallet.delegateBidCards(user_id_noone, bidAmount, auction.address);

        // User:user_id didn't raise funds, so it should be still 5000
        estimationTokens = await internalWallet.delegateEstimateClaimTokens(user_id, auction.address);
        console.log('[FinancieInternalWallet]delegateEstimateClaimTokens:' + estimationTokens.toFixed());
        assert.equal(web3.toWei("500", "ether"), estimationTokens.toFixed());

        currencyAfterBidding = await internalWallet.getBalanceOfConsumableCurrencyToken(user_id_noone);
        console.log('[FinancieInternalWallet]currencyAfterBidding(user_id_noone) ' + currencyAfterBidding.toFixed());
        assert.equal(0 , currencyAfterBidding);

        let currencyAfterBidding2 = await currencyToken.balanceOf(internalBank.address);
        console.log('[FinancieInternalWallet]total currencyAfterBidding2 ' + currencyAfterBidding2.toFixed());

        try {
            await internalWallet.delegateReceiveCards(user_id, auction.address);
            assert(false, "exception not thrown / not finalized");
        }
        catch ( error ) {
            assert(true, "exception throw");
        }

        await auction.finalizeAuction();
        console.log('[FinancieInternalWallet]finalize OK');

        // User:user_id didn't raise funds still
        estimationTokens = await internalWallet.delegateEstimateClaimTokens(user_id, auction.address);
        console.log('[FinancieInternalWallet]delegateEstimateClaimTokens(user_id):' + estimationTokens.toFixed());
        assert.equal(web3.toWei("500", "ether"), estimationTokens.toFixed());

        // User:user_id_noone raised funds
        estimationTokens = await internalWallet.delegateEstimateClaimTokens(user_id_noone, auction.address);
        console.log('[FinancieInternalWallet]delegateEstimateClaimTokens(user_id_noone):' + estimationTokens.toFixed());
        assert.equal(web3.toWei("199500", "ether"), estimationTokens.toFixed());

        let beforeClaim = await cardToken.balanceOf(internalBank.address);
        console.log('[FinancieInternalWallet]balance of card token before claiming:' + beforeClaim.toFixed());

        function timeout(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }
        await timeout(1000);

        let canClaim = await auction.canClaimTokens(internalBank.address);
        console.log('[FinancieInternalWallet]can claim:' + canClaim.toString());

        try {
            await internalWallet.delegateReceiveCards(user_id, auction.address);
            console.log('[FinancieInternalWallet]delegateReceive OK(user_id)');
        }
        catch ( error ) {
            assert(false, "enough time after finalized(user_id)");
        }

        canClaim = await auction.canClaimTokens(internalBank.address);
        console.log('[FinancieInternalWallet]can claim after first one received:' + canClaim.toString());

        // User:user_id_noone didn't receive cards
        estimationTokens = await internalWallet.delegateEstimateClaimTokens(user_id_noone, auction.address);
        console.log('[FinancieInternalWallet]delegateEstimateClaimTokens after first one received (user_id_noone):' + estimationTokens.toFixed());
        assert.equal(web3.toWei("199500", "ether"), estimationTokens.toFixed());

        try {
            await internalWallet.delegateReceiveCards(user_id_noone, auction.address);
            console.log('[FinancieInternalWallet]delegateReceive OK(user_id_noone)');
        }
        catch ( error ) {
            assert(false, "enough time after finalized(user_id_noone)");
        }

        let afterClaim = await cardToken.balanceOf(internalBank.address);
        console.log('[FinancieInternalWallet]balance of card token after claiming:' + afterClaim.toFixed());

        let receivedAmount = await internalWallet.getBalanceOfToken(cardToken.address, user_id);
        assert.equal(web3.toWei("500", "ether"), receivedAmount.toFixed());

        receivedAmount = await internalWallet.getBalanceOfToken(cardToken.address, user_id_noone);
        assert.equal(web3.toWei("199500", "ether"), receivedAmount.toFixed());

        // User:user_id/user_id_noone had already received tokens
        estimationTokens = await internalWallet.delegateEstimateClaimTokens(user_id, auction.address);
        console.log('[FinancieInternalWallet]delegateEstimateClaimTokens(user_id):' + estimationTokens.toFixed());
        assert.equal(0, estimationTokens.toFixed());

        estimationTokens = await internalWallet.delegateEstimateClaimTokens(user_id_noone, auction.address);
        console.log('[FinancieInternalWallet]delegateEstimateClaimTokens(user_id_noone):' + estimationTokens.toFixed());
        assert.equal(0, estimationTokens.toFixed());

        await internalWallet.withdrawTokens(user_id, web3.toWei("500", "ether"), cardToken.address);
        // 200000 - 500 = 199500 for "no one" user
        await internalWallet.withdrawTokens(user_id_noone, web3.toWei("199500", "ether"), cardToken.address);

        let afterWithdrawal = await cardToken.balanceOf(internalBank.address);
        console.log('[FinancieInternalWallet]balance of card token after withdrawal:' + afterWithdrawal.toFixed());
    });

    it('delegateWithdrawalAfterAuction', async () => {
        let currencyBeforeWithdrawal = await currencyToken.balanceOf(internalBank.address);
        console.log('[FinancieInternalWallet]currencyBeforeWithdrawal(internalBank) ' + currencyBeforeWithdrawal.toFixed());

        currencyBeforeWithdrawal = await internalWallet.getBalanceOfPendingRevenueCurrencyToken(hero_id);
        console.log('[FinancieInternalWallet]currencyBeforeWithdrawal(hero_id) ' + currencyBeforeWithdrawal.toFixed());

        let balance = currencyBeforeWithdrawal.sub(transactionFee);
        await internalWallet.withdrawPendingRevenueCurrencyTokens(hero_id, balance);

        let currencyAfterWithdrawal = await currencyToken.balanceOf(internalBank.address);
        console.log('[FinancieInternalWallet]currencyAfterWithdrawal(internalBank) ' + currencyAfterWithdrawal.toFixed());

        currencyAfterWithdrawal = await internalWallet.getBalanceOfPendingRevenueCurrencyToken(hero_id);
        console.log('[FinancieInternalWallet]currencyAfterWithdrawal(hero_id) ' + currencyAfterWithdrawal.toFixed());
        assert.equal(0, currencyAfterWithdrawal.toFixed());
    });

    it('delegateBuy/Sell', async () => {
        let currencyBeforeTesting = await currencyToken.balanceOf(internalBank.address);
        console.log('[FinancieInternalWallet]total currencyBeforeTesting ' + currencyBeforeTesting.toFixed());
        assert.equal(0, currencyBeforeTesting.toFixed());

        let buyAmount = new web3.BigNumber(web3.toWei("10000", "ether"));
        let totalAmount = buyAmount.add(transactionFee);
        let issueAmount = totalAmount.add(transactionFee);

        await currencyToken.issue(accounts[0], issueAmount);
        await currencyToken.approve(internalWallet.address, issueAmount);
        await internalWallet.depositConsumableCurrencyTokens(user_id, totalAmount);

        [estimationBuy, fee] = await bancor.getReturn(currencyToken.address, cardToken.address, buyAmount);
        console.log('[FinancieInternalWallet]estimationBuy ' + estimationBuy + ' / ' + fee);

        let beforeBuy = await cardToken.balanceOf(internalWallet.address);
        console.log('[FinancieInternalWallet]balance of card token before buying:' + beforeBuy.toFixed());
        assert.equal(0, beforeBuy);

        let currencyBeforeBuy = await currencyToken.balanceOf(internalBank.address);
        console.log('[FinancieInternalWallet]total currencyBeforeBuy ' + currencyBeforeBuy.toFixed());
        assert.equal(totalAmount.toFixed(), currencyBeforeBuy.toFixed());

        await internalWallet.delegateBuyCards(user_id, buyAmount, estimationBuy, cardToken.address, bancor.address, {gasPrice: gasPrice});
        console.log('[FinancieInternalWallet]delegateBuy OK/100000');

        let afterBuy = await cardToken.balanceOf(internalBank.address);
        console.log('[FinancieInternalWallet]balance of card token after buying:' + afterBuy.toFixed());
        assert.equal(estimationBuy.toFixed(), afterBuy.toFixed());

        let balance = await internalWallet.getBalanceOfToken(cardToken.address, user_id);

        let currencyAfterBuy = await currencyToken.balanceOf(internalBank.address);
        console.log('[FinancieInternalWallet]total currencyAfterBuy ' + currencyAfterBuy.toFixed());
        assert.equal(web3.toWei('150', 'ether'), currencyAfterBuy.toFixed());

        currencyBeforeSell = await internalWallet.getBalanceOfWithdrawableCurrencyToken(user_id);
        console.log('[FinancieInternalWallet]user currencyBeforeSell ' + currencyBeforeSell.toFixed());
        assert.equal(0, currencyBeforeSell.toFixed());

        [estimationSell, fee] = await bancor.getReturn(cardToken.address, currencyToken.address, balance);
        console.log('[FinancieInternalWallet]estimationSell ' + estimationSell + ' / ' + fee);

        await internalWallet.delegateSellCards(user_id, balance, 1, cardToken.address, bancor.address, {gasPrice: gasPrice});
        console.log('[FinancieInternalWallet]delegateSell OK/' + balance);

        let afterSell = await cardToken.balanceOf(internalBank.address);
        console.log('[FinancieInternalWallet]balance of card token after selling:' + afterSell.toFixed());

        let currencyAfterSell = await internalWallet.getBalanceOfWithdrawableCurrencyToken(user_id);
        console.log('[FinancieInternalWallet]user currencyAfterSell ' + currencyAfterSell.toFixed());

        let netSales = estimationSell.sub(currencyAfterSell);
        assert.equal(netSales, transactionFee);
    });

    it('delegateWithdrawalAfterBuySell', async () => {
        let currencyBeforeWithdrawal = await currencyToken.balanceOf(internalBank.address);
        console.log('[FinancieInternalWallet]currencyBeforeWithdrawal(internalBank) ' + currencyBeforeWithdrawal.toFixed());

        currencyBeforeWithdrawal = await internalWallet.getBalanceOfWithdrawableCurrencyToken(user_id_noone);
        console.log('[FinancieInternalWallet]currencyBeforeWithdrawal(user_id_noone) ' + currencyBeforeWithdrawal.toFixed());
        assert.equal(0, currencyBeforeWithdrawal.toFixed());

        currencyBeforeWithdrawal = await internalWallet.getBalanceOfWithdrawableCurrencyToken(user_id);
        console.log('[FinancieInternalWallet]currencyBeforeWithdrawal(user_id) ' + currencyBeforeWithdrawal.toFixed());

        let balance = currencyBeforeWithdrawal.sub(transactionFee);
        await internalWallet.withdrawCurrencyTokens(user_id, balance);

        currencyBeforeWithdrawal = await internalWallet.getBalanceOfWithdrawableCurrencyToken(hero_id);
        console.log('[FinancieInternalWallet]currencyBeforeWithdrawal(hero_id) ' + currencyBeforeWithdrawal.toFixed());

        balance = currencyBeforeWithdrawal.sub(transactionFee)
        await internalWallet.withdrawCurrencyTokens(hero_id, balance);

        let currencyAfterWithdrawal = await currencyToken.balanceOf(internalBank.address);
        console.log('[FinancieInternalWallet]currencyAfterWithdrawal(internalBank) ' + currencyAfterWithdrawal.toFixed());
        assert.equal(0, currencyAfterWithdrawal.toFixed());

        currencyAfterWithdrawal = await internalWallet.getBalanceOfWithdrawableCurrencyToken(user_id);
        console.log('[FinancieInternalWallet]currencyAfterWithdrawal(user_id) ' + currencyAfterWithdrawal.toFixed());
        assert.equal(0, currencyAfterWithdrawal.toFixed());

        currencyAfterWithdrawal = await internalWallet.getBalanceOfWithdrawableCurrencyToken(hero_id);
        console.log('[FinancieInternalWallet]currencyAfterWithdrawal(hero_id) ' + currencyAfterWithdrawal.toFixed());
        assert.equal(0, currencyAfterWithdrawal.toFixed());
    });
});
