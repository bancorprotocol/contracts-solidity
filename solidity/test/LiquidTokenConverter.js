/* global artifacts, contract, before, it, assert */
/* eslint-disable prefer-reflect */

const fs = require('fs');

const utils = require('./helpers/Utils');
const ContractRegistryClient = require('./helpers/ContractRegistryClient');
const BancorNetwork = artifacts.require('BancorNetwork');
const LiquidTokenConverter = artifacts.require('LiquidTokenConverter');
const LiquidTokenConverterFactory = artifacts.require('LiquidTokenConverterFactory');
const SmartToken = artifacts.require('SmartToken');
const BancorFormula = artifacts.require('BancorFormula');
const ContractRegistry = artifacts.require('ContractRegistry');
const ERC20Token = artifacts.require('ERC20Token');
const ConverterFactory = artifacts.require('ConverterFactory');
const ConverterUpgrader = artifacts.require('ConverterUpgrader');
const Whitelist = artifacts.require('Whitelist');

const ETH_RESERVE_ADDRESS = '0x'.padEnd(42, 'e');
const WEIGHT_RESOLUTION = 1000000;
const WEIGHT_10_PERCENT = 100000;

let bancorNetwork;
let factory;
let token;
let tokenAddress;
let contractRegistry;
let reserveToken;
let upgrader;


async function createConverter(tokenAddress, registryAddress = contractRegistry.address, maxConversionFee = 0) {
    return await LiquidTokenConverter.new(tokenAddress, registryAddress, maxConversionFee);
}

async function initConverter(accounts, activate, isETHReserve, maxConversionFee = 0) {
    token = await SmartToken.new('Token1', 'TKN1', 2);
    tokenAddress = token.address;

    let converter = await createConverter(tokenAddress, contractRegistry.address, maxConversionFee);
    await converter.addReserve(getReserve1Address(isETHReserve), 250000);
    await token.issue(accounts[0], 20000);

    if (isETHReserve)
        await converter.send(5000);
    else
        await reserveToken.transfer(converter.address, 5000);

    if (activate) {
        await token.transferOwnership(converter.address);
        await converter.acceptTokenOwnership();
    }

    return converter;
}

function getReserve1Address(isETH) {
    if (isETH)
        return ETH_RESERVE_ADDRESS;

    return reserveToken.address;
}

async function getBalance(token, address, account) {
    if (address == ETH_RESERVE_ADDRESS)
        return await web3.eth.getBalance(account);

    return await token.balanceOf.call(account);
}

async function getTransactionCost(txResult) {
    let transaction = await web3.eth.getTransaction(txResult.tx);
    return transaction.gasPrice.times(txResult.receipt.cumulativeGasUsed);
}

async function getConversionAmount(watcher, logIndex = 0) {
    let events = await watcher.get();
    return events[logIndex].args._return.toNumber();
}

async function approve(token, from, to, amount) {
    await token.approve(to, 0, { from });
    return await token.approve(to, amount, { from });
}

async function convert(path, amount, minReturn, options) {
    return bancorNetwork.convertByPath(path, amount, minReturn, utils.zeroAddress, utils.zeroAddress, 0, options);
}

