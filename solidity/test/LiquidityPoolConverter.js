/* global artifacts, contract, before, it, assert */
/* eslint-disable prefer-reflect */

const utils = require('./helpers/Utils');
const ContractRegistryClient = require('./helpers/ContractRegistryClient');
const BancorNetwork = artifacts.require('BancorNetwork');
const LiquidityPoolV1Converter = artifacts.require('LiquidityPoolV1Converter');
const LiquidityPoolV1ConverterFactory = artifacts.require('LiquidityPoolV1ConverterFactory');
const SmartToken = artifacts.require('SmartToken');
const BancorFormula = artifacts.require('BancorFormula');
const ContractRegistry = artifacts.require('ContractRegistry');
const ERC20Token = artifacts.require('ERC20Token');
const TestNonStandardToken = artifacts.require('TestNonStandardToken');
const ConverterFactory = artifacts.require('ConverterFactory');
const ConverterUpgrader = artifacts.require('ConverterUpgrader');
const Whitelist = artifacts.require('Whitelist');

const ETH_RESERVE_ADDRESS = '0x'.padEnd(42, 'e');
const weight10Percent = 100000;

let bancorNetwork;
let factory;
let token;
let tokenAddress;
let contractRegistry;
let reserveToken;
let reserveToken2;
let reserveToken3;
let upgrader;


async function createConverter(tokenAddress, registryAddress = contractRegistry.address, maxConversionFee = 0) {
    return await LiquidityPoolV1Converter.new(tokenAddress, registryAddress, maxConversionFee);
}

