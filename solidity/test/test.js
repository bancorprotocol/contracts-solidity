/* global artifacts, contract, before, it, assert */
/* eslint-disable prefer-reflect */

const BancorConverter = artifacts.require('BancorConverter.sol');
const SmartToken = artifacts.require('SmartToken.sol');
const BancorFormula = artifacts.require('BancorFormula.sol');
const BancorGasPriceLimit = artifacts.require('BancorGasPriceLimit.sol');
const BancorQuickConverter = artifacts.require('BancorQuickConverter.sol');
const BancorConverterExtensions = artifacts.require('BancorConverterExtensions.sol');
const TestERC20Token = artifacts.require('TestERC20Token.sol');
const utils = require('./helpers/Utils');

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

var auction;

// used by purchase/sale tests
async function initConverter(accounts, activate, maxConversionFee = 0) {
    token = await SmartToken.new('Token1', 'TKN1', 0);
    tokenAddress = token.address;
    new Promise(() => console.log('[initConverter]SmartToken:' + tokenAddress));

    platformToken = await TestERC20Token.new('PF Token', 'ERC PF', 100000000);
    platformTokenAddress = platformToken.address;
    new Promise(() => console.log('[initConverter]PF Token:' + platformTokenAddress));

    connectorToken = await TestERC20Token.new('ERC Token 1', 'ERC1', 1000000);
    connectorTokenAddress = connectorToken.address;
    new Promise(() => console.log('[initConverter]ERC Token 1:' + connectorTokenAddress));

    connectorToken2 = await TestERC20Token.new('ERC Token 2', 'ERC2', 1000000);
    connectorTokenAddress2 = connectorToken2.address;
    new Promise(() => console.log('[initConverter]ERC Token 2:' + connectorTokenAddress2));

    let converter = await BancorConverter.new(tokenAddress, converterExtensionsAddress, maxConversionFee, platformTokenAddress, 10000);
    let converterAddress = converter.address;
    new Promise(() => console.log('[initConverter]BancorConverter:' + converterAddress));
    await converter.addConnector(connectorTokenAddress, 10000, false);
    await converter.addConnector(connectorTokenAddress2, 20000, false);

    await token.issue(converterAddress, 1000000);
    await platformToken.transfer(converterAddress, 1000000);
    await connectorToken.transfer(converterAddress, 5000);
    await connectorToken2.transfer(converterAddress, 5000);

    if (activate) {
        await token.transferOwnership(converterAddress);
        await converter.acceptTokenOwnership();
    }

    return converter;
}

function verifyConnector(connector, isSet, isEnabled, weight, isVirtualBalanceEnabled, virtualBalance) {
    assert.equal(connector[0], virtualBalance);
    assert.equal(connector[1], weight);
    assert.equal(connector[2], isVirtualBalanceEnabled);
    assert.equal(connector[3], isEnabled);
    assert.equal(connector[4], isSet);
}

function getConversionAmount(transaction, logIndex = 0) {
    return transaction.logs[logIndex].args._return.toNumber();
}

contract('BancorConverter', (accounts) => {
    before(async () => {
        let formula = await BancorFormula.new();
        let gasPriceLimit = await BancorGasPriceLimit.new(gasPrice);
        let quickConverter = await BancorQuickConverter.new();
        let converterExtensions = await BancorConverterExtensions.new(formula.address, gasPriceLimit.address, quickConverter.address);
        converterExtensionsAddress = converterExtensions.address;
    });

    it('verifies that getReturn returns a valid amount', async () => {
        let converter = await initConverter(accounts, true);
        let returnAmount = await converter.getReturn.call(connectorTokenAddress, tokenAddress, 500);
        assert.isNumber(returnAmount.toNumber());
        assert.notEqual(returnAmount.toNumber(), 0);

        await connectorToken2.approve(converter.address, 2000);
        let bought = await converter.convert(connectorTokenAddress2, platformTokenAddress, 2000, 1);
        let boughtBody = getConversionAmount(bought);
        new Promise(() => console.log('[buy]' + boughtBody));

        await platformToken.approve(converter.address, boughtBody);
        let sold = await converter.convert(platformTokenAddress, connectorTokenAddress, boughtBody, 1);
        let soldBody = getConversionAmount(sold);
        new Promise(() => console.log('[sell]' + soldBody));
    });

});

contract('DutchAuction', (accounts) => {
    before(async () => {
      auction = await DutchAuction.new(accounts[0], accounts[0], 0x1bc16d674ec80000, 0x5ddb1980, 3);
      new Promise(() => console.log('[initDutchAuction]DutchAuction:' + auction.address));
    });

    it('setup auction', async () => {
    await connectorToken.transfer(auction.address, 1000000-5000);
      await auction.setup(connectorTokenAddress);
      await auction.startAuction();
    });

});
