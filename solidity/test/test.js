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

const FinancieCore = artifacts.require('FinancieCore.sol');
const FinancieLog = artifacts.require('FinancieLog.sol');

const DutchAuction = artifacts.require('DutchAuction.sol');

const weight10Percent = 100000;
const gasPrice = 22000000000;
const gasPriceBad = 22000000001;

let token;
let tokenAddress;
let converterExtensionsAddress;
let platformToken;
let connectorToken;
let connectorToken2;
let platformTokenAddress;
let connectorTokenAddress;
let connectorTokenAddress2;
let converter;
let financieCore;
let quickConverter;
let log;

let etherToken;
let etherTokenAddress;

var auction;
let bancor;
let cardToken;

// used by purchase/sale tests
async function initConverter(accounts, activate, maxConversionFee = 0) {
    platformToken = await FinanciePlatformToken.new('PF Token', 'ERC PF', 10000000000 * (10 ** 18));
    platformTokenAddress = platformToken.address;
    new Promise(() => console.log('[initConverter]PF Token:' + platformTokenAddress));

    etherToken = await EtherToken.new();
    etherTokenAddress = etherToken.address;
    new Promise(() => console.log('[initConverter]Ether Token:' + etherTokenAddress));
}

contract('BancorConverter', (accounts) => {
    before(async () => {
        let formula = await BancorFormula.new();
        let gasPriceLimit = await BancorGasPriceLimit.new(gasPrice);
        quickConverter = await BancorQuickConverter.new();
        let converterExtensions = await BancorConverterExtensions.new(formula.address, gasPriceLimit.address, quickConverter.address);
        converterExtensionsAddress = converterExtensions.address;
        new Promise(() => console.log('[BancorConverter]Converter Extension:' + converterExtensionsAddress));
    });

    it('verifies that getReturn returns a valid amount', async () => {
        converter = await initConverter(accounts, true);
        await quickConverter.registerEtherToken(etherTokenAddress, true);
    });

});

contract('FinancieCore', (accounts) => {
    before(async () => {
        financieCore = await FinancieCore.new(platformTokenAddress, etherTokenAddress);
        await financieCore.activateTargetContract(platformTokenAddress, true);
        await financieCore.activateTargetContract(etherTokenAddress, true);

        log = await FinancieLog.new();

        new Promise(() => console.log('[initFinancie]FinancieCore:' + financieCore.address));
        new Promise(() => console.log('[initFinancie]FinancieLog:' + log.address));
    });

    it('setup financie core', async () => {
        // 実験的販売
        await platformToken.transfer(financieCore.address, 100000000 * (10 ** 18));
        await log.transferOwnership(financieCore.address);
        await financieCore.setFinancieLog(log.address);
    });
});

contract('Test Auction', (accounts) => {
    before(async () => {
        cardToken = await FinancieCardToken.new(
            'Financie Card Token',
            'FNCD',
            '0xA0d6B46ab1e40BEfc073E510e92AdB88C0A70c5C',
            financieCore.address);

        new Promise(() => console.log('[Test Auction]card:' + cardToken.address));

        auction = await FinancieHeroesDutchAuction.new(
            '0xA0d6B46ab1e40BEfc073E510e92AdB88C0A70c5C',
            '0x46a254FD6134eA0f564D07A305C0Db119a858d66',
            accounts[0],
            1000000 / 10,
            0x1bc16d674ec80000 / 10000,
            0x5ddb1980,
            3);

        new Promise(() => console.log('[Test Auction]auction:' + auction.address));
    });

    it('setup auction', async () => {
        console.log('[Test Auction]begin setup');

        await financieCore.activateTargetContract(cardToken.address, true);
        console.log('[Test Auction]activateTargetContract card OK');

        await cardToken.transfer(auction.address, 200000 * (10 ** 18));
        console.log('[Test Auction]card transfer to auction OK');

        await auction.setup(financieCore.address, cardToken.address);
        console.log('[Test Auction]setup OK');

        await auction.startAuction();
        console.log('[Test Auction]start OK');

        await financieCore.activateTargetContract(auction.address, true);
        console.log('[Test Auction]activateTargetContract auction OK');

        let stage = await auction.stage();
        console.log('[Test Auction]stage:' + stage);
        assert.equal(2, stage);

        await auction.sendTransaction({from: accounts[0], value:40 * (10 ** 18)});
        console.log('[Test Auction]bid OK');

        console.log('[Test Auction]end setup');
    });
});

