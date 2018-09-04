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

contract('All', (accounts) => {
    it('Test Notifier', async () => {
        let financieNotifier = await FinancieNotifier.new(FinancieManagedContracts.address, FinanciePlatformToken.address, EtherToken.address);
        let newFinancieNotifier = await FinancieNotifier.new(FinancieManagedContracts.address, FinanciePlatformToken.address, EtherToken.address);
        await financieNotifier.setLatestNotifier(newFinancieNotifier.address);
        let latest = await financieNotifier.latestNotifier.call();;
        assert.equal(latest, newFinancieNotifier.address);
    })

    it('Test Auction', async () => {
        let cardToken = await FinancieCardToken.new(
            'Financie Card Token',
            'FNCD',
            '0xA0d6B46ab1e40BEfc073E510e92AdB88C0A70c5C',
            FinancieNotifier.address);

        new Promise(() => console.log('[Test Auction]card:' + cardToken.address));

        let auction = await FinancieHeroesDutchAuction.new(
            '0xA0d6B46ab1e40BEfc073E510e92AdB88C0A70c5C',
            '0x46a254FD6134eA0f564D07A305C0Db119a858d66',
            accounts[0],
            1000000 / 10,
            0x1bc16d674ec80000 / 10000,
            0x5ddb1980,
            3,
            financieNotifier.address);

        new Promise(() => console.log('[Test Auction]auction:' + auction.address));

        console.log('[Test Auction]begin setup');

        await managedContracts.activateTargetContract(cardToken.address, true);
        console.log('[Test Auction]activateTargetContract card OK');

        await cardToken.transfer(auction.address, 200000 * (10 ** 18));
        console.log('[Test Auction]card transfer to auction OK');

        await auction.setup(cardToken.address);
        console.log('[Test Auction]setup OK');

        await auction.startAuction();
        console.log('[Test Auction]start OK');

        await managedContracts.activateTargetContract(auction.address, true);
        console.log('[Test Auction]activateTargetContract auction OK');

        let stage = await auction.stage();
        console.log('[Test Auction]stage:' + stage);
        assert.equal(2, stage);

        await auction.sendTransaction({from: accounts[0], value:40 * (10 ** 18)});
        console.log('[Test Auction]bid OK');

        console.log('[Test Auction]end setup');
    });

    /**
    // for debug deployed contract
    it('Test Bancor', async () => {
        let cardToken = await FinancieCardToken.at('0x49e67a3b162b860947a2333d57f0a7787506dc88');

        new Promise(() => console.log('[Test Bancor]card:' + cardToken.address));

        let bancor = await FinancieBancorConverter.at('0xdda35df3524d1db9f6356f93fe660fa690e235f6');
        new Promise(() => console.log('[Test Bancor]bancor:' + bancor.address));

        let before = await cardToken.balanceOf(accounts[0]);
        console.log('[Test Bancor]sender balance of card token:' + before);

        let quickSellPathFrom = await bancor.quickSellPath(0);
        console.log('[Test Bancor]quick sell path from:' + quickSellPathFrom);

        let quickSellPathTo = await bancor.quickSellPath(2);
        console.log('[Test Bancor]quick sell path to:' + quickSellPathTo);

        try {
          await bancor.buyCards(10 ** 18, 1, {gasPrice: gasPrice, from: accounts[0], value: 10 ** 18});
          console.log('[Test Bancor]buy cards');
        } catch ( e ) {
          console.log(e);
        }

        let after = await cardToken.balanceOf(accounts[0]);
        console.log('[Test Bancor]sender balance of card token:' + after);

        let amountSellCard = 10000 * (10 ** 18)
        await cardToken.approve(bancor.address, amountSellCard);
        console.log('[Test Bancor]approve cards');

        let estimationSell = await bancor.getReturn(quickSellPathFrom, quickSellPathTo, amountSellCard);
        console.log('[Test Bancor]estimationSell:' + (estimationSell * (0.1 ** 18)));

        let allowanceOfCardToken = await cardToken.allowance(accounts[0], bancor.address);
        console.log('[Test Bancor]bancor allowance of card token:' + allowanceOfCardToken);

        await bancor.sellCards(amountSellCard, estimationSell, {gasPrice: gasPrice});
        console.log('[Test Bancor]sell cards');
    });
    */

    it('Test Bancor', async () => {
        let etherToken = EtherToken.new();
        let financieNotifier = await FinancieNotifier.new(FinancieManagedContracts.address, FinanciePlatformToken.address, etherToken.address);
        let cardToken = await FinancieCardToken.new(
            'Financie Card Token',
            'FNCD',
            '0xA0d6B46ab1e40BEfc073E510e92AdB88C0A70c5C',
            FinancieNotifier.address);

        new Promise(() => console.log('[Test Bancor]card:' + cardToken.address));

        let smartToken = await SmartToken.new('Token1', 'TKN', 0);
        new Promise(() => console.log('[Test Bancor]smartToken:' + smartToken.address));

        let bancor = await FinancieBancorConverter.new(
            smartToken.address,
            etherToken.address,
            cardToken.address,
            "0xA0d6B46ab1e40BEfc073E510e92AdB88C0A70c5C",
            "0x46a254FD6134eA0f564D07A305C0Db119a858d66",
            BancorConverterExtensions.address,
            financieNotifier.address,
            15000,
            15000,
            10000);
        new Promise(() => console.log('[Test Bancor]bancor:' + bancor.address));

        console.log('[Test Bancor]begin setup');

        await etherToken.sendTransaction({from: accounts[0], value:2 * (10 ** 18)});
        console.log('[Test Bancor]deposit ether OK');

        await bancor.addConnector(etherToken.address, 10000, false);
        console.log('[Test Bancor]add ether token OK');

        await etherToken.transfer(bancor.address, 2 * (10 ** 18));
        console.log('[Test Bancor]send ether token OK');

        await smartToken.issue(bancor.address, 1000000 * (10 ** 18));
        console.log('[Test Bancor]issue smart token OK');

        let balanceOfEtherToken = await etherToken.balanceOf(bancor.address);
        console.log('[Test Bancor]bancor balance of ether token:' + balanceOfEtherToken);

        await cardToken.transfer(bancor.address, 20000 * (10 ** 18));
        console.log('[Test Bancor]deposit card OK');

        await smartToken.transferOwnership(bancor.address);
        console.log('[Test Bancor]transfer ownership OK');

        await bancor.acceptTokenOwnership();
        console.log('[Test Bancor]accept ownership OK');

        console.log('[Test Bancor]end setup');

        let connectorTokenCount = await bancor.connectorTokenCount();
        console.log('[Test Bancor]connector token count:' + connectorTokenCount);

        let amountSellCard = 10000 * (10 ** 18)

        let estimationSell = await bancor.getReturn(cardToken.address, etherToken.address, amountSellCard);
        console.log('[Test Bancor]estimationSell:' + (estimationSell * (0.1 ** 18)));

        await cardToken.approve(bancor.address, amountSellCard);
        console.log('[Test Bancor]approve cards');

        let allowanceOfCardToken = await cardToken.allowance(accounts[0], bancor.address);
        console.log('[Test Bancor]bancor allowance of card token:' + allowanceOfCardToken);

        await bancor.sellCards(amountSellCard, estimationSell, {gasPrice: gasPrice});
        console.log('[Test Bancor]sell cards');

        let estimationBuy = await bancor.getReturn(etherToken.address, cardToken.address, 10 ** 18);
        console.log('[Test Bancor]estimationBuy:' + (estimationBuy * (0.1 ** 18)));

        let before = await cardToken.balanceOf(accounts[0]);
        console.log('[Test Bancor]bancor balance of card token:' + before);

        try {
          await bancor.buyCards(10 ** 18, estimationBuy, {gasPrice: gasPrice, from: accounts[0], value: 10 ** 18});
          console.log('[Test Bancor]buy cards');
        } catch ( e ) {
          console.log(e);
        }

        let after = await cardToken.balanceOf(accounts[0]);
        console.log('[Test Bancor]bancor balance of card token:' + after);
    });
});

contract('Contract finished', (accounts) => {
    it('all process finished', async () => {
        process.exit(0);
    });
});
