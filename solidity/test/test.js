/* global artifacts, contract, before, it, assert */
/* eslint-disable prefer-reflect */

const FinancieBancorConverter = artifacts.require('FinancieBancorConverter.sol');
const SmartToken = artifacts.require('SmartToken.sol');
const EtherToken = artifacts.require('EtherToken.sol');
const BancorFormula = artifacts.require('BancorFormula.sol');
const BancorGasPriceLimit = artifacts.require('BancorGasPriceLimit.sol');
const BancorQuickConverter = artifacts.require('BancorQuickConverter.sol');
const BancorConverterExtensions = artifacts.require('BancorConverterExtensions.sol');
const FinanciePlatformToken = artifacts.require('FinanciePlatformToken.sol');
const FinancieCardToken = artifacts.require('FinancieCardToken.sol');
const FinancieHeroesDutchAuction = artifacts.require('FinancieHeroesDutchAuction.sol');
const utils = require('./helpers/Utils');

const FinancieNotifier = artifacts.require('FinancieNotifier.sol');
const IFinancieNotifier = artifacts.require('IFinancieNotifier.sol');
const FinancieTicketStore = artifacts.require('FinancieTicketStore.sol');
const FinancieManagedContracts = artifacts.require('FinancieManagedContracts.sol');

const DutchAuction = artifacts.require('DutchAuction.sol');

const weight10Percent = 100000;
const gasPrice = 22000000000;
const gasPriceBad = 22000000001;

var converterExtensionsAddress;
var financieNotifier;
var financieTicketStore;

var platformTokenAddress;
var etherTokenAddress;

var etherToken;
var managedContracts;
var managedContractsAddress;