contract('LiquidTokenConverter', accounts => {
    before(async () => {
        contractRegistry = await ContractRegistry.new();

        let bancorFormula = await BancorFormula.new();
        await contractRegistry.registerAddress(ContractRegistryClient.BANCOR_FORMULA, bancorFormula.address);

        bancorNetwork = await BancorNetwork.new(contractRegistry.address);
        await contractRegistry.registerAddress(ContractRegistryClient.BANCOR_NETWORK, bancorNetwork.address);

        factory = await ConverterFactory.new();
        await contractRegistry.registerAddress(ContractRegistryClient.CONVERTER_FACTORY, factory.address);

        await factory.registerTypedConverterFactory((await LiquidTokenConverterFactory.new()).address);

        upgrader = await ConverterUpgrader.new(contractRegistry.address, utils.zeroAddress);
        await contractRegistry.registerAddress(ContractRegistryClient.CONVERTER_UPGRADER, upgrader.address);

        let token = await SmartToken.new('Token1', 'TKN1', 2); 
        tokenAddress = token.address;

        reserveToken = await ERC20Token.new('ERC Token 1', 'ERC1', 0, 1000000000);
    });

    it('should throw when attempting to buy without first approving the network to transfer from the buyer account in the reserve contract', async () => {
        await initConverter(accounts, true, false);
        await approve(reserveToken, accounts[0], bancorNetwork.address, 0);
        await utils.catchRevert(convert([getReserve1Address(false), tokenAddress, tokenAddress], 500, 1));
    });

    for (let isETHReserve = 0; isETHReserve < 2; isETHReserve++) {
        describe(`${isETHReserve == 0 ? '(with ERC20 reserve)' : '(with ETH reserve)'}:`, () => {

            it('verifies the reserve token count and reserve ratio before / after adding a reserve', async () => {
                let converter = await createConverter(tokenAddress, contractRegistry.address, 0);
                let reserveTokenCount = await converter.reserveTokenCount.call();
                let reserveRatio = await converter.reserveRatio.call();
                assert.equal(reserveTokenCount.toFixed(), '0');
                assert.equal(reserveRatio.toFixed(), '0');
                await converter.addReserve(getReserve1Address(isETHReserve), 100000);
                reserveTokenCount = await converter.reserveTokenCount.call();
                reserveRatio = await converter.reserveRatio.call();
                assert.equal(reserveTokenCount.toFixed(), '1');
                assert.equal(reserveRatio.toFixed(), '100000');
            });

            it('should throw when attempting to add 2nd reserve', async () => {
                let converter = await createConverter(tokenAddress, contractRegistry.address, 0);
                await converter.addReserve(getReserve1Address(isETHReserve), WEIGHT_10_PERCENT);

                reserveToken2 = await ERC20Token.new('ERC Token 2', 'ERC2', 0, 1000000000);

                await utils.catchRevert(converter.addReserve(reserveToken2.address, 200000));
            });

            it('verifies that the converter can accept the token ownership when 1 reserve is defined', async () => {
                let converter = await initConverter(accounts, false, isETHReserve);
                await token.transferOwnership(converter.address);
                await converter.acceptTokenOwnership();
            });

            it('verifies that targetAmountAndFee returns a valid amount', async () => {
                let converter = await initConverter(accounts, true, isETHReserve);
                let returnAmount = (await converter.targetAmountAndFee.call(getReserve1Address(isETHReserve), tokenAddress, 500))[0];
                assert.isNumber(returnAmount.toNumber());
                assert.notEqual(returnAmount.toNumber(), 0);
            });

            it('verifies that Conversion event returns conversion fee after buying', async () => {
                let converter = await initConverter(accounts, true, isETHReserve, 5000);
                let watcher = converter.Conversion();
                await converter.setConversionFee(3000);
                let value = 0;
                if (isETHReserve)
                    value = 500;
                else
                    await approve(reserveToken, accounts[0], bancorNetwork.address, 500);

                await convert([getReserve1Address(isETHReserve), tokenAddress, tokenAddress], 500, 1, { value });
                let events = await watcher.get();
                assert(events.length > 0);
                assert('_conversionFee' in events[0].args);
            });

            it('verifies that Conversion event returns conversion fee after selling', async () => {
                let converter = await initConverter(accounts, true, isETHReserve, 5000);
                let watcher = converter.Conversion();
                await converter.setConversionFee(3000);
                await approve(token, accounts[0], bancorNetwork.address, 500);
                await convert([tokenAddress, tokenAddress, getReserve1Address(isETHReserve)], 500, 1);
                let events = await watcher.get();
                assert(events.length > 0);
                assert('_conversionFee' in events[0].args);
            });

            it('should throw when attempting to get the purchase target amount while the converter is not active', async () => {
                let converter = await initConverter(accounts, false, isETHReserve);

                await utils.catchRevert(converter.targetAmountAndFee.call(getReserve1Address(isETHReserve), tokenAddress, 500));
            });

            it('should throw when attempting to get the sale target amount while the converter is not active', async () => {
                let converter = await initConverter(accounts, false, isETHReserve);

                await utils.catchRevert(converter.targetAmountAndFee.call(tokenAddress, getReserve1Address(isETHReserve), 500));
            });

            it('verifies that convert returns valid amount and fee after buying', async () => {
                let converter = await initConverter(accounts, true, isETHReserve, 10000);
                let watcher = converter.Conversion();
                await converter.setConversionFee(6000);
                let value = 0;
                if (isETHReserve)
                    value = 500;
                else
                    await approve(reserveToken, accounts[0], bancorNetwork.address, 500);

                await convert([getReserve1Address(isETHReserve), tokenAddress, tokenAddress], 500, 1, { value });
                let events = await watcher.get();
                assert(events.length > 0);
                assert.equal(events[0].args._return.toFixed(), 480);
                assert.equal(events[0].args._conversionFee.toFixed(), 2);
            });

            it('verifies that convert returns valid amount and fee after selling', async () => {
                let converter = await initConverter(accounts, true, isETHReserve, 10000);
                let watcher = converter.Conversion();
                await converter.setConversionFee(6000);
                await approve(token, accounts[0], bancorNetwork.address, 500);
                await convert([tokenAddress, tokenAddress, getReserve1Address(isETHReserve)], 500, 1);
                let events = await watcher.get();
                assert(events.length > 0);
                assert.equal(events[0].args._return.toFixed(), 479);
                assert.equal(events[0].args._conversionFee.toFixed(), 2);
            });

            it('verifies that selling right after buying does not result in an amount greater than the original purchase amount', async () => {
                let converter = await initConverter(accounts, true, isETHReserve);
                let watcher = converter.Conversion();
                let value = 0;
                if (isETHReserve)
                    value = 500;
                else
                    await approve(reserveToken, accounts[0], bancorNetwork.address, 500);

                await convert([getReserve1Address(isETHReserve), tokenAddress, tokenAddress], 500, 1, { value });
                let purchaseAmount = await getConversionAmount(watcher);
                await approve(token, accounts[0], bancorNetwork.address, purchaseAmount);
                await convert([tokenAddress, tokenAddress, getReserve1Address(isETHReserve)], purchaseAmount, 1);
                let saleAmount = await getConversionAmount(watcher);
                assert(saleAmount <= 500);
            });

            it('verifies that buying right after selling does not result in an amount greater than the original sale amount', async () => {
                let converter = await initConverter(accounts, true, isETHReserve);
                let watcher = converter.Conversion();
                await approve(token, accounts[0], bancorNetwork.address, 500);
                await convert([tokenAddress, tokenAddress, getReserve1Address(isETHReserve)], 500, 1);
                let saleAmount = await getConversionAmount(watcher);
                
                let value = 0;
                if (isETHReserve)
                    value = saleAmount;
                else
                    await approve(reserveToken, accounts[0], bancorNetwork.address, saleAmount);

                await convert([getReserve1Address(isETHReserve), tokenAddress, tokenAddress], saleAmount, 1, { value });
                let purchaseAmount = await getConversionAmount(watcher);

                assert(purchaseAmount <= 500);
            });

            it('verifies the TokenRateUpdate event after conversion', async () => {
                let converter = await initConverter(accounts, true, isETHReserve, 10000);
                let watcher = converter.TokenRateUpdate();
                await converter.setConversionFee(6000);
                let value = 0;
                if (isETHReserve)
                    value = 500;
                else
                    await approve(reserveToken, accounts[0], bancorNetwork.address, 500);

                await convert([getReserve1Address(isETHReserve), tokenAddress, tokenAddress], 500, 1, { value });

                let supply = await token.totalSupply();
                let reserveBalance = await converter.reserveBalance(getReserve1Address(isETHReserve));
                let reserveWeight = await converter.reserveWeight(getReserve1Address(isETHReserve));

                let expectedRate = reserveBalance.div(supply.mul(reserveWeight).div(WEIGHT_RESOLUTION));

                let events = await watcher.get();
                assert(events.length > 0);
                assert.equal(events[0].args._rateN.div(events[0].args._rateD).toFixed(), expectedRate.toFixed());
            });

            it('should throw when attempting to convert with 0 minimum requested amount', async () => {
                await initConverter(accounts, true, isETHReserve);
                let value = 0;
                if (isETHReserve)
                    value = 500;
                else
                    await approve(reserveToken, accounts[0], bancorNetwork.address, 500);

                await utils.catchRevert(convert([getReserve1Address(isETHReserve), tokenAddress, tokenAddress], 500, 0, { value }));
            });

            it('should throw when attempting to convert when the return is smaller than the minimum requested amount', async () => {
                await initConverter(accounts, true, isETHReserve);
                let value = 0;
                if (isETHReserve)
                    value = 500;
                else
                    await approve(reserveToken, accounts[0], bancorNetwork.address, 500);

                await utils.catchRevert(convert([getReserve1Address(isETHReserve), tokenAddress, tokenAddress], 500, 2000, { value }));
            });

            it('verifies balances after buy', async () => {
                let converter = await initConverter(accounts, true, isETHReserve);
                let watcher = converter.Conversion();

                let value = 0;
                if (isETHReserve)
                    value = 500;
                else
                    await approve(reserveToken, accounts[0], bancorNetwork.address, 500);

                let tokenPrevBalance = await token.balanceOf.call(accounts[0]);
                let reserveTokenPrevBalance = await getBalance(reserveToken, getReserve1Address(isETHReserve), accounts[0]);

                let res = await convert([getReserve1Address(isETHReserve), tokenAddress, tokenAddress], 500, 1, { value });
                let purchaseAmount = await getConversionAmount(watcher);

                let transactionCost = 0;
                if (isETHReserve)
                    transactionCost = await getTransactionCost(res);

                let reserveTokenNewBalance = await getBalance(reserveToken, getReserve1Address(isETHReserve), accounts[0]);
                assert.equal(reserveTokenNewBalance.toNumber(), reserveTokenPrevBalance.minus(500).minus(transactionCost).toNumber());

                let tokenNewBalance = await token.balanceOf.call(accounts[0]);
                assert.equal(tokenNewBalance.toNumber(), tokenPrevBalance.plus(purchaseAmount).toNumber());
            });

            it('should throw when attempting to buy while the converter is not active', async () => {
                await initConverter(accounts, false, isETHReserve);
                let value = 0;
                if (isETHReserve)
                    value = 500;
                else
                    await approve(reserveToken, accounts[0], bancorNetwork.address, 500);

                await utils.catchRevert(convert([getReserve1Address(isETHReserve), tokenAddress, tokenAddress], 500, 1, { value }));
            });

            it('should throw when attempting to buy with a non reserve address', async () => {
                await initConverter(accounts, true, isETHReserve);
                let value = 0;
                if (isETHReserve)
                    value = 500;
                else
                    await approve(reserveToken, accounts[0], bancorNetwork.address, 500);

                await utils.catchRevert(convert([tokenAddress, tokenAddress, tokenAddress], 500, 1, { value }));
            });

            it('should throw when attempting to buy while the purchase yields 0 return', async () => {
                await initConverter(accounts, true, isETHReserve);
                let value = 0;
                if (isETHReserve)
                    value = 500;
                else
                    await approve(reserveToken, accounts[0], bancorNetwork.address, 500);

                await utils.catchRevert(convert([getReserve1Address(isETHReserve), tokenAddress, tokenAddress], 0, 1, { value }));
            });

            it('should throw when attempting to buy with 0 minimum requested amount', async () => {
                await initConverter(accounts, true, isETHReserve);
                let value = 0;
                if (isETHReserve)
                    value = 500;
                else
                    await approve(reserveToken, accounts[0], bancorNetwork.address, 500);

                await utils.catchRevert(convert([getReserve1Address(isETHReserve), tokenAddress, tokenAddress], 500, 0, { value }));
            });

            it('verifies balances after sell', async () => {
                let converter = await initConverter(accounts, true, isETHReserve);
                let watcher = converter.Conversion();

                await approve(token, accounts[0], bancorNetwork.address, 500);

                let tokenPrevBalance = await token.balanceOf.call(accounts[0]);
                let reserveTokenPrevBalance = await getBalance(reserveToken, getReserve1Address(isETHReserve), accounts[0]);

                let res = await convert([tokenAddress, tokenAddress, getReserve1Address(isETHReserve)], 500, 1);
                let saleAmount = await getConversionAmount(watcher);

                let transactionCost = 0;
                if (isETHReserve)
                    transactionCost = await getTransactionCost(res);

                let reserveTokenNewBalance = await getBalance(reserveToken, getReserve1Address(isETHReserve), accounts[0]);
                assert.equal(reserveTokenNewBalance.toNumber(), reserveTokenPrevBalance.plus(saleAmount).minus(transactionCost).toNumber());

                let tokenNewBalance = await token.balanceOf.call(accounts[0]);
                assert.equal(tokenNewBalance.toNumber(), tokenPrevBalance.minus(500).toNumber());
            });

            it('should throw when attempting to sell while the converter is not active', async () => {
                await initConverter(accounts, false, isETHReserve);
                await approve(token, accounts[0], bancorNetwork.address, 500);

                await utils.catchRevert(convert([tokenAddress, tokenAddress, getReserve1Address(isETHReserve)], 500, 1));
            });

            it('should throw when attempting to sell with a non reserve address', async () => {
                await initConverter(accounts, true, isETHReserve);
                await approve(token, accounts[0], bancorNetwork.address, 500);

                await utils.catchRevert(convert([tokenAddress, tokenAddress, tokenAddress], 500, 1));
            });

            it('should throw when attempting to sell while the sale yields 0 return', async () => {
                await initConverter(accounts, true, isETHReserve);
                await approve(token, accounts[0], bancorNetwork.address, 1);

                await utils.catchRevert(convert([tokenAddress, tokenAddress, getReserve1Address(isETHReserve)], 1, 1));
            });

            it('should throw when attempting to sell with amount greater than the seller balance', async () => {
                await initConverter(accounts, true, isETHReserve);
                await approve(token, accounts[0], bancorNetwork.address, 30000);

                await utils.catchRevert(convert([tokenAddress, tokenAddress, getReserve1Address(isETHReserve)], 30000, 1));
            });

            it('verifies that convert is allowed for a whitelisted account', async () => {
                let converter = await initConverter(accounts, true, isETHReserve);
                let whitelist = await Whitelist.new();
                await whitelist.addAddress(converter.address);
                await whitelist.addAddress(accounts[1]);
                await converter.setConversionWhitelist(whitelist.address);

                let value = 0;
                if (isETHReserve) {
                    value = 500;
                }
                else {
                    await reserveToken.transfer(accounts[1], 1000);
                    await approve(reserveToken, accounts[1], bancorNetwork.address, 500, { from: accounts[1] });
                }

                await convert([getReserve1Address(isETHReserve), tokenAddress, tokenAddress], 500, 1, { from: accounts[1], value })
            });

            it('should throw when calling convert from a non whitelisted account', async () => {
                let converter = await initConverter(accounts, true, isETHReserve);
                let whitelist = await Whitelist.new();
                await whitelist.addAddress(converter.address);
                await converter.setConversionWhitelist(whitelist.address);

                let value = 0;
                if (isETHReserve) {
                    value = 500;
                }
                else {
                    await reserveToken.transfer(accounts[1], 1000);
                    await approve(reserveToken, accounts[1], bancorNetwork.address, 500, { from: accounts[1] });
                }

                await utils.catchRevert(convert([getReserve1Address(isETHReserve), tokenAddress, tokenAddress], 500, 1, { from: accounts[1] }));
            });

            it('should throw when calling convert while the beneficiary is not whitelisted', async () => {
                let converter = await initConverter(accounts, true, isETHReserve);
                let whitelist = await Whitelist.new();
                await whitelist.addAddress(accounts[1]);
                await converter.setConversionWhitelist(whitelist.address);
                
                let value = 0;
                if (isETHReserve) {
                    value = 500;
                }
                else {
                    await reserveToken.transfer(accounts[1], 1000);
                    await approve(reserveToken, accounts[1], bancorNetwork.address, 500, { from: accounts[1] });
                }

                await utils.catchRevert(bancorNetwork.convertByPath([getReserve1Address(isETHReserve), tokenAddress, tokenAddress], 500, 1, accounts[2], utils.zeroAddress, 0, { from: accounts[1], value }));
            });
        });
    };
});