contract('Test Bancor', (accounts) => {
    before(async () => {
        smartToken = await SmartToken.new('Token1', 'TKN', 0);
        new Promise(() => console.log('[Test Bancor]smartToken:' + smartToken.address));

        bancor = await FinancieBancorConverter.new(
            smartToken.address,
            etherTokenAddress,
            cardToken.address,
            "0xA0d6B46ab1e40BEfc073E510e92AdB88C0A70c5C",
            "0x46a254FD6134eA0f564D07A305C0Db119a858d66",
            converterExtensionsAddress,
            financieCore.address,
            15000,
            15000,
            10000);
        new Promise(() => console.log('[Test Bancor]bancor:' + bancor.address));
    });

    it('setup bancor', async () => {
        console.log('[Test Bancor]begin setup');

        await etherToken.sendTransaction({from: accounts[0], value:2 * (10 ** 18)});
        console.log('[Test Bancor]deposit ether OK');

        await smartToken.issue(bancor.address, 1000000 * (10 ** 18));
        console.log('[Test Bancor]issue smart token OK');

        await cardToken.transfer(bancor.address, 20000 * (10 ** 18));
        console.log('[Test Bancor]deposit card OK');

        await smartToken.transferOwnership(bancor.address);
        console.log('[Test Bancor]transfer ownership OK');

        await bancor.acceptTokenOwnership();
        console.log('[Test Bancor]accept ownership OK');

        console.log('[Test Bancor]end setup');
    });
});

contract('Test FinancieLog', (accounts) => {
    it('setup financie log', async () => {
        // ログを1行記録する
        let testLog = await FinancieLog.new();
        await testLog.recordLog(0x001, 0x011, 1, 0x111, 0x211, 300, 200);

        // 記録されたログを取得する(0x001は記録している、0x002には記録していない)
        let log1 = await testLog.getSenderLogs(0x001);
        let log2 = await testLog.getSenderLogs(0x002);

        // 記録されたログを取得する(全レコードに欠けがないことを確認)
        assert.equal(7, log1.length);
        assert.equal(1, log1[0].length);
        assert.equal(1, log1[1].length);
        assert.equal(1, log1[2].length);
        assert.equal(1, log1[3].length);
        assert.equal(1, log1[4].length);
        assert.equal(1, log1[5].length);
        assert.equal(1, log1[6].length);

        // 記録されていないことを確認する
        assert.equal(7, log2.length);
        assert.equal(0, log2[0].length);

        // 記録されたログを取得する(0x011は記録している、0x012には記録していない)
        let log3 = await testLog.getTargetLogs(0x011);
        let log4 = await testLog.getTargetLogs(0x012);

        // 記録されたログを取得する(全レコードに欠けがないことを確認)
        assert.equal(7, log3.length);
        assert.equal(1, log3[0].length);
        assert.equal(1, log3[1].length);
        assert.equal(1, log3[2].length);
        assert.equal(1, log3[3].length);
        assert.equal(1, log3[4].length);
        assert.equal(1, log3[5].length);
        assert.equal(1, log3[6].length);

        // 記録されていないことを確認する
        assert.equal(7, log4.length);
        assert.equal(0, log4[0].length);

        // 記録されたログを取得する(0x111は記録している、0x112には記録していない)
        let log5 = await testLog.getFromLogs(0x111);
        let log6 = await testLog.getFromLogs(0x112);

        // 記録されたログを取得する(全レコードに欠けがないことを確認)
        assert.equal(7, log5.length);
        assert.equal(1, log5[0].length);
        assert.equal(1, log5[1].length);
        assert.equal(1, log5[2].length);
        assert.equal(1, log5[3].length);
        assert.equal(1, log5[4].length);
        assert.equal(1, log5[5].length);
        assert.equal(1, log5[6].length);

        // 記録されていないことを確認する
        assert.equal(7, log6.length);
        assert.equal(0, log6[0].length);

        // 記録されたログを取得する(0x211は記録している、0x212には記録していない)
        let log7 = await testLog.getToLogs(0x211);
        let log8 = await testLog.getToLogs(0x212);

        // 記録されたログを取得する(全レコードに欠けがないことを確認)
        assert.equal(7, log7.length);
        assert.equal(1, log7[0].length);
        assert.equal(1, log7[1].length);
        assert.equal(1, log7[2].length);
        assert.equal(1, log7[3].length);
        assert.equal(1, log7[4].length);
        assert.equal(1, log7[5].length);
        assert.equal(1, log7[6].length);

        // 記録されていないことを確認する
        assert.equal(7, log8.length);
        assert.equal(0, log8[0].length);
    });
});

contract('Contract finished', (accounts) => {
    it('all process finished', async () => {
        process.exit(0);
    });
});