async function initConverter(accounts, activate, isETHReserve, maxConversionFee = 0) {
    token = await SmartToken.new('Token1', 'TKN1', 2);
    tokenAddress = token.address;

    let converter = await createConverter(tokenAddress, contractRegistry.address, maxConversionFee);
    await converter.addReserve(getReserve1Address(isETHReserve), 250000);
    await converter.addReserve(reserveToken2.address, 150000);
    await reserveToken2.transfer(converter.address, 8000);
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

function verifyReserve(reserve, balance, weight, isSet) {
    assert.equal(reserve[0], balance);
    assert.equal(reserve[1], weight);
    assert.equal(reserve[4], isSet);
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

contract('LiquidityPoolConverter', accounts => {
    before(async () => {
        contractRegistry = await ContractRegistry.new();

        let bancorFormula = await BancorFormula.new();
        await contractRegistry.registerAddress(ContractRegistryClient.BANCOR_FORMULA, bancorFormula.address);

        bancorNetwork = await BancorNetwork.new(contractRegistry.address);
        await contractRegistry.registerAddress(ContractRegistryClient.BANCOR_NETWORK, bancorNetwork.address);

        factory = await ConverterFactory.new();
        await contractRegistry.registerAddress(ContractRegistryClient.CONVERTER_FACTORY, factory.address);

        await factory.registerTypedConverterFactory((await LiquidityPoolV1ConverterFactory.new()).address);

        upgrader = await ConverterUpgrader.new(contractRegistry.address, utils.zeroAddress);
        await contractRegistry.registerAddress(ContractRegistryClient.CONVERTER_UPGRADER, upgrader.address);

        let token = await SmartToken.new('Token1', 'TKN1', 2);
        tokenAddress = token.address;

        reserveToken = await ERC20Token.new('ERC Token 1', 'ERC1', 0, 1000000000);
        reserveToken2 = await TestNonStandardToken.new('ERC Token 2', 'ERC2', 0, 2000000000);
        reserveToken3 = await ERC20Token.new('ERC Token 3', 'ERC3', 0, 1500000000);
    });

    for (let isETHReserve = 0; isETHReserve < 2; isETHReserve++) {
        describe(`${isETHReserve == 0 ? '(with ERC20 reserves)' : '(with ETH reserve)'}:`, () => {

            it('verifies the reserve token count and reserve ratio before / after adding a reserve', async () => {
                let converter = await createConverter(tokenAddress, contractRegistry.address, 0);
                await converter.addReserve(getReserve1Address(isETHReserve), 100000);
                let reserveTokenCount = await converter.reserveTokenCount.call();
                let reserveRatio = await converter.reserveRatio.call();
                assert.equal(reserveTokenCount.toFixed(), '1');
                assert.equal(reserveRatio.toFixed(), '100000');
                await converter.addReserve(reserveToken2.address, 200000);
                reserveTokenCount = await converter.reserveTokenCount.call();
                reserveRatio = await converter.reserveRatio.call();
                assert.equal(reserveTokenCount.toFixed(), '2');
                assert.equal(reserveRatio.toFixed(), '300000');
            });

            it('verifies that 2 reserves are added correctly', async () => {
                let converter = await createConverter(tokenAddress, contractRegistry.address, 200000);
                await converter.addReserve(getReserve1Address(isETHReserve), weight10Percent);
                let reserve = await converter.reserves.call(getReserve1Address(isETHReserve));
                verifyReserve(reserve, 0, weight10Percent, true);
                await converter.addReserve(reserveToken2.address, 200000);
                reserve = await converter.reserves.call(reserveToken2.address);
                verifyReserve(reserve, 0, 200000, true);
            });

            it('should revert when attempting to add a reserve when the converter is active', async () => {
                let converter = await initConverter(accounts, true, isETHReserve);

                await utils.catchRevert(converter.addReserve(reserveToken3.address, weight10Percent));
            });

            it('should revert when attempting to add a reserve that already exists', async () => {
                let converter = await createConverter(tokenAddress, contractRegistry.address, 0);
                await converter.addReserve(getReserve1Address(isETHReserve), weight10Percent);

                await utils.catchRevert(converter.addReserve(getReserve1Address(isETHReserve), 200000));
            });

            it('should revert when attempting to add multiple reserves with total weight greater than 100%', async () => {
                let converter = await createConverter(tokenAddress, contractRegistry.address, 0);
                await converter.addReserve(getReserve1Address(isETHReserve), 500000);

                await utils.catchRevert(converter.addReserve(reserveToken2.address, 500001));
            });

            it('should revert when the owner attempts to accept the token ownership and only 1 reserve is defined', async () => {
                let converter = await createConverter(tokenAddress, contractRegistry.address, 0);
                await converter.addReserve(getReserve1Address(isETHReserve), 500000);

                await utils.catchRevert(converter.acceptTokenOwnership());
            });

            it('verifies that targetAmountAndFee returns a valid amount', async () => {
                let converter = await initConverter(accounts, true, isETHReserve);
                let returnAmount = (await converter.targetAmountAndFee.call(getReserve1Address(isETHReserve), reserveToken2.address, 500))[0];
                assert.isNumber(returnAmount.toNumber());
                assert.notEqual(returnAmount.toNumber(), 0);
            });

            it('should revert when attempting to get the target amount between the pool token and a reserve', async () => {
                let converter = await initConverter(accounts, true, isETHReserve);

                await utils.catchRevert(converter.targetAmountAndFee.call(tokenAddress, getReserve1Address(isETHReserve), 500));
            });

            it('should revert when attempting to get the target amount while the converter is not active', async () => {
                let converter = await initConverter(accounts, false, isETHReserve);

                await utils.catchRevert(converter.targetAmountAndFee.call(getReserve1Address(isETHReserve), reserveToken2.address, 500));
            });

            it('should revert when attempting to convert with 0 minimum requested amount', async () => {
                await initConverter(accounts, true, isETHReserve);
                let value = 0;
                if (isETHReserve)
                    value = 500;
                else
                    await approve(reserveToken, accounts[0], bancorNetwork.address, 500);

                await utils.catchRevert(convert([getReserve1Address(isETHReserve), tokenAddress, reserveToken2.address], 500, 0, { value }));
            });

            it('verifies that convert is allowed for a whitelisted account', async () => {
                let converter = await initConverter(accounts, true, isETHReserve);
                let whitelist = await Whitelist.new();
                await whitelist.addAddress(converter.address);
                await whitelist.addAddress(accounts[1]);
                await converter.setConversionWhitelist(whitelist.address);
                await reserveToken.transfer(accounts[1], 1000);

                let value = 0;
                if (isETHReserve)
                    value = 500;
                else
                    await approve(reserveToken, accounts[1], bancorNetwork.address, 500, { from: accounts[1] });

                await convert([getReserve1Address(isETHReserve), tokenAddress, reserveToken2.address], 500, 1, { from: accounts[1], value })
            });

            it('should revert when calling convert from a non whitelisted account', async () => {
                let converter = await initConverter(accounts, true, isETHReserve);
                let whitelist = await Whitelist.new();
                await whitelist.addAddress(converter.address);
                await converter.setConversionWhitelist(whitelist.address);
                await reserveToken.transfer(accounts[1], 1000);

                let value = 0;
                if (isETHReserve)
                    value = 500;
                else
                    await approve(reserveToken, accounts[1], bancorNetwork.address, 500, { from: accounts[1] });

                await utils.catchRevert(convert([getReserve1Address(isETHReserve), tokenAddress, reserveToken2.address], 500, 1, { from: accounts[1], value  }));
            });

            it('should revert when calling convert while the beneficiary is not whitelisted', async () => {
                let converter = await initConverter(accounts, true, isETHReserve);
                let whitelist = await Whitelist.new();
                await whitelist.addAddress(accounts[1]);
                await converter.setConversionWhitelist(whitelist.address);
                await reserveToken.transfer(accounts[1], 1000);

                let value = 0;
                if (isETHReserve)
                    value = 500;
                else
                    await approve(reserveToken, accounts[1], bancorNetwork.address, 500, { from: accounts[1] });

                await utils.catchRevert(bancorNetwork.convertByPath([getReserve1Address(isETHReserve), tokenAddress, reserveToken2.address], 500, 1, accounts[2], utils.zeroAddress, 0, { from: accounts[1], value }));
            });

            it('verifies that targetAmountAndFee returns the same amount as converting', async () => {
                let converter = await initConverter(accounts, true, isETHReserve);
                let watcher = converter.Conversion();
                let returnAmount = (await converter.targetAmountAndFee.call(getReserve1Address(isETHReserve), reserveToken2.address, 500))[0];

                let value = 0;
                if (isETHReserve)
                    value = 500;
                else
                    await approve(reserveToken, accounts[0], bancorNetwork.address, 500);

                await convert([getReserve1Address(isETHReserve), tokenAddress, reserveToken2.address], 500, 1, { value });
                let returnAmount2 = await getConversionAmount(watcher);

                assert.equal(returnAmount.toNumber(), returnAmount2);
            });
        });
    }
});