contract('All', (accounts) => {
    before(async () => {
        // TODO: change to deploy them using "migrations" mechanism

        // initialize platform token (deploy once)
        if ( process.env.ENABLE_UNIT_TEST === undefined && process.env.FINANCIE_PLATFORM_TOKEN_CONTRACT_ADDRESS !== undefined ) {
          let platformToken = FinanciePlatformToken.at(process.env.FINANCIE_PLATFORM_TOKEN_CONTRACT_ADDRESS);
          platformTokenAddress = platformToken.address;
          new Promise(() => console.log('[Unique Components]PF Token(skipped):' + platformTokenAddress));
        } else {
          let platformToken = await FinanciePlatformToken.new('PF Token', 'ERC PF', 10000000000 * (10 ** 18));
          platformTokenAddress = platformToken.address;
          new Promise(() => console.log('[Unique Components]PF Token:' + platformTokenAddress));
        }

        // initialize ether token (deploy once)
        if ( process.env.ENABLE_UNIT_TEST === undefined && process.env.FINANCIE_ETHER_TOKEN_CONTRACT_ADDRESS !== undefined ) {
          etherToken = EtherToken.at(process.env.FINANCIE_ETHER_TOKEN_CONTRACT_ADDRESS);
          etherTokenAddress = etherToken.address;
          new Promise(() => console.log('[Unique Components]Ether Token(skipped):' + etherTokenAddress));
        } else {
          etherToken = await EtherToken.new();
          etherTokenAddress = etherToken.address;
          new Promise(() => console.log('[Unique Components]Ether Token:' + etherTokenAddress));
        }

        // initialize managed contracts (deploy once)
        if ( process.env.ENABLE_UNIT_TEST === undefined && process.env.FINANCIE_MANAGED_CONTRACTS_CONTRACT_ADDRESS !== undefined ) {
          managedContracts = FinancieManagedContracts.at(process.env.FINANCIE_MANAGED_CONTRACTS_CONTRACT_ADDRESS);
          managedContractsAddress = managedContracts.address;
          new Promise(() => console.log('[Unique Components]Managed Contracts(skipped):' + managedContractsAddress));
        } else {
          managedContracts = await FinancieManagedContracts.new();
          await managedContracts.activateTargetContract(platformTokenAddress, true);
          await managedContracts.activateTargetContract(etherTokenAddress, true);
          managedContractsAddress = managedContracts.address;
          new Promise(() => console.log('[Unique Components]Managed Contracts:' + managedContractsAddress));
        }
    });

    it('Deploy non-unique contracts', async () => {
        // initialize bancor extension(upgradable)
        if ( process.env.ENABLE_UNIT_TEST === undefined && process.env.BANCOR_EXTENSIONS_CONTRACT_ADDRESS !== undefined ) {
          let converterExtensions = BancorConverterExtensions.at(process.env.BANCOR_EXTENSIONS_CONTRACT_ADDRESS);
          converterExtensionsAddress = converterExtensions.address;
          new Promise(() => console.log('[Bancor Components]Converter Extension(skipped):' + converterExtensionsAddress));
        } else {
          let formula = await BancorFormula.new();
          new Promise(() => console.log('[Bancor Components]formula:' + formula.address));
          let gasPriceLimit = await BancorGasPriceLimit.new(gasPrice);
          new Promise(() => console.log('[Bancor Components]gasPriceLimit:' + gasPriceLimit.address));
          let quickConverter = await BancorQuickConverter.new();
          new Promise(() => console.log('[Bancor Components]quickConverter:' + quickConverter.address));
          let converterExtensions = await BancorConverterExtensions.new(formula.address, gasPriceLimit.address, quickConverter.address);
          converterExtensionsAddress = converterExtensions.address;
          new Promise(() => console.log('[Bancor Components]Converter Extension:' + converterExtensionsAddress));

          new Promise(() => console.log('[Bancor Components]registerEtherToken...:' + etherTokenAddress));
          await quickConverter.registerEtherToken(etherTokenAddress, true);
          new Promise(() => console.log('[Bancor Components]registerEtherToken OK'));
        }

        // initialize financie notifier(upgradable)
        if ( process.env.ENABLE_UNIT_TEST === undefined && process.env.FINANCIE_NOTIFIER_CONTRACT_ADDRESS !== undefined ) {
          financieNotifier = await FinancieNotifier.at(process.env.FINANCIE_NOTIFIER_CONTRACT_ADDRESS);
          new Promise(() => console.log('[Financie Notifier]Notifier(Skipped):' + financieNotifier.address));
        } else {
          financieNotifier = await FinancieNotifier.new(managedContractsAddress, platformTokenAddress, etherTokenAddress);
          new Promise(() => console.log('[Financie Notifier]Notifier:' + financieNotifier.address));
        }

        // notifier migration
        if ( process.env.PREV_FINANCIE_NOTIFIER_CONTRACT_ADDRESS !== undefined ) {
          prevFinancieNotifier = await IFinancieNotifier.at(process.env.PREV_FINANCIE_NOTIFIER_CONTRACT_ADDRESS);
          await prevFinancieNotifier.setLatestNotifier(financieNotifier.address);
          new Promise(() => console.log('[Financie Notifier]Old notifier address:' + prevFinancieNotifier.address));

          let latestNotifier = await financieNotifier.latestNotifier.call();
          new Promise(() => console.log('[Financie Notifier]New notifier address:' + latestNotifier));
        }

        // initialize financie ticket store(non-upgradable)
        if ( process.env.ENABLE_UNIT_TEST === undefined && process.env.FINANCIE_TICKET_STORE_CONTRACT_ADDRESS !== undefined ) {
          financieTicketStore = FinancieTicketStore.at(process.env.FINANCIE_TICKET_STORE_CONTRACT_ADDRESS);
          new Promise(() => console.log('[Financie Ticket Store]Store(Skipped):' + financieTicketStore.address));
        } else {
          financieTicketStore = await FinancieTicketStore.new(financieNotifier.address, managedContractsAddress, platformTokenAddress, etherTokenAddress);
          new Promise(() => console.log('[Financie Ticket Store]Store:' + financieTicketStore.address));
        }
    });

    if ( process.env.ENABLE_UNIT_TEST !== undefined ) {
        it('Test Notifier', async () => {
            let financieNotifier = await FinancieNotifier.new(managedContractsAddress, platformTokenAddress, etherTokenAddress);
            let newFinancieNotifier = await FinancieNotifier.new(managedContractsAddress, platformTokenAddress, etherTokenAddress);
            await financieNotifier.setLatestNotifier(newFinancieNotifier.address);
            let latest = await financieNotifier.latestNotifier.call();;
            assert.equal(latest, newFinancieNotifier.address);
        })

        it('Test Auction', async () => {
            let cardToken = await FinancieCardToken.new(
                'Financie Card Token',
                'FNCD',
                '0xA0d6B46ab1e40BEfc073E510e92AdB88C0A70c5C',
                financieNotifier.address);

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

        it('Test Bancor', async () => {
            let cardToken = await FinancieCardToken.new(
                'Financie Card Token',
                'FNCD',
                '0xA0d6B46ab1e40BEfc073E510e92AdB88C0A70c5C',
                financieNotifier.address);

            new Promise(() => console.log('[Test Bancor]card:' + cardToken.address));

            let smartToken = await SmartToken.new('Token1', 'TKN', 0);
            new Promise(() => console.log('[Test Bancor]smartToken:' + smartToken.address));

            let bancor = await FinancieBancorConverter.new(
                smartToken.address,
                etherTokenAddress,
                cardToken.address,
                "0xA0d6B46ab1e40BEfc073E510e92AdB88C0A70c5C",
                "0x46a254FD6134eA0f564D07A305C0Db119a858d66",
                converterExtensionsAddress,
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

            let estimationBuy = await bancor.getReturn(etherToken.address, cardToken.address, 10 ** 10);
            console.log('[Test Bancor]estimationBuy:' + estimationBuy);

            /*
            TODO: Following test is not stable (though there is no RNG factor...)
            await bancor.buyCards(10 ** 10, estimationBuy, {from: accounts[0], value: 10 ** 10});
            console.log('[Test Bancor]buy cards');

            let estimationSell = await bancor.getReturn(cardToken.address, etherToken.address, estimationBuy);
            console.log('[Test Bancor]estimationSell:' + estimationSell);

            await cardToken.approve(bancor.address, estimationBuy);
            console.log('[Test Bancor]approve cards');

            let allowanceOfCardToken = await cardToken.allowance(accounts[0], bancor.address);
            console.log('[Test Bancor]bancor allowance of card token:' + allowanceOfCardToken);

            await bancor.sellCards(estimationBuy, estimationSell);
            console.log('[Test Bancor]sell cards');
            */
        });
    }
});

contract('Contract finished', (accounts) => {
    it('all process finished', async () => {
        process.exit(0);
    });
});
