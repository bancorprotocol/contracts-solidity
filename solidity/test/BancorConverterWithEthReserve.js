/* global artifacts, contract, before, it, assert */
/* eslint-disable prefer-reflect */

const fs = require('fs');

const utils = require('./helpers/Utils');
const ContractRegistryClient = require('./helpers/ContractRegistryClient');

const BancorNetwork = artifacts.require('BancorNetwork');
const BancorConverter = artifacts.require('TestBancorConverter');
const SmartToken = artifacts.require('SmartToken');
const BancorFormula = artifacts.require('BancorFormula');
const ContractRegistry = artifacts.require('ContractRegistry');
const ERC20Token = artifacts.require('ERC20Token');
const EtherToken = artifacts.require('EtherToken');
const ConverterFactory = artifacts.require('ConverterFactory');
const ConverterUpgrader = artifacts.require('ConverterUpgrader');

const ETH_RESERVE_ADDRESS = '0x'.padEnd(42, 'e');

const weight10Percent = 100000;

let bancorNetwork;
let token;
let tokenAddress;
let contractRegistry;
let reserveToken;
let etherToken;
let reserveToken3;
let upgrader;

// used by purchase/sale tests
async function initConverter(accounts, activate, maxConversionFee = 0) {
    token = await SmartToken.new('Token1', 'TKN1', 2);
    tokenAddress = token.address;

    let converter = await BancorConverter.new(
        tokenAddress,
        contractRegistry.address,
        maxConversionFee,
        reserveToken.address,
        250000
    );

    await converter.setEtherToken(etherToken.address);
    await converter.addReserve(ETH_RESERVE_ADDRESS, 150000);

    await token.issue(accounts[0], 20000);
    await reserveToken.transfer(converter.address, 5000);
    await etherToken.transfer(converter.address, 8000);
    await web3.eth.sendTransaction({from: accounts[0], to: converter.address, value: 8000});

    if (activate) {
        await token.transferOwnership(converter.address);
        await converter.acceptTokenOwnership();
    }

    return converter;
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

contract('BancorConverterWithEthReserve', accounts => {
    before(async () => {
        contractRegistry = await ContractRegistry.new();

        let bancorFormula = await BancorFormula.new();
        await contractRegistry.registerAddress(ContractRegistryClient.BANCOR_FORMULA, bancorFormula.address);

        bancorNetwork = await BancorNetwork.new(contractRegistry.address);
        await contractRegistry.registerAddress(ContractRegistryClient.BANCOR_NETWORK, bancorNetwork.address);

        let factory = await ConverterFactory.new();
        await contractRegistry.registerAddress(ContractRegistryClient.CONVERTER_FACTORY, factory.address);

        upgrader = await ConverterUpgrader.new(contractRegistry.address, utils.zeroAddress);
        await contractRegistry.registerAddress(ContractRegistryClient.BANCOR_CONVERTER_UPGRADER, upgrader.address);

        let token = await SmartToken.new('Token1', 'TKN1', 2); 
        tokenAddress = token.address;

        reserveToken = await ERC20Token.new('ERC Token 1', 'ERC1', 0, 1000000000);
        etherToken = await EtherToken.new('Ether Token', 'ETH');
        reserveToken3 = await ERC20Token.new('ERC Token 3', 'ERC3', 0, 1500000000);

        await etherToken.deposit({ value: 2000000000 });
    });

    it('verifies the converter data after construction', async () => {
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 0, utils.zeroAddress, 0);
        let token = await converter.token.call();
        assert.equal(token, tokenAddress);
        let registry = await converter.registry.call();
        assert.equal(registry, contractRegistry.address);
        let maxConversionFee = await converter.maxConversionFee.call();
        assert.equal(maxConversionFee, 0);
    });

    it('should allow to claim tokens if caller is set as BancorX in the converter', async () => {
        let bancorX = accounts[2];
        let converter = await initConverter(accounts, true);
        await converter.setBancorX(bancorX);
        await token.transfer(accounts[1], 100);
        assert.equal((await token.balanceOf(accounts[1])).toNumber(), 100);
        await converter.claimTokens(accounts[1], 100, {from: bancorX});
        assert.equal((await token.balanceOf(accounts[1])).toNumber(), 0);
    });

    it('should not allow to claim tokens if caller is not set as BancorX in the converter', async () => {
        let bancorX = accounts[2];
        let converter = await initConverter(accounts, true);
        await token.transfer(accounts[1], 100);
        assert.equal((await token.balanceOf(accounts[1])).toNumber(), 100);
        await utils.catchRevert(converter.claimTokens(accounts[1], 100, {from: bancorX}));
        assert.equal((await token.balanceOf(accounts[1])).toNumber(), 100);
    });

    it('should throw when attempting to construct a converter with no token', async () => {
        await utils.catchRevert(BancorConverter.new(utils.zeroAddress, contractRegistry.address, 0, utils.zeroAddress, 0));
    });

    it('should throw when attempting to construct a converter with no contract registry', async () => {
        await utils.catchRevert(BancorConverter.new(tokenAddress, utils.zeroAddress, 0, utils.zeroAddress, 0));
    });

    it('should throw when attempting to construct a converter with invalid conversion fee', async () => {
        await utils.catchRevert(BancorConverter.new(tokenAddress, contractRegistry.address, 1000001, utils.zeroAddress, 0));
    });

    it('verifies the first reserve when provided at construction time', async () => {
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 0, reserveToken.address, 200000);
        let reserveTokenAddress = await converter.reserveTokens.call(0);
        assert.equal(reserveTokenAddress, reserveToken.address);
        let reserve = await converter.reserves.call(reserveTokenAddress);
        verifyReserve(reserve, 0, 200000, true);
    });

    it('should throw when attempting to construct a converter with a reserve with invalid weight', async () => {
        await utils.catchRevert(BancorConverter.new(tokenAddress, contractRegistry.address, 0, reserveToken.address, 1000001));
    });

    it('verifies the reserve token count and ratio before / after adding a reserve', async () => {
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 0, reserveToken.address, 100000);
        let reserveTokenCount = await converter.reserveTokenCount.call();
        let reserveRatio = await converter.reserveRatio.call();
        assert.equal(reserveTokenCount.toFixed(), '1');
        assert.equal(reserveRatio.toFixed(), '100000');
        await converter.addReserve(ETH_RESERVE_ADDRESS, 200000);
        reserveTokenCount = await converter.reserveTokenCount.call();
        reserveRatio = await converter.reserveRatio.call();
        assert.equal(reserveTokenCount.toFixed(), '2');
        assert.equal(reserveRatio.toFixed(), '300000');
    });

    it('verifies the owner can update the conversion whitelist contract address', async () => {
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 0, utils.zeroAddress, 0);
        let prevWhitelist = await converter.conversionWhitelist.call();
        await converter.setConversionWhitelist(accounts[3]);
        let newWhitelist = await converter.conversionWhitelist.call();
        assert.notEqual(prevWhitelist, newWhitelist);
    });

    it('should throw when a non owner attempts update the conversion whitelist contract address', async () => {
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 0, utils.zeroAddress, 0);

        await utils.catchRevert(converter.setConversionWhitelist(accounts[3], { from: accounts[1] }));
    });

    it('verifies the owner can remove the conversion whitelist contract address', async () => {
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 0, utils.zeroAddress, 0);
        await converter.setConversionWhitelist(accounts[3]);
        let whitelist = await converter.conversionWhitelist.call();
        assert.equal(whitelist, accounts[3]);
        await converter.setConversionWhitelist(utils.zeroAddress);
        whitelist = await converter.conversionWhitelist.call();
        assert.equal(whitelist, utils.zeroAddress);
    });

    it('should throw when the owner attempts update the conversion whitelist contract address with the converter address', async () => {
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 0, utils.zeroAddress, 0);

        await utils.catchRevert(converter.setConversionWhitelist(converter.address));
    });

    it('verifies the owner can update the fee', async () => {
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 200000, utils.zeroAddress, 0);
        await converter.setConversionFee(30000);
        let conversionFee = await converter.conversionFee.call();
        assert.equal(conversionFee, 30000);
    });

    it('should throw when attempting to update the fee to an invalid value', async () => {
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 200000, utils.zeroAddress, 0);

        await utils.catchRevert(converter.setConversionFee(200001));
    });

    it('should throw when a non owner attempts to update the fee', async () => {
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 200000, utils.zeroAddress, 0);

        await utils.catchRevert(converter.setConversionFee(30000, { from: accounts[1] }));
    });

    it('verifies that getFinalAmount returns the correct amount', async () => {
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 200000, utils.zeroAddress, 0);
        await converter.setConversionFee(10000);
        let finalAmount = await converter.getFinalAmount.call(500000, 1);
        assert.equal(finalAmount, 495000);
        finalAmount = await converter.getFinalAmount.call(500000, 2);
        assert.equal(finalAmount, 490050);
    });

    it('verifies that an event is fired when the owner updates the fee', async () => {
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 200000, utils.zeroAddress, 0);
        let watcher = converter.ConversionFeeUpdate();
        await converter.setConversionFee(30000);
        let events = await watcher.get();
        assert.equal(events[0].args._prevFee.valueOf(), 0);
        assert.equal(events[0].args._newFee.valueOf(), 30000);
    });

    it('verifies that an event is fired when the owner updates the fee multiple times', async () => {
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 200000, utils.zeroAddress, 0);
        let watcher = converter.ConversionFeeUpdate();
        let events;
        for (let i = 1; i <= 10; ++i) {
            await converter.setConversionFee(10000 * i);
            events = await watcher.get();
            assert.equal(events[0].args._prevFee.valueOf(), 10000 * (i - 1));
            assert.equal(events[0].args._newFee.valueOf(), 10000 * i);
        }
    });

    it('should not fire an event when attempting to update the fee to an invalid value', async () => {
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 200000, utils.zeroAddress, 0);
        let watcher = converter.ConversionFeeUpdate();

        await utils.catchRevert(converter.setConversionFee(200001));
        let events = await watcher.get();
        assert.equal(events.length, 0);
    });

    it('should not fire an event when a non owner attempts to update the fee', async () => {
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 200000, utils.zeroAddress, 0);
        let watcher = converter.ConversionFeeUpdate();

        await utils.catchRevert(converter.setConversionFee(30000, { from: accounts[1] }));
        let events = await watcher.get();
        assert.equal(events.length, 0);
    });

    it('verifies that 2 reserves are added correctly', async () => {
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 0, utils.zeroAddress, 0);
        await converter.addReserve(reserveToken.address, weight10Percent);
        let reserve = await converter.reserves.call(reserveToken.address);
        verifyReserve(reserve, 0, weight10Percent, true);
        await converter.addReserve(ETH_RESERVE_ADDRESS, 200000);
        reserve = await converter.reserves.call(ETH_RESERVE_ADDRESS);
        verifyReserve(reserve, 0, 200000, true);
    });

    it('should throw when a non owner attempts to add a reserve', async () => {
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 0, utils.zeroAddress, 0);

        await utils.catchRevert(converter.addReserve(reserveToken.address, weight10Percent, { from: accounts[1] }));
    });

    it('should throw when attempting to add a reserve when the converter is active', async () => {
        let token = await SmartToken.new('Token1', 'TKN1', 2);
        let converter = await BancorConverter.new(token.address, contractRegistry.address, 0, utils.zeroAddress, 0);
        await token.issue(accounts[0], 20000);
        await token.transferOwnership(converter.address);
        await converter.acceptTokenOwnership();

        await utils.catchRevert(converter.addReserve(reserveToken.address, weight10Percent));
    });

    it('should throw when attempting to add a reserve with invalid address', async () => {
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 0, utils.zeroAddress, 0);

        await utils.catchRevert(converter.addReserve(utils.zeroAddress, weight10Percent));
    });

    it('should throw when attempting to add a reserve with weight = 0', async () => {
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 0, utils.zeroAddress, 0);

        await utils.catchRevert(converter.addReserve(reserveToken.address, 0));
    });

    it('should throw when attempting to add a reserve with weight greater than 100%', async () => {
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 0, utils.zeroAddress, 0);

        await utils.catchRevert(converter.addReserve(reserveToken.address, 1000001));
    });

    it('should throw when attempting to add the token as a reserve', async () => {
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 0, utils.zeroAddress, 0);

        await utils.catchRevert(converter.addReserve(tokenAddress, weight10Percent));
    });

    it('should throw when attempting to add the converter as a reserve', async () => {
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 0, utils.zeroAddress, 0);

        await utils.catchRevert(converter.addReserve(converter.address, weight10Percent));
    });

    it('should throw when attempting to add a reserve that already exists', async () => {
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 0, utils.zeroAddress, 0);
        await converter.addReserve(reserveToken.address, weight10Percent);

        await utils.catchRevert(converter.addReserve(reserveToken.address, 200000));
    });

    it('should throw when attempting to add multiple reserves with ratio greater than 100%', async () => {
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 0, utils.zeroAddress, 0);
        await converter.addReserve(reserveToken.address, 500000);

        await utils.catchRevert(converter.addReserve(ETH_RESERVE_ADDRESS, 500001));
    });

    it('verifies that the correct reserve weight is returned', async () => {
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 0, reserveToken.address, weight10Percent);
        let reserveWeight = await converter.reserveWeight(reserveToken.address);
        assert.equal(reserveWeight, weight10Percent);
    });

    it('should throw when attempting to retrieve the balance for a reserve that does not exist', async () => {
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 0, utils.zeroAddress, 0);
        await converter.addReserve(reserveToken.address, weight10Percent);

        await utils.catchRevert(converter.reserveBalance.call(ETH_RESERVE_ADDRESS));
    });

    it('verifies that the owner can transfer the token ownership if the owner is the upgrader contract', async () => {
        let converter = await initConverter(accounts, true);

        await contractRegistry.registerAddress(ContractRegistryClient.BANCOR_CONVERTER_UPGRADER, accounts[0]);

        await converter.transferTokenOwnership(accounts[1]);

        await contractRegistry.registerAddress(ContractRegistryClient.BANCOR_CONVERTER_UPGRADER, upgrader.address);
        let tokenAddress = await converter.token.call();
        let contract = await web3.eth.contract(JSON.parse(fs.readFileSync(__dirname + '/../build/SmartToken.abi')));
        let token = await contract.at(tokenAddress);
        let newOwner = await token.newOwner.call();
        assert.equal(newOwner, accounts[1]);
    });

    it('should throw when the owner attempts to transfer the token ownership', async () => {
        let converter = await initConverter(accounts, true);

        await utils.catchRevert(converter.transferTokenOwnership(accounts[1]));
    });

    it('should throw when a non owner attempts to transfer the token ownership', async () => {
        let converter = await initConverter(accounts, true);

        await utils.catchRevert(converter.transferTokenOwnership(accounts[1], { from: accounts[2] }));
    });

    it('should throw when a the upgrader contract attempts to transfer the token ownership while the upgrader is not the owner', async () => {
        let converter = await initConverter(accounts, true);
        await contractRegistry.registerAddress(ContractRegistryClient.BANCOR_CONVERTER_UPGRADER, accounts[2]);

        await utils.catchRevert(converter.transferTokenOwnership(accounts[1], { from: accounts[2] }));
        await contractRegistry.registerAddress(ContractRegistryClient.BANCOR_CONVERTER_UPGRADER, upgrader.address);
    });

    it('verifies that the owner can withdraw a non reserve token from the converter while the converter is not active', async () => {
        let converter = await initConverter(accounts, false);

        let token = await ERC20Token.new('ERC Token 3', 'ERC3', 0, 100000);
        await token.transfer(converter.address, 100);
        let balance = await token.balanceOf.call(converter.address);
        assert.equal(balance, 100);

        await converter.withdrawTokens(token.address, accounts[1], 50);
        balance = await token.balanceOf.call(accounts[1]);
        assert.equal(balance, 50);
    });

    it('verifies that the owner can withdraw a reserve token from the converter while the converter is not active', async () => {
        let converter = await initConverter(accounts, false);

        await converter.withdrawTokens(reserveToken.address, accounts[1], 50);
        balance = await reserveToken.balanceOf.call(accounts[1]);
        assert.equal(balance, 50);
    });

    it('verifies that the owner can withdraw a non reserve token from the converter while the converter is active', async () => {
        let converter = await initConverter(accounts, true);

        let token = await ERC20Token.new('ERC Token 3', 'ERC3', 0, 100000);
        await token.transfer(converter.address, 100);
        let balance = await token.balanceOf.call(converter.address);
        assert.equal(balance, 100);

        await converter.withdrawTokens(token.address, accounts[1], 50);
        balance = await token.balanceOf.call(accounts[1]);
        assert.equal(balance, 50);
    });
 
    it('should throw when the owner attempts to withdraw a reserve token while the converter is active', async () => {
        let converter = await initConverter(accounts, true);

        await utils.catchRevert(converter.withdrawTokens(reserveToken.address, accounts[1], 50));
    });

    it('should throw when a non owner attempts to withdraw a non reserve token while the converter is not active', async () => {
        let converter = await initConverter(accounts, false);

        let token = await ERC20Token.new('ERC Token 3', 'ERC3', 0, 100000);
        await token.transfer(converter.address, 100);
        let balance = await token.balanceOf.call(converter.address);
        assert.equal(balance, 100);

        await utils.catchRevert(converter.withdrawTokens(token.address, accounts[1], 50, { from: accounts[2] }));
    });

    it('should throw when a non owner attempts to withdraw a reserve token while the converter is not active', async () => {
        let converter = await initConverter(accounts, false);

        await utils.catchRevert(converter.withdrawTokens(reserveToken.address, accounts[1], 50, { from: accounts[2] }));
    });

    it('should throw when a non owner attempts to withdraw a reserve token while the converter is active', async () => {
        let converter = await initConverter(accounts, true);

        await utils.catchRevert(converter.withdrawTokens(reserveToken.address, accounts[1], 50, { from: accounts[2] }));
    });

    it('verifies that the owner can upgrade the converter while the converter is active', async () => {
        let converter = await initConverter(accounts, true);
        await converter.upgrade();
    });

    it('verifies that the owner can upgrade the converter while the converter is not active', async () => {
        let converter = await initConverter(accounts, false);
        await converter.upgrade();
    });

    it('verifies that the owner can upgrade the converter while the converter using the legacy upgrade function', async () => {
        let converter = await initConverter(accounts, true);
        await converter.transferOwnership(upgrader.address);
        await upgrader.upgradeOld(converter.address, web3.fromUtf8("0.9"));
    });

    it('should throw when a non owner attempts to upgrade the converter', async () => {
        let converter = await initConverter(accounts, true);

        await utils.catchRevert(converter.upgrade({ from: accounts[1] }));
    });

    it('verifies that getReturn returns a valid amount', async () => {
        let converter = await initConverter(accounts, true);
        let returnAmount = (await converter.getReturn.call(reserveToken.address, tokenAddress, 500))[0];
        assert.isNumber(returnAmount.toNumber());
        assert.notEqual(returnAmount.toNumber(), 0);
    });

    it('verifies that getReturn returns the same amount as buy -> sell when converting between 2 reserves', async () => {
        let converter = await initConverter(accounts, true);
        let watcher = converter.Conversion();
        let returnAmount = (await converter.getReturn.call(reserveToken.address, ETH_RESERVE_ADDRESS, 500))[0];

        await approve(reserveToken, accounts[0], bancorNetwork.address, 500);
        await bancorNetwork.convert([reserveToken.address, tokenAddress, tokenAddress], 500, 1);
        let purchaseAmount = await getConversionAmount(watcher);
        await approve(token, accounts[0], bancorNetwork.address, purchaseAmount);
        await bancorNetwork.convert([tokenAddress, tokenAddress, ETH_RESERVE_ADDRESS], purchaseAmount, 1);
        let saleAmount = await getConversionAmount(watcher);

        // converting directly between 2 tokens is more efficient than buying and then selling
        // which might result in a very small rounding difference
        assert(returnAmount.minus(saleAmount).absoluteValue().toNumber() < 2);
    });

    it('verifies that Conversion event returns conversion fee after buying', async () => {
        let converter = await initConverter(accounts, true, 5000);
        let watcher = converter.Conversion();
        await converter.setConversionFee(3000);
        await approve(reserveToken, accounts[0], bancorNetwork.address, 500);
        await bancorNetwork.convert([reserveToken.address, tokenAddress, tokenAddress], 500, 1);
        let events = await watcher.get();
        assert(events.length > 0);
        assert('_conversionFee' in events[0].args);
    });

    it('verifies that Conversion event returns conversion fee after selling', async () => {
        let converter = await initConverter(accounts, true, 5000);
        let watcher = converter.Conversion();
        await converter.setConversionFee(3000);
        await approve(token, accounts[0], bancorNetwork.address, 500);
        await bancorNetwork.convert([tokenAddress, tokenAddress, reserveToken.address], 500, 1);
        let events = await watcher.get();
        assert(events.length > 0);
        assert('_conversionFee' in events[0].args);
    });

    it('should succeed when attempting to get the return from ETH reserve to token', async () => {
        let converter = await initConverter(accounts, true);

        let [amount, fee] = await converter.getReturn.call(ETH_RESERVE_ADDRESS, reserveToken.address, 500);
        assert(amount.equals(178) && fee.equals(0));
    });

    it('should succeed when attempting to get the return from token to ETH reserve', async () => {
        let converter = await initConverter(accounts, true);

        let [amount, fee] = await converter.getReturn.call(reserveToken.address, ETH_RESERVE_ADDRESS, 500);
        assert(amount.equals(1175) && fee.equals(0));
    });

    it('should throw when attempting to get the return with identical source/target addresses', async () => {
        let converter = await initConverter(accounts, true);

        await utils.catchRevert(converter.getReturn.call(tokenAddress, tokenAddress, 500));
    });

    it('should throw when attempting to get the purchase return while the converter is not active', async () => {
        let converter = await initConverter(accounts, false);

        await utils.catchRevert(converter.getReturn.call(reserveToken.address, tokenAddress, 500));
    });

    it('should throw when attempting to get the sale return while the converter is not active', async () => {
        let converter = await initConverter(accounts, false);

        await utils.catchRevert(converter.getReturn.call(tokenAddress, reserveToken.address, 500));
    });

    it('should throw when attempting to get the cross-reserve return while the converter is not active', async () => {
        let converter = await initConverter(accounts, false);

        await utils.catchRevert(converter.getReturn.call(reserveToken.address, reserveToken3.address, 500));
    });

    it('verifies that convert returns valid amount and fee after buying', async () => {
        let converter = await initConverter(accounts, true, 5000);
        let watcher = converter.Conversion();
        await converter.setConversionFee(3000);
        await approve(reserveToken, accounts[0], bancorNetwork.address, 500);
        await bancorNetwork.convert([reserveToken.address, tokenAddress, tokenAddress], 500, 1);
        let events = await watcher.get();
        assert(events.length > 0);
        assert(events[0].args._return.equals(480), events[0].args._conversionFee.equals(2));
    });

    it('verifies that convert returns valid amount and fee after selling', async () => {
        let converter = await initConverter(accounts, true, 5000);
        let watcher = converter.Conversion();
        await converter.setConversionFee(3000);
        await approve(token, accounts[0], bancorNetwork.address, 500);
        await bancorNetwork.convert([tokenAddress, tokenAddress, reserveToken.address], 500, 1);
        let events = await watcher.get();
        assert(events.length > 0);
        assert(events[0].args._return.equals(479), events[0].args._conversionFee.equals(2));
    });

    it('verifies that convert returns valid amount and fee after converting to ETH reserve', async () => {
        let converter = await initConverter(accounts, true, 5000);
        let watcher = converter.Conversion();
        await converter.setConversionFee(3000);
        await approve(reserveToken, accounts[0], bancorNetwork.address, 500);
        await bancorNetwork.convert([reserveToken.address, tokenAddress, ETH_RESERVE_ADDRESS], 500, 1);
        let events = await watcher.get();
        assert(events.length > 0);
        assert(events[0].args._return.equals(1167), events[0].args._conversionFee.equals(8));
    });

    it('verifies that selling right after buying does not result in an amount greater than the original purchase amount', async () => {
        let converter = await initConverter(accounts, true);
        let watcher = converter.Conversion();
        await approve(reserveToken, accounts[0], bancorNetwork.address, 500);
        await bancorNetwork.convert([reserveToken.address, tokenAddress, tokenAddress], 500, 1);
        let purchaseAmount = await getConversionAmount(watcher);
        await approve(token, accounts[0], bancorNetwork.address, purchaseAmount);
        await bancorNetwork.convert([tokenAddress, tokenAddress, reserveToken.address], purchaseAmount, 1);
        let saleAmount = await getConversionAmount(watcher);
        assert(saleAmount <= 500);
    });

    it('verifies that buying right after selling does not result in an amount greater than the original sale amount', async () => {
        let converter = await initConverter(accounts, true);
        let watcher = converter.Conversion();
        await approve(token, accounts[0], bancorNetwork.address, 500);
        await bancorNetwork.convert([tokenAddress, tokenAddress, reserveToken.address], 500, 1);
        let saleAmount = await getConversionAmount(watcher);
        await approve(reserveToken, accounts[0], bancorNetwork.address, 500);
        await bancorNetwork.convert([reserveToken.address, tokenAddress, tokenAddress], saleAmount, 1);
        let purchaseAmount = await getConversionAmount(watcher);

        assert(purchaseAmount <= 500);
    });

    it('should throw when attempting to convert from ETH reserve to token', async () => {
        let converter = await initConverter(accounts, true);
        await utils.catchRevert(bancorNetwork.convert([ETH_RESERVE_ADDRESS, tokenAddress, reserveToken.address], 500, 1));
    });

    it('should succeed when attempting to convert from token to ETH reserve', async () => {
        let converter = await initConverter(accounts, true);
        let watcher = converter.Conversion();
        await approve(reserveToken, accounts[0], bancorNetwork.address, 500);

        await bancorNetwork.convert([reserveToken.address, tokenAddress, ETH_RESERVE_ADDRESS], 500, 1);
        let events = await watcher.get();
        assert(events[0].args._return.equals(1175) && events[0].args._conversionFee.equals(0));
    });

    it('should throw when attempting to convert with identical source/target addresses', async () => {
        let converter = await initConverter(accounts, true);
        await approve(reserveToken, accounts[0], bancorNetwork.address, 500);

        await utils.catchRevert(bancorNetwork.convert([reserveToken.address, tokenAddress, reserveToken.address], 500, 1));
    });

    it('should throw when attempting to convert with 0 minimum requested amount', async () => {
        let converter = await initConverter(accounts, true);
        await approve(reserveToken, accounts[0], bancorNetwork.address, 500);

        await utils.catchRevert(bancorNetwork.convert([reserveToken.address, tokenAddress, ETH_RESERVE_ADDRESS], 500, 0));
    });

    it('should throw when attempting to convert when the return is smaller than the minimum requested amount', async () => {
        let converter = await initConverter(accounts, true);
        await approve(reserveToken, accounts[0], bancorNetwork.address, 500);

        await utils.catchRevert(bancorNetwork.convert([reserveToken.address, tokenAddress, ETH_RESERVE_ADDRESS], 500, 2000));
    });

    it('verifies balances after buy', async () => {
        let converter = await initConverter(accounts, true);
        let watcher = converter.Conversion();

        let tokenPrevBalance = await token.balanceOf.call(accounts[0]);
        let reserveTokenPrevBalance = await reserveToken.balanceOf.call(accounts[0]);

        await approve(reserveToken, accounts[0], bancorNetwork.address, 500);
        await bancorNetwork.convert([reserveToken.address, tokenAddress, tokenAddress], 500, 1);
        let purchaseAmount = await getConversionAmount(watcher);

        let reserveTokenNewBalance = await reserveToken.balanceOf.call(accounts[0]);
        assert.equal(reserveTokenNewBalance.toNumber(), reserveTokenPrevBalance.minus(500).toNumber());

        let tokenNewBalance = await token.balanceOf.call(accounts[0]);
        assert.equal(tokenNewBalance.toNumber(), tokenPrevBalance.plus(purchaseAmount).toNumber());
    });

    it('should throw when attempting to buy while the converter is not active', async () => {
        let converter = await initConverter(accounts, false);
        await approve(reserveToken, accounts[0], bancorNetwork.address, 500);

        await utils.catchRevert(bancorNetwork.convert([reserveToken.address, tokenAddress, tokenAddress], 500, 1));
    });

    it('should throw when attempting to buy with a non reserve address', async () => {
        let converter = await initConverter(accounts, true);
        await approve(token, accounts[0], bancorNetwork.address, 500);

        await utils.catchRevert(bancorNetwork.convert([tokenAddress, tokenAddress, tokenAddress], 500, 1));
    });

    it('should throw when attempting to buy while the purchase yields 0 return', async () => {
        let converter = await initConverter(accounts, true);
        await approve(reserveToken, accounts[0], bancorNetwork.address, 500);

        await utils.catchRevert(bancorNetwork.convert([reserveToken.address, tokenAddress, tokenAddress], 0, 1));
    });

    it('should throw when attempting to buy with 0 minimum requested amount', async () => {
        let converter = await initConverter(accounts, true);
        await approve(reserveToken, accounts[0], bancorNetwork.address, 500);

        await utils.catchRevert(bancorNetwork.convert([reserveToken.address, tokenAddress, tokenAddress], 500, 0));
    });

    it('should throw when attempting to buy without first approving the converter to transfer from the buyer account in the reserve contract', async () => {
        let converter = await initConverter(accounts, true);
        await approve(reserveToken, accounts[0], bancorNetwork.address, 0);

        await utils.catchRevert(bancorNetwork.convert([reserveToken.address, tokenAddress, tokenAddress], 500, 1));
    });

    it('verifies balances after sell', async () => {
        let converter = await initConverter(accounts, true);
        let watcher = converter.Conversion();

        let tokenPrevBalance = await token.balanceOf.call(accounts[0]);
        let reserveTokenPrevBalance = await reserveToken.balanceOf.call(accounts[0]);

        await approve(token, accounts[0], bancorNetwork.address, 500);
        await bancorNetwork.convert([tokenAddress, tokenAddress, reserveToken.address], 500, 1);
        let saleAmount = await getConversionAmount(watcher);

        let reserveTokenNewBalance = await reserveToken.balanceOf.call(accounts[0]);
        assert.equal(reserveTokenNewBalance.toNumber(), reserveTokenPrevBalance.plus(saleAmount).toNumber());

        let tokenNewBalance = await token.balanceOf.call(accounts[0]);
        assert.equal(tokenNewBalance.toNumber(), tokenPrevBalance.minus(500).toNumber());
    });

    it('should throw when attempting to sell while the converter is not active', async () => {
        let converter = await initConverter(accounts, false);
        await approve(token, accounts[0], bancorNetwork.address, 500);

        await utils.catchRevert(bancorNetwork.convert([tokenAddress, tokenAddress, reserveToken.address], 500, 1));
    });

    it('should throw when attempting to sell with a non reserve address', async () => {
        let converter = await initConverter(accounts, true);
        await approve(token, accounts[0], bancorNetwork.address, 500);

        await utils.catchRevert(bancorNetwork.convert([tokenAddress, tokenAddress, tokenAddress], 500, 1));
    });

    it('should throw when attempting to sell while the sale yields 0 return', async () => {
        let converter = await initConverter(accounts, true);
        await approve(token, accounts[0], bancorNetwork.address, 1);

        await utils.catchRevert(bancorNetwork.convert([tokenAddress, tokenAddress, reserveToken.address], 1, 1));
    });

    it('should throw when attempting to sell with amount greater then the seller balance', async () => {
        let converter = await initConverter(accounts, true);
        await approve(token, accounts[0], bancorNetwork.address, 30000);

        await utils.catchRevert(bancorNetwork.convert([tokenAddress, tokenAddress, reserveToken.address], 30000, 1));
    });

    it('should throw when attempting to execute fund on a single-reserve converter', async () => {
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 0, reserveToken.address, 1000000);

        await utils.catchRevert(converter.fund(1));
    });

    it('should throw when attempting to execute liquidate on a single-reserve converter', async () => {
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 0, reserveToken.address, 1000000);

        await utils.catchRevert(converter.liquidate(1));
    });

    it('verifies that getReturn returns the same amount as converting between 2 reserves', async () => {
        let converter = await initConverter(accounts, true);
        let watcher = converter.Conversion();
        let returnAmount = (await converter.getReturn.call(reserveToken.address, ETH_RESERVE_ADDRESS, 500))[0];

        await approve(reserveToken, accounts[0], bancorNetwork.address, 500);
        await bancorNetwork.convert([reserveToken.address, tokenAddress, ETH_RESERVE_ADDRESS], 500, 1);
        let returnAmount2 = await getConversionAmount(watcher);

        assert.equal(returnAmount.toNumber(), returnAmount2);
    });

    for (const percent of [50, 75, 100]) {
        it(`verifies that fund executes when the reserve ratio equals ${percent}%`, async () => {
            let converter = await initConverter(accounts, false);
            await converter.addReserve(reserveToken3.address, (percent - 40) * 10000);

            await reserveToken3.transfer(converter.address, 6000);

            await token.transferOwnership(converter.address);
            await converter.acceptTokenOwnership();

            let prevBalance = await token.balanceOf.call(accounts[0]);
            await reserveToken.approve(converter.address, 100000);
            await etherToken.approve(converter.address, 100000);
            await reserveToken3.approve(converter.address, 100000);
            await converter.fund(100);
            let balance = await token.balanceOf.call(accounts[0]);

            assert.equal(balance.toNumber(), prevBalance.toNumber() + 100);
        });
    }

    it('verifies that fund gets the correct reserve balance amounts from the caller', async () => {
        let converter = await initConverter(accounts, false);
        await converter.addReserve(reserveToken3.address, 600000);

        await reserveToken3.transfer(converter.address, 6000);

        await token.transferOwnership(converter.address);
        await converter.acceptTokenOwnership();

        await reserveToken.transfer(accounts[9], 5000);
        await etherToken.transfer(accounts[9], 5000);
        await reserveToken3.transfer(accounts[9], 5000);

        let supply = await token.totalSupply.call();
        let percentage = 100 / (supply / 19);
        let prevReserve1Balance = await converter.reserveBalance.call(reserveToken.address);
        let prevReserve2Balance = await converter.reserveBalance.call(ETH_RESERVE_ADDRESS);
        let prevReserve3Balance = await converter.reserveBalance.call(reserveToken3.address);
        let token1Amount = prevReserve1Balance * percentage / 100;
        let token2Amount = prevReserve2Balance * percentage / 100;
        let token3Amount = prevReserve3Balance * percentage / 100;

        await reserveToken.approve(converter.address, 100000, { from: accounts[9] });
        await etherToken.approve(converter.address, 100000, { from: accounts[9] });
        await reserveToken3.approve(converter.address, 100000, { from: accounts[9] });
        await converter.fund(19, { from: accounts[9], value: 10 });

        let reserve1Balance = await converter.reserveBalance.call(reserveToken.address);
        let reserve2Balance = await converter.reserveBalance.call(ETH_RESERVE_ADDRESS);
        let reserve3Balance = await converter.reserveBalance.call(reserveToken3.address);

        assert.equal(reserve1Balance.toFixed(), prevReserve1Balance.plus(Math.ceil(token1Amount)).toFixed());
        assert.equal(reserve2Balance.toFixed(), prevReserve2Balance.plus(Math.ceil(token2Amount)).toFixed());
        assert.equal(reserve3Balance.toFixed(), prevReserve3Balance.plus(Math.ceil(token3Amount)).toFixed());

        let token1Balance = await reserveToken.balanceOf.call(accounts[9]);
        let token2Balance = await etherToken.balanceOf.call(accounts[9]);
        let token3Balance = await reserveToken3.balanceOf.call(accounts[9]);

        await reserveToken.transfer(accounts[0], token1Balance, { from: accounts[9] });
        await etherToken.transfer(accounts[0], token2Balance, { from: accounts[9] });
        await reserveToken3.transfer(accounts[0], token3Balance, { from: accounts[9] });
    });

    it('verifies that increasing the liquidity by a large amount gets the correct reserve balance amounts from the caller', async () => {
        let converter = await initConverter(accounts, false);
        await converter.addReserve(reserveToken3.address, 600000);

        await reserveToken3.transfer(converter.address, 6000);

        await token.transferOwnership(converter.address);
        await converter.acceptTokenOwnership();

        await reserveToken.transfer(accounts[9], 500000);
        await etherToken.transfer(accounts[9], 500000);
        await reserveToken3.transfer(accounts[9], 500000);

        let supply = await token.totalSupply.call();
        let percentage = 100 / (supply / 140854);
        let prevReserve1Balance = await converter.reserveBalance.call(reserveToken.address);
        let prevReserve2Balance = await converter.reserveBalance.call(ETH_RESERVE_ADDRESS);
        let prevReserve3Balance = await converter.reserveBalance.call(reserveToken3.address);
        let token1Amount = prevReserve1Balance * percentage / 100;
        let token2Amount = prevReserve2Balance * percentage / 100;
        let token3Amount = prevReserve3Balance * percentage / 100;

        await reserveToken.approve(converter.address, 100000, { from: accounts[9] });
        await etherToken.approve(converter.address, 100000, { from: accounts[9] });
        await reserveToken3.approve(converter.address, 100000, { from: accounts[9] });
        await converter.fund(140854, { from: accounts[9], value: 200000 });

        let reserve1Balance = await converter.reserveBalance.call(reserveToken.address);
        let reserve2Balance = await converter.reserveBalance.call(ETH_RESERVE_ADDRESS);
        let reserve3Balance = await converter.reserveBalance.call(reserveToken3.address);

        assert.equal(reserve1Balance.toFixed(), prevReserve1Balance.plus(Math.ceil(token1Amount)).toFixed());
        assert.equal(reserve2Balance.toFixed(), prevReserve2Balance.plus(Math.ceil(token2Amount)).toFixed());
        assert.equal(reserve3Balance.toFixed(), prevReserve3Balance.plus(Math.ceil(token3Amount)).toFixed());

        let token1Balance = await reserveToken.balanceOf.call(accounts[9]);
        let token2Balance = await etherToken.balanceOf.call(accounts[9]);
        let token3Balance = await reserveToken3.balanceOf.call(accounts[9]);

        await reserveToken.transfer(accounts[0], token1Balance, { from: accounts[9] });
        await etherToken.transfer(accounts[0], token2Balance, { from: accounts[9] });
        await reserveToken3.transfer(accounts[0], token3Balance, { from: accounts[9] });
    });

    it('should throw when attempting to fund the converter with insufficient funds', async () => {
        let converter = await initConverter(accounts, false);
        await converter.addReserve(reserveToken3.address, 600000);

        await reserveToken3.transfer(converter.address, 6000);

        await token.transferOwnership(converter.address);
        await converter.acceptTokenOwnership();

        await reserveToken.transfer(accounts[9], 100);
        await etherToken.transfer(accounts[9], 100);
        await reserveToken3.transfer(accounts[9], 100);

        await reserveToken.approve(converter.address, 100000, { from: accounts[9] });
        await etherToken.approve(converter.address, 100000, { from: accounts[9] });
        await reserveToken3.approve(converter.address, 100000, { from: accounts[9] });
        await converter.fund(5, { from: accounts[9], value: 10 });

        await utils.catchRevert(converter.fund(600, { from: accounts[9], value: 10 }));
        let token1Balance = await reserveToken.balanceOf.call(accounts[9]);
        let token2Balance = await etherToken.balanceOf.call(accounts[9]);
        let token3Balance = await reserveToken3.balanceOf.call(accounts[9]);

        await reserveToken.transfer(accounts[0], token1Balance, { from: accounts[9] });
        await etherToken.transfer(accounts[0], token2Balance, { from: accounts[9] });
        await reserveToken3.transfer(accounts[0], token3Balance, { from: accounts[9] });
        
    });

    for (const percent of [50, 75, 100]) {
        it(`verifies that liquidate executes when the reserve ratio equals ${percent}%`, async () => {
            let converter = await initConverter(accounts, false);
            await converter.addReserve(reserveToken3.address, (percent - 40) * 10000);

            await reserveToken3.transfer(converter.address, 6000);

            await token.transferOwnership(converter.address);
            await converter.acceptTokenOwnership();

            let prevSupply = await token.totalSupply.call();
            await converter.liquidate(100);
            let supply = await token.totalSupply();

            assert.equal(prevSupply - 100, supply);
        });
    }

    it('verifies that liquidate sends the correct reserve balance amounts to the caller', async () => {
        let converter = await initConverter(accounts, false);
        await converter.addReserve(reserveToken3.address, 600000);

        await reserveToken3.transfer(converter.address, 6000);

        await token.transferOwnership(converter.address);
        await converter.acceptTokenOwnership();

        await token.transfer(accounts[9], 100);

        let supply = await token.totalSupply.call();
        let percentage = 100 / (supply / 19);
        let reserve1Balance = await converter.reserveBalance.call(reserveToken.address);
        //let reserve2Balance = await converter.reserveBalance.call(ETH_RESERVE_ADDRESS);
        let reserve3Balance = await converter.reserveBalance.call(reserveToken3.address);
        let token1Amount = reserve1Balance * percentage / 100;
        //let token2Amount = reserve2Balance * percentage / 100;
        let token3Amount = reserve3Balance * percentage / 100;

        await converter.liquidate(19, { from: accounts[9] });

        let token1Balance = await reserveToken.balanceOf.call(accounts[9]);
        //let token2Balance = await reserveToken2.balanceOf.call(accounts[9]);
        let token3Balance = await reserveToken3.balanceOf.call(accounts[9]);

        assert.equal(token1Balance.toNumber(), Math.floor(token1Amount));
        //assert.equal(token2Balance.toNumber(), Math.floor(token2Amount));
        assert.equal(token3Balance.toNumber(), Math.floor(token3Amount));

        await reserveToken.transfer(accounts[0], token1Balance, { from: accounts[9] });
        //await etherToken.transfer(accounts[0], token2Balance, { from: accounts[9] });
        await reserveToken3.transfer(accounts[0], token3Balance, { from: accounts[9] });
    });

    it('verifies that liquidating a large amount sends the correct reserve balance amounts to the caller', async () => {
        let converter = await initConverter(accounts, false);
        await converter.addReserve(reserveToken3.address, 600000);

        await reserveToken3.transfer(converter.address, 6000);

        await token.transferOwnership(converter.address);
        await converter.acceptTokenOwnership();

        await token.transfer(accounts[9], 15000);

        let supply = await token.totalSupply.call();
        let percentage = 100 / (supply / 14854);
        let reserve1Balance = await converter.reserveBalance.call(reserveToken.address);
        //let reserve2Balance = await converter.reserveBalance.call(ETH_RESERVE_ADDRESS);
        let reserve3Balance = await converter.reserveBalance.call(reserveToken3.address);
        let token1Amount = reserve1Balance * percentage / 100;
        //let token2Amount = reserve2Balance * percentage / 100;
        let token3Amount = reserve3Balance * percentage / 100;

        await converter.liquidate(14854, { from: accounts[9] });

        supply = await token.totalSupply.call();
        let token1Balance = await reserveToken.balanceOf.call(accounts[9]);
        //let token2Balance = await reserveToken2.balanceOf.call(accounts[9]);
        let token3Balance = await reserveToken3.balanceOf.call(accounts[9]);

        assert.equal(token1Balance.toNumber(), Math.floor(token1Amount));
        //assert.equal(token2Balance.toNumber(), Math.floor(token2Amount));
        assert.equal(token3Balance.toNumber(), Math.floor(token3Amount));

        await reserveToken.transfer(accounts[0], token1Balance, { from: accounts[9] });
        //await etherToken.transfer(accounts[0], token2Balance, { from: accounts[9] });
        await reserveToken3.transfer(accounts[0], token3Balance, { from: accounts[9] });
    });

    it('verifies that liquidating the entire supply sends the full reserve balances to the caller', async () => {
        let converter = await initConverter(accounts, false);
        await converter.addReserve(reserveToken3.address, 600000);

        await reserveToken3.transfer(converter.address, 6000);

        await token.transferOwnership(converter.address);
        await converter.acceptTokenOwnership();

        await token.transfer(accounts[9], 20000);

        let reserve1Balance = await converter.reserveBalance.call(reserveToken.address);
        //let reserve2Balance = await converter.reserveBalance.call(ETH_RESERVE_ADDRESS);
        let reserve3Balance = await converter.reserveBalance.call(reserveToken3.address);

        await converter.liquidate(20000, { from: accounts[9] });

        let supply = await token.totalSupply.call();
        let token1Balance = await reserveToken.balanceOf.call(accounts[9]);
        //let token2Balance = await reserveToken2.balanceOf.call(accounts[9]);
        let token3Balance = await reserveToken3.balanceOf.call(accounts[9]);

        assert.equal(supply, 0);
        assert.equal(token1Balance.toFixed(), reserve1Balance.toFixed());
        //assert.equal(token2Balance.toFixed(), reserve2Balance.toFixed());
        assert.equal(token3Balance.toFixed(), reserve3Balance.toFixed());

        await reserveToken.transfer(accounts[0], token1Balance, { from: accounts[9] });
        //await etherToken.transfer(accounts[0], token2Balance, { from: accounts[9] });
        await reserveToken3.transfer(accounts[0], token3Balance, { from: accounts[9] });
    });

    it('should throw when attempting to liquidate with insufficient funds', async () => {
        let converter = await initConverter(accounts, false);
        await converter.addReserve(reserveToken3.address, 600000);

        await reserveToken3.transfer(converter.address, 6000);

        await token.transferOwnership(converter.address);
        await converter.acceptTokenOwnership();

        await token.transfer(accounts[9], 100);

        await converter.liquidate(5, { from: accounts[9] });

        await utils.catchRevert(converter.liquidate(600, { from: accounts[9] }));
    });

    it('should throw when attempting to register the registry to the zero address', async () => {
        await utils.catchRevert(contractRegistry.registerAddress(ContractRegistryClient.CONTRACT_REGISTRY, utils.zeroAddress));
    });

    it('should throw when attempting to update the registry when it points to the zero address', async () => {
        let converter = await initConverter(accounts, false);

        await utils.catchRevert(converter.updateRegistry());
        assert.equal(await converter.registry.call(), contractRegistry.address);
        assert.equal(await converter.prevRegistry.call(), contractRegistry.address);
    });

    it('should throw when attempting to update the registry when it points to the current registry', async () => {
        let converter = await initConverter(accounts, false);

        await contractRegistry.registerAddress(ContractRegistryClient.CONTRACT_REGISTRY, contractRegistry.address);
        await utils.catchRevert(converter.updateRegistry());
        assert.equal(await converter.registry.call(), contractRegistry.address);
        assert.equal(await converter.prevRegistry.call(), contractRegistry.address);
    });

    it('should throw when attempting to update the registry when it points to a new registry which points to the zero address', async () => {
        let converter = await initConverter(accounts, false);

        let newRegistry = await ContractRegistry.new();
        await contractRegistry.registerAddress(ContractRegistryClient.CONTRACT_REGISTRY, newRegistry.address);
        await utils.catchRevert(converter.updateRegistry());
        assert.equal(await converter.registry.call(), contractRegistry.address);
        assert.equal(await converter.prevRegistry.call(), contractRegistry.address);

        // set the original registry back
        await contractRegistry.registerAddress(ContractRegistryClient.CONTRACT_REGISTRY, contractRegistry.address);
    });

    it('should allow anyone to update the registry address', async () => {
        let converter = await initConverter(accounts, false);
        let newRegistry = await ContractRegistry.new();

        await contractRegistry.registerAddress(ContractRegistryClient.CONTRACT_REGISTRY, newRegistry.address);
        await newRegistry.registerAddress(ContractRegistryClient.CONTRACT_REGISTRY, newRegistry.address);
        await converter.updateRegistry({ from: accounts[1] });

        assert.equal(await converter.registry.call(), newRegistry.address);
        assert.equal(await converter.prevRegistry.call(), contractRegistry.address);

        // set the original registry back
        await contractRegistry.registerAddress(ContractRegistryClient.CONTRACT_REGISTRY, contractRegistry.address);
    });

    it('should allow the owner to restore the previous registry and disable updates', async () => {
        let converter = await initConverter(accounts, false);
        let newRegistry = await ContractRegistry.new();

        await contractRegistry.registerAddress(ContractRegistryClient.CONTRACT_REGISTRY, newRegistry.address);
        await newRegistry.registerAddress(ContractRegistryClient.CONTRACT_REGISTRY, newRegistry.address);
        await converter.updateRegistry({ from: accounts[1] });

        await converter.restoreRegistry({ from: accounts[0] });

        assert.equal(await converter.registry.call(), contractRegistry.address);
        assert.equal(await converter.prevRegistry.call(), contractRegistry.address);

        await converter.restrictRegistryUpdate(true, { from: accounts[0] });
        await utils.catchRevert(converter.updateRegistry({ from: accounts[1] }));

        await converter.updateRegistry({ from: accounts[0] });
        assert.equal(await converter.registry.call(), newRegistry.address);
        assert.equal(await converter.prevRegistry.call(), contractRegistry.address);

        // re register address
        await contractRegistry.registerAddress(ContractRegistryClient.CONTRACT_REGISTRY, contractRegistry.address);
    });

    it('verifies that getReturn returns the same amount as buy -> sell when converting between 2 reserves', async () => {
        let converter = await initConverter(accounts, true);
        let watcher = converter.Conversion();
        let returnAmount = (await converter.getReturn.call(reserveToken.address, ETH_RESERVE_ADDRESS, 500))[0];

        await approve(reserveToken, accounts[0], bancorNetwork.address, 500);
        await bancorNetwork.convert2([reserveToken.address, tokenAddress, tokenAddress], 500, 1, utils.zeroAddress, 0);
        let purchaseAmount = await getConversionAmount(watcher);
        await approve(token, accounts[0], bancorNetwork.address, purchaseAmount);
        await bancorNetwork.convert2([tokenAddress, tokenAddress, ETH_RESERVE_ADDRESS], purchaseAmount, 1, utils.zeroAddress, 0);
        let saleAmount = await getConversionAmount(watcher);

        // converting directly between 2 tokens is more efficient than buying and then selling
        // which might result in a very small rounding difference
        assert(returnAmount.minus(saleAmount).absoluteValue().toNumber() < 2);
    });

    it('verifies that convert2 returns valid amount and fee after buying', async () => {
        let converter = await initConverter(accounts, true, 5000);
        let watcher = converter.Conversion();
        await converter.setConversionFee(3000);
        await approve(reserveToken, accounts[0], bancorNetwork.address, 500);
        await bancorNetwork.convert2([reserveToken.address, tokenAddress, tokenAddress], 500, 1, utils.zeroAddress, 0);
        let events = await watcher.get();
        assert(events.length > 0);
        assert(events[0].args._return.equals(480), events[0].args._conversionFee.equals(2));
    });

    it('verifies that convert2 returns valid amount and fee after selling', async () => {
        let converter = await initConverter(accounts, true, 5000);
        let watcher = converter.Conversion();
        await converter.setConversionFee(3000);
        await approve(token, accounts[0], bancorNetwork.address, 500);
        await bancorNetwork.convert2([tokenAddress, tokenAddress, reserveToken.address], 500, 1, utils.zeroAddress, 0);
        let events = await watcher.get();
        assert(events.length > 0);
        assert(events[0].args._return.equals(479), events[0].args._conversionFee.equals(2));
    });

    it('verifies that convert2 returns valid amount and fee after converting to ETH reserve', async () => {
        let converter = await initConverter(accounts, true, 5000);
        let watcher = converter.Conversion();
        await converter.setConversionFee(3000);
        await approve(reserveToken, accounts[0], bancorNetwork.address, 500);
        await bancorNetwork.convert2([reserveToken.address, tokenAddress, ETH_RESERVE_ADDRESS], 500, 1, utils.zeroAddress, 0);
        let events = await watcher.get();
        assert(events.length > 0);
        assert(events[0].args._return.equals(1167), events[0].args._conversionFee.equals(8));
    });

    it('verifies that selling right after buying does not result in an amount greater than the original purchase amount', async () => {
        let converter = await initConverter(accounts, true);
        let watcher = converter.Conversion();
        await approve(reserveToken, accounts[0], bancorNetwork.address, 500);
        await bancorNetwork.convert2([reserveToken.address, tokenAddress, tokenAddress], 500, 1, utils.zeroAddress, 0);
        let purchaseAmount = await getConversionAmount(watcher);
        await approve(token, accounts[0], bancorNetwork.address, purchaseAmount);
        await bancorNetwork.convert2([tokenAddress, tokenAddress, reserveToken.address], purchaseAmount, 1, utils.zeroAddress, 0);
        let saleAmount = await getConversionAmount(watcher);
        assert(saleAmount <= 500);
    });

    it('verifies that buying right after selling does not result in an amount greater than the original sale amount', async () => {
        let converter = await initConverter(accounts, true);
        let watcher = converter.Conversion();
        await approve(token, accounts[0], bancorNetwork.address, 500);
        await bancorNetwork.convert2([tokenAddress, tokenAddress, reserveToken.address], 500, 1, utils.zeroAddress, 0);
        let saleAmount = await getConversionAmount(watcher);
        await approve(reserveToken, accounts[0], bancorNetwork.address, 500);
        await bancorNetwork.convert2([reserveToken.address, tokenAddress, tokenAddress], saleAmount, 1, utils.zeroAddress, 0);
        let purchaseAmount = await getConversionAmount(watcher);

        assert(purchaseAmount <= 500);
    });

    it('should throw when attempting to convert2 from ETH reserve to token', async () => {
        let converter = await initConverter(accounts, true);
        await utils.catchRevert(bancorNetwork.convert2([ETH_RESERVE_ADDRESS, tokenAddress, reserveToken.address], 500, 1, utils.zeroAddress, 0));
    });

    it('should succeed when attempting to convert2 from token to ETH reserve', async () => {
        let converter = await initConverter(accounts, true);
        let watcher = converter.Conversion();
        await approve(reserveToken, accounts[0], bancorNetwork.address, 500);

        await bancorNetwork.convert2([reserveToken.address, tokenAddress, ETH_RESERVE_ADDRESS], 500, 1, utils.zeroAddress, 0);
        let events = await watcher.get();
        assert(events[0].args._return.equals(1175) && events[0].args._conversionFee.equals(0));
    });

    it('should throw when attempting to convert2 with identical source/target addresses', async () => {
        let converter = await initConverter(accounts, true);
        await approve(reserveToken, accounts[0], bancorNetwork.address, 500);

        await utils.catchRevert(bancorNetwork.convert2([reserveToken.address, tokenAddress, reserveToken.address], 500, 1, utils.zeroAddress, 0));
    });

    it('should throw when attempting to convert2 with 0 minimum requested amount', async () => {
        let converter = await initConverter(accounts, true);
        await approve(reserveToken, accounts[0], bancorNetwork.address, 500);

        await utils.catchRevert(bancorNetwork.convert2([reserveToken.address, tokenAddress, ETH_RESERVE_ADDRESS], 500, 0, utils.zeroAddress, 0));
    });

    it('should throw when attempting to convert2 when the return is smaller than the minimum requested amount', async () => {
        let converter = await initConverter(accounts, true);
        await approve(reserveToken, accounts[0], bancorNetwork.address, 500);

        await utils.catchRevert(bancorNetwork.convert2([reserveToken.address, tokenAddress, ETH_RESERVE_ADDRESS], 500, 2000, utils.zeroAddress, 0));
    });

    it('verifies balances after buy', async () => {
        let converter = await initConverter(accounts, true);
        let watcher = converter.Conversion();

        let tokenPrevBalance = await token.balanceOf.call(accounts[0]);
        let reserveTokenPrevBalance = await reserveToken.balanceOf.call(accounts[0]);

        await approve(reserveToken, accounts[0], bancorNetwork.address, 500);
        await bancorNetwork.convert2([reserveToken.address, tokenAddress, tokenAddress], 500, 1, utils.zeroAddress, 0);
        let purchaseAmount = await getConversionAmount(watcher);

        let reserveTokenNewBalance = await reserveToken.balanceOf.call(accounts[0]);
        assert.equal(reserveTokenNewBalance.toNumber(), reserveTokenPrevBalance.minus(500).toNumber());

        let tokenNewBalance = await token.balanceOf.call(accounts[0]);
        assert.equal(tokenNewBalance.toNumber(), tokenPrevBalance.plus(purchaseAmount).toNumber());
    });

    it('should throw when attempting to buy while the converter is not active', async () => {
        let converter = await initConverter(accounts, false);
        await approve(reserveToken, accounts[0], bancorNetwork.address, 500);

        await utils.catchRevert(bancorNetwork.convert2([reserveToken.address, tokenAddress, tokenAddress], 500, 1, utils.zeroAddress, 0));
    });

    it('should throw when attempting to buy with a non reserve address', async () => {
        let converter = await initConverter(accounts, true);
        await approve(reserveToken, accounts[0], bancorNetwork.address, 500);

        await utils.catchRevert(bancorNetwork.convert2([tokenAddress, tokenAddress, tokenAddress], 500, 1, utils.zeroAddress, 0));
    });

    it('should throw when attempting to buy while the purchase yields 0 return', async () => {
        let converter = await initConverter(accounts, true);
        await approve(reserveToken, accounts[0], bancorNetwork.address, 500);

        await utils.catchRevert(bancorNetwork.convert2([reserveToken.address, tokenAddress, tokenAddress], 0, 1, utils.zeroAddress, 0));
    });

    it('should throw when attempting to buy with 0 minimum requested amount', async () => {
        let converter = await initConverter(accounts, true);
        await approve(reserveToken, accounts[0], bancorNetwork.address, 500);

        await utils.catchRevert(bancorNetwork.convert2([reserveToken.address, tokenAddress, tokenAddress], 500, 0, utils.zeroAddress, 0));
    });

    it('should throw when attempting to buy without first approving the converter to transfer from the buyer account in the reserve contract', async () => {
        let converter = await initConverter(accounts, true);
        await approve(reserveToken, accounts[0], bancorNetwork.address, 0);

        await utils.catchRevert(bancorNetwork.convert2([reserveToken.address, tokenAddress, tokenAddress], 500, 1, utils.zeroAddress, 0));
    });

    it('verifies balances after sell', async () => {
        let converter = await initConverter(accounts, true);
        let watcher = converter.Conversion();

        let tokenPrevBalance = await token.balanceOf.call(accounts[0]);
        let reserveTokenPrevBalance = await reserveToken.balanceOf.call(accounts[0]);

        await approve(token, accounts[0], bancorNetwork.address, 500);
        await bancorNetwork.convert2([tokenAddress, tokenAddress, reserveToken.address], 500, 1, utils.zeroAddress, 0);
        let saleAmount = await getConversionAmount(watcher);

        let reserveTokenNewBalance = await reserveToken.balanceOf.call(accounts[0]);
        assert.equal(reserveTokenNewBalance.toNumber(), reserveTokenPrevBalance.plus(saleAmount).toNumber());

        let tokenNewBalance = await token.balanceOf.call(accounts[0]);
        assert.equal(tokenNewBalance.toNumber(), tokenPrevBalance.minus(500).toNumber());
    });

    it('should throw when attempting to sell while the converter is not active', async () => {
        let converter = await initConverter(accounts, false);
        await approve(token, accounts[0], bancorNetwork.address, 500);

        await utils.catchRevert(bancorNetwork.convert2([tokenAddress, tokenAddress, reserveToken.address], 500, 1, utils.zeroAddress, 0));
    });

    it('should throw when attempting to sell with a non reserve address', async () => {
        let converter = await initConverter(accounts, true);
        await approve(token, accounts[0], bancorNetwork.address, 500);

        await utils.catchRevert(bancorNetwork.convert2([tokenAddress, tokenAddress, tokenAddress], 500, 1, utils.zeroAddress, 0));
    });

    it('should throw when attempting to sell while the sale yields 0 return', async () => {
        let converter = await initConverter(accounts, true);
        await approve(token, accounts[0], bancorNetwork.address, 1);

        await utils.catchRevert(bancorNetwork.convert2([tokenAddress, tokenAddress, reserveToken.address], 1, 1, utils.zeroAddress, 0));
    });

    it('should throw when attempting to sell with amount greater then the seller balance', async () => {
        let converter = await initConverter(accounts, true);
        await approve(token, accounts[0], bancorNetwork.address, 30000);

        await utils.catchRevert(bancorNetwork.convert2([tokenAddress, tokenAddress, reserveToken.address], 30000, 1, utils.zeroAddress, 0));
    });

    it('verifies that getReturn returns the same amount as converting between 2 reserves', async () => {
        let converter = await initConverter(accounts, true);
        let watcher = converter.Conversion();
        let returnAmount = (await converter.getReturn.call(reserveToken.address, ETH_RESERVE_ADDRESS, 500))[0];

        await approve(reserveToken, accounts[0], bancorNetwork.address, 500);
        await bancorNetwork.convert2([reserveToken.address, tokenAddress, ETH_RESERVE_ADDRESS], 500, 1, utils.zeroAddress, 0);
        let returnAmount2 = await getConversionAmount(watcher);

        assert.equal(returnAmount.toNumber(), returnAmount2);
    });
});