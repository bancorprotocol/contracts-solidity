const { expect } = require('chai');
const { expectRevert, constants, BN, balance } = require('@openzeppelin/test-helpers');

const { registry } = require('./helpers/Constants');
const { ZERO_ADDRESS } = constants;

const ConverterHelper = require('./helpers/Converter');

const BancorNetwork = artifacts.require('BancorNetwork');
const DSToken = artifacts.require('DSToken');
const BancorFormula = artifacts.require('BancorFormula');
const ContractRegistry = artifacts.require('ContractRegistry');
const EtherToken = artifacts.require('EtherToken');
const TestNonStandardToken = artifacts.require('TestNonStandardToken');

/*
Token network structure:

         DSToken2
         /         \
    DSToken1   DSToken3
          \          \
           \        DSToken4
            \        /      \
            EtherToken     ERC20Token

*/

contract('BancorNetworkWithOldEtherToken', accounts => {
    let etherToken;
    let anchor1;
    let anchor2;
    let anchor3;
    let anchor4;
    let erc20Token;
    let contractRegistry;
    let converter1;
    let converter2;
    let converter3;
    let converter4;
    let bancorNetwork;
    let anchor1BuyPath;
    let anchor2BuyPath;
    let anchor3BuyPath;
    let anchor1SellPath;
    let anchor2SellPath;
    let anchor3SellPath;
    let etherToErc20ConvertPath;
    const sender = accounts[0];
    const sender2 = accounts[1];
    const nonOwner = accounts[5];
    const affiliate = accounts[8];

    const value = new BN(1000);

    const OLD_CONVERTER_VERSION = 23;
    const MIN_RETURN = new BN(1);
    const AFFILIATE_FEE = new BN(10000);

    before(async () => {
        // The following contracts are unaffected by the underlying tests, this can be shared.
        contractRegistry = await ContractRegistry.new();

        const bancorFormula = await BancorFormula.new();
        await bancorFormula.init();
        await contractRegistry.registerAddress(registry.BANCOR_FORMULA, bancorFormula.address);
    });

    beforeEach(async () => {
        bancorNetwork = await BancorNetwork.new(contractRegistry.address);
        await contractRegistry.registerAddress(registry.BANCOR_NETWORK, bancorNetwork.address);

        etherToken = await EtherToken.new('Token0', 'TKN0');
        await etherToken.deposit({ value: 10000000 });

        await bancorNetwork.registerEtherToken(etherToken.address, true);

        anchor1 = await DSToken.new('Token1', 'TKN1', 2);
        await anchor1.issue(sender, 1000000);

        anchor2 = await DSToken.new('Token2', 'TKN2', 2);
        await anchor2.issue(sender, 2000000);

        anchor3 = await DSToken.new('Token3', 'TKN3', 2);
        await anchor3.issue(sender, 3000000);

        anchor4 = await DSToken.new('Token4', 'TKN4', 2);
        await anchor4.issue(sender, 2500000);

        await contractRegistry.registerAddress(registry.BNT_TOKEN, anchor1.address);

        erc20Token = await TestNonStandardToken.new('ERC20Token', 'ERC5', 2, 1000000);

        converter1 = await ConverterHelper.new(0, anchor1.address, contractRegistry.address, 0, etherToken.address,
            250000, OLD_CONVERTER_VERSION);

        converter2 = await ConverterHelper.new(MIN_RETURN, anchor2.address, contractRegistry.address, 0, anchor1.address,
            300000, OLD_CONVERTER_VERSION);
        await converter2.addReserve(anchor3.address, 150000);

        converter3 = await ConverterHelper.new(0, anchor3.address, contractRegistry.address, 0, anchor4.address,
            350000, OLD_CONVERTER_VERSION);

        converter4 = await ConverterHelper.new(MIN_RETURN, anchor4.address, contractRegistry.address, 0, etherToken.address,
            150000, OLD_CONVERTER_VERSION);
        await converter4.addReserve(erc20Token.address, 220000);

        await etherToken.transfer(converter1.address, 50000);
        await anchor1.transfer(converter2.address, 40000);
        await anchor3.transfer(converter2.address, 25000);
        await anchor4.transfer(converter3.address, 30000);
        await etherToken.transfer(converter4.address, 20000);
        await erc20Token.transfer(converter4.address, 35000);

        await anchor1.transferOwnership(converter1.address);
        await converter1.acceptTokenOwnership();

        await anchor2.transferOwnership(converter2.address);
        await converter2.acceptTokenOwnership();

        await anchor3.transferOwnership(converter3.address);
        await converter3.acceptTokenOwnership();

        await anchor4.transferOwnership(converter4.address);
        await converter4.acceptTokenOwnership();

        anchor1BuyPath = [etherToken.address, anchor1.address, anchor1.address];
        anchor2BuyPath = [etherToken.address, anchor1.address, anchor1.address, anchor2.address, anchor2.address];
        anchor3BuyPath = [anchor1.address, anchor2.address, anchor2.address, anchor2.address, anchor3.address];

        anchor1SellPath = [anchor1.address, anchor1.address, etherToken.address];
        anchor2SellPath = [anchor2.address, anchor2.address, anchor1.address, anchor1.address, etherToken.address];
        anchor3SellPath = [anchor3.address, anchor2.address, anchor2.address, anchor2.address, anchor1.address];

        etherToErc20ConvertPath = [etherToken.address, anchor4.address, erc20Token.address];
    });

    it('verifies that sending ether to the converter fails', async () => {
        await expectRevert.unspecified(converter2.send(100));
    });

    it('should be able to convert from a non compliant ERC20 to another token', async () => {
        await erc20Token.approve(bancorNetwork.address, value);
        const path = [erc20Token.address, anchor4.address, anchor4.address];

        const prevTokenBalance = await anchor4.balanceOf.call(sender);

        const returnAmount = await bancorNetwork.convert.call(path, value, MIN_RETURN);
        await bancorNetwork.convert(path, value, MIN_RETURN);

        const newTokenBalance = await anchor4.balanceOf.call(sender);
        expect(newTokenBalance).to.be.bignumber.equal(prevTokenBalance.add(returnAmount));
    });

    it('should be able to convert from a liquid token to a non compliant ERC20', async () => {
        await anchor4.approve(bancorNetwork.address, value);
        const path = [anchor4.address, anchor4.address, erc20Token.address];

        const prevTokenBalance = await erc20Token.balanceOf.call(sender);

        const returnAmount = await bancorNetwork.convert.call(path, value, MIN_RETURN);
        await bancorNetwork.convert(path, value, MIN_RETURN);

        const newTokenBalance = await erc20Token.balanceOf.call(sender);
        expect(newTokenBalance).to.be.bignumber.equal(prevTokenBalance.add(returnAmount));
    });

    it('verifies that convert with a single converter results in increased balance for the buyer', async () => {
        const prevTokenBalance = await anchor1.balanceOf.call(sender2);

        const returnAmount = await bancorNetwork.convert.call(anchor1BuyPath, value, MIN_RETURN, { from: sender2, value });
        await bancorNetwork.convert(anchor1BuyPath, value, MIN_RETURN, { from: sender2, value });

        const newTokenBalance = await anchor1.balanceOf.call(sender2);
        expect(newTokenBalance).to.be.bignumber.equal(prevTokenBalance.add(returnAmount));
    });

    it('verifies that convert with multiple converters results in increased balance for the buyer', async () => {
        const prevTokenBalance = await anchor2.balanceOf.call(sender2);

        const returnAmount = await bancorNetwork.convert.call(anchor2BuyPath, value, MIN_RETURN, { from: sender2, value });
        await bancorNetwork.convert(anchor2BuyPath, value, MIN_RETURN, { from: sender2, value });

        const newTokenBalance = await anchor2.balanceOf.call(sender2);
        expect(newTokenBalance).to.be.bignumber.equal(prevTokenBalance.add(returnAmount));
    });

    // eslint-disable-next-line max-len
    it('verifies that convert with minimum return equal to the full expected return amount results in the exact increase in balance for the buyer', async () => {
        const value = new BN(100000);

        const prevTokenBalance = await anchor2.balanceOf.call(sender);

        const returnAmount = (await bancorNetwork.getReturnByPath.call(anchor2BuyPath, value))[0];
        await bancorNetwork.convert(anchor2BuyPath, value, returnAmount, { value });

        const newTokenBalance = await anchor2.balanceOf.call(sender);
        expect(newTokenBalance).to.be.bignumber.equal(prevTokenBalance.add(returnAmount));
    });

    it('should revert when attempting to convert and the return amount is lower than the given minimum', async () => {
        const value = new BN(1);

        await expectRevert(bancorNetwork.convert(anchor2BuyPath, value, 1000000, { from: sender2, value }),
            'ERR_RETURN_TOO_LOW');
    });

    it('should revert when attempting to convert and passing an amount higher than the ETH amount sent with the request', async () => {
        await expectRevert(bancorNetwork.convert(anchor2BuyPath, value, MIN_RETURN,
            { from: sender2, value: value.mul(new BN(2)) }), 'ERR_ETH_AMOUNT_MISMATCH');
    });

    it('verifies the caller balances after selling directly for ether with a single converter', async () => {
        await anchor1.approve(bancorNetwork.address, value);

        const prevTokenBalance = await anchor1.balanceOf.call(sender);
        const prevETHBalance = await balance.current(sender);

        const res = await bancorNetwork.convert(anchor1SellPath, value, MIN_RETURN);

        const newETHBalance = await balance.current(sender);
        const newTokenBalance = await anchor1.balanceOf.call(sender);

        const transaction = await web3.eth.getTransaction(res.tx);
        const transactionCost = new BN(transaction.gasPrice).mul(new BN(res.receipt.cumulativeGasUsed));

        expect(newETHBalance).to.be.bignumber.gt(prevETHBalance.sub(transactionCost));
        expect(newTokenBalance).to.be.bignumber.lt(prevTokenBalance);
    });

    it('verifies the caller balances after selling directly for ether with multiple converters', async () => {
        await anchor2.approve(bancorNetwork.address, value);

        const prevTokenBalance = await anchor2.balanceOf.call(sender);
        const prevETHBalance = await balance.current(sender);

        const res = await bancorNetwork.convert(anchor2SellPath, value, MIN_RETURN);

        const newETHBalance = await balance.current(sender);
        const newTokenBalance = await anchor2.balanceOf.call(sender);

        const transaction = await web3.eth.getTransaction(res.tx);
        const transactionCost = new BN(transaction.gasPrice).mul(new BN(res.receipt.cumulativeGasUsed));

        expect(newETHBalance).to.be.bignumber.gt(prevETHBalance.sub(transactionCost));
        expect(newTokenBalance).to.be.bignumber.lt(prevTokenBalance);
    });

    it('should revert when attempting to sell directly for ether and the return amount is lower than the given minimum', async () => {
        await anchor2.approve(bancorNetwork.address, value);

        await expectRevert(bancorNetwork.convert(anchor2SellPath, value, value.add(new BN(10000))),
            'ERR_RETURN_TOO_LOW');
    });

    it('verifies the caller balances after converting from one token to another with multiple converters', async () => {
        const path = [
            anchor1.address,
            anchor2.address, anchor2.address,
            anchor2.address, anchor3.address,
            anchor3.address, anchor4.address
        ];

        await anchor1.approve(bancorNetwork.address, value);

        const prevToken1Balance = await anchor1.balanceOf.call(sender);
        const prevToken4Balance = await anchor4.balanceOf.call(sender);

        await bancorNetwork.convert(path, value, MIN_RETURN);

        const newToken1Balance = await anchor1.balanceOf.call(sender);
        const newToken4Balance = await anchor4.balanceOf.call(sender);

        expect(newToken4Balance).to.be.bignumber.gt(prevToken4Balance);
        expect(newToken1Balance).to.be.bignumber.lt(prevToken1Balance);
    });

    it('verifies valid ether token registration', async () => {
        const etherToken1 = await EtherToken.new('Token0', 'TKN0');
        await etherToken1.deposit({ value: 10000000 });

        const bancorNetwork1 = await BancorNetwork.new(contractRegistry.address);
        await bancorNetwork1.registerEtherToken(etherToken1.address, true);

        const validEtherToken = await bancorNetwork1.etherTokens.call(etherToken1.address);
        expect(validEtherToken).to.be.true();
    });

    it('should revert when attempting register ether token with invalid address', async () => {
        const bancorNetwork1 = await BancorNetwork.new(contractRegistry.address);
        await expectRevert(bancorNetwork1.registerEtherToken(ZERO_ADDRESS, true), 'ERR_INVALID_ADDRESS');
    });

    it('should revert when non owner attempting register ether token', async () => {
        const etherToken1 = await EtherToken.new('Token0', 'TKN0');
        await etherToken1.deposit({ value: 10000000 });
        const bancorNetwork1 = await BancorNetwork.new(contractRegistry.address);
        await expectRevert(bancorNetwork1.registerEtherToken(etherToken1.address, true, { from: nonOwner }),
            'ERR_ACCESS_DENIED');
    });

    it('verifies valid ether token unregistration', async () => {
        const etherToken1 = await EtherToken.new('Token0', 'TKN0');
        await etherToken1.deposit({ value: 10000000 });

        const bancorNetwork1 = await BancorNetwork.new(contractRegistry.address);
        await bancorNetwork1.registerEtherToken(etherToken1.address, true);

        const validEtherToken = await bancorNetwork1.etherTokens.call(etherToken1.address);
        expect(validEtherToken).to.be.true();

        await bancorNetwork1.registerEtherToken(etherToken1.address, false);

        const validEtherToken2 = await bancorNetwork1.etherTokens.call(etherToken1.address);
        expect(validEtherToken2).to.be.false();
    });

    it('should revert when non owner attempting to unregister ether token', async () => {
        const etherToken1 = await EtherToken.new('Token0', 'TKN0');
        await etherToken1.deposit({ value: 10000000 });

        const bancorNetwork1 = await BancorNetwork.new(contractRegistry.address);
        await bancorNetwork1.registerEtherToken(etherToken1.address, true);

        const validEtherToken = await bancorNetwork1.etherTokens.call(etherToken1.address);
        expect(validEtherToken).to.be.true();

        await expectRevert(bancorNetwork1.registerEtherToken(etherToken1.address, false, { from: nonOwner }),
            'ERR_ACCESS_DENIED');
    });

    it('verifies that convertFor transfers the converted amount correctly', async () => {
        const prevTokenBalance = await anchor1.balanceOf.call(sender2);

        await bancorNetwork.convertFor(anchor1BuyPath, value, MIN_RETURN, sender2, { value });

        const newTokenBalance = await anchor1.balanceOf.call(sender2);
        expect(newTokenBalance).to.be.bignumber.gt(prevTokenBalance);
    });

    it('verifies that convert transfers the converted amount correctly', async () => {
        const prevTokenBalance = await anchor1.balanceOf.call(sender2);

        await bancorNetwork.convert(anchor1BuyPath, value, MIN_RETURN, { from: sender2, value });

        const newTokenBalance = await anchor1.balanceOf.call(sender2);
        expect(newTokenBalance).to.be.bignumber.gt(prevTokenBalance);
    });

    it('verifies claimAndConvertFor with a path that starts with a liquid token and ends with another liquid token', async () => {
        await anchor4.approve(bancorNetwork.address, value);

        const path = [anchor4.address, anchor3.address, anchor3.address, anchor2.address, anchor2.address];

        const prevTokenBalance = await anchor2.balanceOf.call(sender2);

        await bancorNetwork.claimAndConvertFor(path, value, MIN_RETURN, sender2);

        const newTokenBalance = await anchor2.balanceOf.call(sender2);
        expect(newTokenBalance).to.be.bignumber.gt(prevTokenBalance);
    });

    it('verifies that convertFor returns a valid amount when buying the liquid token', async () => {
        const amount = await bancorNetwork.convertFor.call(anchor1BuyPath, value, MIN_RETURN, sender2, { value });
        expect(amount).be.bignumber.gt(new BN(0));
    });

    it('verifies that convert returns a valid amount when buying the liquid token', async () => {
        const amount = await bancorNetwork.convert.call(anchor1BuyPath, value, MIN_RETURN, { from: sender2, value });
        expect(amount).be.bignumber.gt(new BN(0));
    });

    it('verifies that convertFor returns a valid amount when converting from ETH to ERC20', async () => {
        const amount = await bancorNetwork.convertFor.call(etherToErc20ConvertPath, value, MIN_RETURN, sender2, { value });
        expect(amount).be.bignumber.gt(new BN(0));
    });

    it('verifies that convert returns a valid amount when converting from ETH to ERC20', async () => {
        const amount = await bancorNetwork.convert.call(etherToErc20ConvertPath, value, MIN_RETURN, { from: sender2, value });
        expect(amount).be.bignumber.gt(new BN(0));
    });

    it('should revert when calling convertFor with ether token but without sending ether', async () => {
        await expectRevert.unspecified(bancorNetwork.convertFor(anchor1BuyPath, value, MIN_RETURN, sender2));
    });

    it('should revert when calling convertFor with ether amount different than the amount sent', async () => {
        await expectRevert(bancorNetwork.convertFor.call(anchor1BuyPath, value.add(new BN(1)), MIN_RETURN, sender2,
            { value }), 'ERR_ETH_AMOUNT_MISMATCH');
    });

    it('should revert when calling convertFor with invalid path', async () => {
        const invalidPath = [etherToken.address, anchor1.address];

        await expectRevert(bancorNetwork.convertFor(invalidPath, value, MIN_RETURN, sender2, { value }),
            'ERR_INVALID_PATH');
    });

    it('should revert when calling convertFor with invalid long path', async () => {
        const longBuyPath = [];
        for (let i = 0; i < 100; ++i) {
            longBuyPath.push(etherToken.address);
        }

        await expectRevert(bancorNetwork.convertFor(longBuyPath, value, MIN_RETURN, sender2, { value }),
            'ERR_INVALID_PATH');
    });

    it('should revert when calling convert with ether token but without sending ether', async () => {
        await expectRevert.unspecified(bancorNetwork.convert(anchor1BuyPath, value, MIN_RETURN, { from: sender2 }));
    });

    it('should revert when calling convert with ether amount different than the amount sent', async () => {
        await expectRevert(bancorNetwork.convert.call(anchor1BuyPath, value.add(new BN(1)), MIN_RETURN,
            { from: sender2, value }), 'ERR_ETH_AMOUNT_MISMATCH');
    });

    it('should revert when calling convert with invalid path', async () => {
        const invalidPath = [etherToken.address, anchor1.address];

        await expectRevert(bancorNetwork.convert(invalidPath, value, MIN_RETURN, { from: sender2, value }),
            'ERR_INVALID_PATH');
    });

    it('should revert when calling convert with invalid long path', async () => {
        const longBuyPath = [];
        for (let i = 0; i < 100; ++i) {
            longBuyPath.push(etherToken.address);
        }

        await expectRevert(bancorNetwork.convert(longBuyPath, value, MIN_RETURN, { from: sender2, value }),
            'ERR_INVALID_PATH');
    });

    it('verifies that claimAndConvertFor transfers the converted amount correctly', async () => {
        await anchor1.approve(bancorNetwork.address, value);

        const prevTokenBalance = await anchor3.balanceOf.call(sender2);

        await bancorNetwork.claimAndConvertFor(anchor3BuyPath, value, MIN_RETURN, sender2);

        const newTokenBalance = await anchor3.balanceOf.call(sender2);
        expect(newTokenBalance).to.be.bignumber.gt(prevTokenBalance);
    });

    it('should revert when calling claimAndConvertFor without approval', async () => {
        await expectRevert.unspecified(bancorNetwork.claimAndConvertFor(anchor3BuyPath, value, MIN_RETURN, sender2));
    });

    it('verifies that claimAndConvert transfers the converted amount correctly', async () => {
        await anchor1.approve(bancorNetwork.address, value);

        const prevTokenBalance = await anchor3.balanceOf.call(sender);

        await bancorNetwork.claimAndConvert(anchor3BuyPath, value, MIN_RETURN);

        const newTokenBalance = await anchor3.balanceOf.call(sender);
        expect(newTokenBalance).to.be.bignumber.gt(prevTokenBalance);
    });

    it('should revert when calling claimAndConvert without approval', async () => {
        await expectRevert.unspecified(bancorNetwork.claimAndConvert(anchor3BuyPath, value, MIN_RETURN));
    });

    it('verifies that getReturnByPath returns the correct amount for buying the liquid token', async () => {
        const returnByPath = (await bancorNetwork.getReturnByPath.call(anchor1BuyPath, value))[0];

        const prevTokenBalance = await anchor1.balanceOf.call(sender2);

        await bancorNetwork.convertFor(anchor1BuyPath, value, MIN_RETURN, sender2, { value });

        const newTokenBalance = await anchor1.balanceOf.call(sender2);

        expect(newTokenBalance).to.be.bignumber.equal(prevTokenBalance.add(returnByPath));
    });

    it('verifies that getReturnByPath returns the correct amount for buying the liquid token through multiple converters', async () => {
        const returnByPath = (await bancorNetwork.getReturnByPath.call(anchor2BuyPath, value))[0];

        const prevTokenBalance = await anchor2.balanceOf.call(sender2);

        await bancorNetwork.convertFor(anchor2BuyPath, value, MIN_RETURN, sender2, { value });

        const newTokenBalance = await anchor2.balanceOf.call(sender2);
        expect(newTokenBalance).to.be.bignumber.equal(prevTokenBalance.add(returnByPath));
    });

    it('verifies that getReturnByPath returns the correct amount for buying the liquid token', async () => {
        const returnByPath = (await bancorNetwork.getReturnByPath.call(anchor1BuyPath, value))[0];

        const prevTokenBalance = await anchor1.balanceOf.call(sender2);

        await bancorNetwork.convert(anchor1BuyPath, value, MIN_RETURN, { from: sender2, value });

        const newTokenBalance = await anchor1.balanceOf.call(sender2);
        expect(newTokenBalance).to.be.bignumber.equal(prevTokenBalance.add(returnByPath));
    });

    it('verifies that getReturnByPath returns the correct amount for buying the liquid token through multiple converters', async () => {
        const returnByPath = (await bancorNetwork.getReturnByPath.call(anchor2BuyPath, value))[0];

        const prevTokenBalance = await anchor2.balanceOf.call(sender2);

        await bancorNetwork.convert(anchor2BuyPath, value, MIN_RETURN, { from: sender2, value });

        const newTokenBalance = await anchor2.balanceOf.call(sender2);
        expect(newTokenBalance).to.be.bignumber.equal(prevTokenBalance.add(returnByPath));
    });

    it('verifies that getReturnByPath returns the correct amount for cross reserve conversion', async () => {
        await bancorNetwork.convert([etherToken.address, anchor1.address, anchor1.address], value, MIN_RETURN, { from: sender2, value });
        await anchor1.approve(bancorNetwork.address, value, { from: sender2 });

        const path = [anchor1.address, anchor2.address, anchor3.address];
        const returnByPath = (await bancorNetwork.getReturnByPath.call(path, value))[0];

        const prevTokenBalance = await anchor3.balanceOf.call(sender2);

        await bancorNetwork.convert(path, value, MIN_RETURN, { from: sender2 });

        const newTokenBalance = await anchor3.balanceOf.call(sender2);
        expect(newTokenBalance).to.be.bignumber.equal(prevTokenBalance.add(returnByPath));
    });

    it('verifies that getReturnByPath returns the correct amount for selling the liquid token via convert', async () => {
        await bancorNetwork.convert(anchor1BuyPath, value, MIN_RETURN, { from: sender2, value });

        const returnByPath = (await bancorNetwork.getReturnByPath.call(anchor1SellPath, value))[0];
        await anchor1.approve(bancorNetwork.address, value, { from: sender2 });

        const prevEthBalance = await balance.current(sender2);

        const res = await bancorNetwork.convert(anchor1SellPath, value, MIN_RETURN, { from: sender2 });
        const transaction = await web3.eth.getTransaction(res.tx);
        const transactionCost = new BN(transaction.gasPrice).mul(new BN(res.receipt.cumulativeGasUsed));

        const newEthBalance = await balance.current(sender2);
        expect(newEthBalance).to.be.bignumber.equal(prevEthBalance.add(returnByPath).sub(transactionCost));
    });

    it('verifies that getReturnByPath returns the correct amount for selling the liquid token through multiple converters', async () => {
        await bancorNetwork.convert(anchor2BuyPath, value, MIN_RETURN, { from: sender2, value });

        const returnByPath = (await bancorNetwork.getReturnByPath.call(anchor2SellPath, value))[0];
        await anchor2.approve(bancorNetwork.address, value, { from: sender2 });

        const prevEthBalance = await balance.current(sender2);

        const res = await bancorNetwork.convert(anchor2SellPath, value, MIN_RETURN, { from: sender2 });

        const transaction = await web3.eth.getTransaction(res.tx);
        const transactionCost = new BN(transaction.gasPrice).mul(new BN(res.receipt.cumulativeGasUsed));

        const newEthBalance = await balance.current(sender2);
        expect(newEthBalance).to.be.bignumber.equal(prevEthBalance.add(returnByPath).sub(transactionCost));
    });

    it('verifies that getReturnByPath returns the correct amount for selling the liquid token with a long conversion path', async () => {
        await bancorNetwork.convert([etherToken.address, anchor1.address, anchor1.address, anchor2.address, anchor3.address], value,
            MIN_RETURN, { from: sender2, value });

        const path = [anchor3.address, anchor2.address, anchor2.address, anchor2.address, anchor1.address,
            anchor1.address, etherToken.address];
        const returnByPath = (await bancorNetwork.getReturnByPath.call(path, value))[0];
        await anchor3.approve(bancorNetwork.address, value, { from: sender2 });

        const prevEthBalance = await balance.current(sender2);

        const res = await bancorNetwork.convert(path, value, MIN_RETURN, { from: sender2 });

        const transaction = await web3.eth.getTransaction(res.tx);
        const transactionCost = new BN(transaction.gasPrice).mul(new BN(res.receipt.cumulativeGasUsed));

        const newEthBalance = await balance.current(sender2);
        expect(newEthBalance).to.be.bignumber.equal(prevEthBalance.add(returnByPath).sub(transactionCost));
    });

    it('verifies that getReturnByPath returns the same amount as getReturn when converting a reserve to the liquid token', async () => {
        const getReturn = (await converter2.getReturn.call(anchor1.address, anchor2.address, value))[0];
        const returnByPath = (await bancorNetwork.getReturnByPath.call([anchor1.address, anchor2.address, anchor2.address], value))[0];

        expect(getReturn).to.be.bignumber.equal(returnByPath);
    });

    it('verifies that getReturnByPath returns the same amount as getReturn when converting from a token to a reserve', async () => {
        const getReturn = (await converter2.getReturn.call(anchor2.address, anchor1.address, value))[0];
        const returnByPath = (await bancorNetwork.getReturnByPath.call([anchor2.address, anchor2.address, anchor1.address], value))[0];

        expect(getReturn).to.be.bignumber.equal(returnByPath);
    });

    it('should revert when attempting to call getReturnByPath on a path with fewer than 3 elements', async () => {
        const invalidPath = [etherToken.address, anchor1.address];
        await expectRevert(bancorNetwork.getReturnByPath.call(invalidPath, value), 'ERR_INVALID_PATH');
    });

    it('should revert when attempting to call getReturnByPath on a path with an odd number of elements', async () => {
        const invalidPath = [etherToken.address, anchor1.address, anchor2.address, anchor3.address];
        await expectRevert(bancorNetwork.getReturnByPath.call(invalidPath, value), 'ERR_INVALID_PATH');
    });

    it('should revert when attempting to get the return by path with invalid long path', async () => {
        const longBuyPath = [];
        for (let i = 0; i < 103; ++i) {
            longBuyPath.push(etherToken.address);
        }

        await expectRevert.unspecified(bancorNetwork.getReturnByPath.call(longBuyPath, value));
    });

    it('verifies that convertFor2 transfers the converted amount correctly', async () => {
        const prevTokenBalance = await anchor1.balanceOf.call(sender2);
        await bancorNetwork.convertFor2(anchor1BuyPath, value, MIN_RETURN, sender2, ZERO_ADDRESS, 0, { value });

        const newTokenBalance = await anchor1.balanceOf.call(sender2);
        expect(newTokenBalance).to.be.bignumber.gt(prevTokenBalance);
    });

    it('verifies that convert2 transfers the converted amount correctly', async () => {
        const prevTokenBalance = await anchor1.balanceOf.call(sender2);
        await bancorNetwork.convert2(anchor1BuyPath, value, MIN_RETURN, ZERO_ADDRESS, 0, { from: sender2, value });

        const newTokenBalance = await anchor1.balanceOf.call(sender2);
        expect(newTokenBalance).to.be.bignumber.gt(prevTokenBalance);
    });

    it('verifies claimAndConvertFor2 with a path that starts with a liquid token and ends with another liquid token', async () => {
        await anchor4.approve(bancorNetwork.address, value);

        const path = [anchor4.address, anchor3.address, anchor3.address, anchor2.address, anchor2.address];

        const prevTokenBalance = await anchor2.balanceOf.call(sender2);

        await bancorNetwork.claimAndConvertFor2(path, value, MIN_RETURN, sender2, ZERO_ADDRESS, 0);

        const newTokenBalance = await anchor2.balanceOf.call(sender2);
        expect(newTokenBalance).to.be.bignumber.gt(prevTokenBalance);
    });

    it('verifies that convertFor2 returns a valid amount when buying the liquid token', async () => {
        const amount = await bancorNetwork.convertFor2.call(anchor1BuyPath, value, MIN_RETURN, sender2, ZERO_ADDRESS, 0, { value });

        expect(amount).be.bignumber.gt(new BN(0));
    });

    it('verifies that convert2 returns a valid amount when buying the liquid token', async () => {
        const amount = await bancorNetwork.convert2.call(anchor1BuyPath, value, MIN_RETURN, ZERO_ADDRESS, 0, { from: sender2, value });

        expect(amount).be.bignumber.gt(new BN(0));
    });

    it('verifies that convertFor2 returns a valid amount when converting from ETH to ERC20', async () => {
        const amount = await bancorNetwork.convertFor2.call(etherToErc20ConvertPath, value, MIN_RETURN, sender2, ZERO_ADDRESS, 0, { value });

        expect(amount).be.bignumber.gt(new BN(0));
    });

    it('verifies that convert2 returns a valid amount when converting from ETH to ERC20', async () => {
        const amount = await bancorNetwork.convert2.call(etherToErc20ConvertPath, value, MIN_RETURN, ZERO_ADDRESS, 0, { from: sender2, value });

        expect(amount).be.bignumber.gt(new BN(0));
    });

    it('should revert when calling convertFor2 with ether token but without sending ether', async () => {
        await expectRevert.unspecified(bancorNetwork.convertFor2(anchor1BuyPath, value, MIN_RETURN, sender2, ZERO_ADDRESS, 0));
    });

    it('should revert when calling convertFor2 with ether amount different than the amount sent', async () => {
        await expectRevert(bancorNetwork.convertFor2.call(anchor1BuyPath, value.add(new BN(1)), MIN_RETURN, sender2, ZERO_ADDRESS, 0,
            { value }), 'ERR_ETH_AMOUNT_MISMATCH');
    });

    it('should revert when calling convertFor2 with invalid path', async () => {
        const invalidPath = [etherToken.address, anchor1.address];

        await expectRevert(bancorNetwork.convertFor2(invalidPath, value, MIN_RETURN, sender2, ZERO_ADDRESS, 0,
            { value }), 'ERR_INVALID_PATH');
    });

    it('should revert when calling convertFor2 with invalid long path', async () => {
        const longBuyPath = [];
        for (let i = 0; i < 100; ++i) {
            longBuyPath.push(etherToken.address);
        }

        await expectRevert(bancorNetwork.convertFor2(longBuyPath, value, MIN_RETURN, sender2, ZERO_ADDRESS, 0,
            { value }), 'ERR_INVALID_PATH');
    });

    it('should revert when calling convert2 with ether token but without sending ether', async () => {
        await expectRevert.unspecified(bancorNetwork.convert2(anchor1BuyPath, value, MIN_RETURN, ZERO_ADDRESS, 0, { from: sender2 }));
    });

    it('should revert when calling convert2 with ether amount different than the amount sent', async () => {
        await expectRevert(bancorNetwork.convert2.call(anchor1BuyPath, value.add(new BN(1)), MIN_RETURN, ZERO_ADDRESS, 0,
            { from: sender2, value }), 'ERR_ETH_AMOUNT_MISMATCH');
    });

    it('should revert when calling convert2 with invalid path', async () => {
        const invalidPath = [etherToken.address, anchor1.address];

        await expectRevert(bancorNetwork.convert2(invalidPath, value, MIN_RETURN, ZERO_ADDRESS, 0, { from: sender2, value }),
            'ERR_INVALID_PATH');
    });

    it('should revert when calling convert2 with invalid long path', async () => {
        const longBuyPath = [];
        for (let i = 0; i < 100; ++i) {
            longBuyPath.push(etherToken.address);
        }

        await expectRevert(bancorNetwork.convert2(longBuyPath, value, MIN_RETURN, ZERO_ADDRESS, 0, { from: sender2, value }),
            'ERR_INVALID_PATH');
    });

    it('verifies that claimAndConvertFor2 transfers the converted amount correctly', async () => {
        await anchor1.approve(bancorNetwork.address, value);
        const prevTokenBalance = await anchor3.balanceOf.call(sender2);
        await bancorNetwork.claimAndConvertFor2(anchor3BuyPath, value, MIN_RETURN, sender2, ZERO_ADDRESS, 0);
        const newTokenBalance = await anchor3.balanceOf.call(sender2);
        expect(newTokenBalance).to.be.bignumber.gt(prevTokenBalance);
    });

    it('should revert when calling claimAndConvertFor2 without approval', async () => {
        await expectRevert.unspecified(bancorNetwork.claimAndConvertFor2(anchor3BuyPath, value, MIN_RETURN, sender2, ZERO_ADDRESS, 0));
    });

    it('verifies that claimAndConvert2 transfers the converted amount correctly', async () => {
        await anchor1.approve(bancorNetwork.address, value);

        const prevTokenBalance = await anchor3.balanceOf.call(sender);

        await bancorNetwork.claimAndConvert2(anchor3BuyPath, value, MIN_RETURN, ZERO_ADDRESS, 0);

        const newTokenBalance = await anchor3.balanceOf.call(sender);
        expect(newTokenBalance).to.be.bignumber.gt(prevTokenBalance);
    });

    it('should revert when calling claimAndConvert2 without approval', async () => {
        await expectRevert.unspecified(bancorNetwork.claimAndConvert2(anchor3BuyPath, value, MIN_RETURN, ZERO_ADDRESS, 0));
    });

    it('verifies that getReturnByPath returns the correct amount for buying the liquid token', async () => {
        const returnByPath = (await bancorNetwork.getReturnByPath.call(anchor1BuyPath, value))[0];

        const prevTokenBalance = await anchor1.balanceOf.call(sender2);

        await bancorNetwork.convertFor2(anchor1BuyPath, value, MIN_RETURN, sender2, ZERO_ADDRESS, 0, { value });

        const newTokenBalance = await anchor1.balanceOf.call(sender2);
        expect(newTokenBalance).to.be.bignumber.equal(prevTokenBalance.add(returnByPath));
    });

    it('verifies that getReturnByPath returns the correct amount for buying the liquid token through multiple converters', async () => {
        const returnByPath = (await bancorNetwork.getReturnByPath.call(anchor2BuyPath, value))[0];

        const prevTokenBalance = await anchor2.balanceOf.call(sender2);

        await bancorNetwork.convertFor2(anchor2BuyPath, value, MIN_RETURN, sender2, ZERO_ADDRESS, 0, { value });

        const newTokenBalance = await anchor2.balanceOf.call(sender2);
        expect(newTokenBalance).to.be.bignumber.equal(prevTokenBalance.add(returnByPath));
    });

    it('verifies that getReturnByPath returns the correct amount for buying the liquid token', async () => {
        const returnByPath = (await bancorNetwork.getReturnByPath.call(anchor1BuyPath, value))[0];

        const prevTokenBalance = await anchor1.balanceOf.call(sender2);

        await bancorNetwork.convert2(anchor1BuyPath, value, MIN_RETURN, ZERO_ADDRESS, 0, { from: sender2, value });

        const newTokenBalance = await anchor1.balanceOf.call(sender2);
        expect(newTokenBalance).to.be.bignumber.equal(prevTokenBalance.add(returnByPath));
    });

    it('verifies that getReturnByPath returns the correct amount for buying the liquid token through multiple converters', async () => {
        const returnByPath = (await bancorNetwork.getReturnByPath.call(anchor2BuyPath, value))[0];

        const prevTokenBalance = await anchor2.balanceOf.call(sender2);

        await bancorNetwork.convert2(anchor2BuyPath, value, MIN_RETURN, ZERO_ADDRESS, 0, { from: sender2, value });

        const newTokenBalance = await anchor2.balanceOf.call(sender2);
        expect(newTokenBalance).to.be.bignumber.equal(prevTokenBalance.add(returnByPath));
    });

    it('should be able to convert2 from a non compliant ERC20 to another token', async () => {
        await erc20Token.approve(bancorNetwork.address, value);

        const path = [erc20Token.address, anchor4.address, anchor4.address];

        const prevTokenBalance = await anchor4.balanceOf.call(sender);

        await bancorNetwork.convert2(path, value, MIN_RETURN, ZERO_ADDRESS, 0);

        const newTokenBalance = await anchor4.balanceOf.call(sender);
        expect(newTokenBalance).to.be.bignumber.gt(prevTokenBalance);
    });

    it('should be able to convert2 from a liquid token to a non compliant ERC20', async () => {
        await anchor4.approve(bancorNetwork.address, value);

        const path = [anchor4.address, anchor4.address, erc20Token.address];

        const prevTokenBalance = await erc20Token.balanceOf.call(sender);

        await bancorNetwork.convert2(path, value, MIN_RETURN, ZERO_ADDRESS, 0);

        const newTokenBalance = await erc20Token.balanceOf.call(sender);
        expect(newTokenBalance).to.be.bignumber.gt(prevTokenBalance);
    });

    it('verifies that convert2 with a single converter results in increased balance for the buyer', async () => {
        const prevTokenBalance = await anchor1.balanceOf.call(sender2);

        await bancorNetwork.convert2(anchor1BuyPath, value, MIN_RETURN, ZERO_ADDRESS, 0, { from: sender2, value });

        const newTokenBalance = await anchor1.balanceOf.call(sender2);
        expect(newTokenBalance).to.be.bignumber.gt(prevTokenBalance);
    });

    it('verifies that convert2 with multiple converters results in increased balance for the buyer', async () => {
        const prevTokenBalance = await anchor2.balanceOf.call(sender2);

        await bancorNetwork.convert2(anchor2BuyPath, value, MIN_RETURN, ZERO_ADDRESS, 0, { from: sender2, value });

        const newTokenBalance = await anchor2.balanceOf.call(sender2);
        expect(newTokenBalance).to.be.bignumber.gt(prevTokenBalance);
    });

    // eslint-disable-next-line max-len
    it('verifies that convert2 with minimum return equal to the full expected return amount results in the exact increase in balance for the buyer', async () => {
        const prevTokenBalance = await anchor2.balanceOf.call(sender);

        const returnAmount = (await bancorNetwork.getReturnByPath.call(anchor2BuyPath, value))[0];
        await bancorNetwork.convert2(anchor2BuyPath, value, returnAmount, ZERO_ADDRESS, 0, { value });

        const newTokenBalance = await anchor2.balanceOf.call(sender);
        expect(newTokenBalance).to.be.bignumber.equal(prevTokenBalance.add(returnAmount));
    });

    it('should revert when attempting to convert2 and the return amount is lower than the given minimum', async () => {
        await expectRevert(bancorNetwork.convert2(anchor2BuyPath, value, 1000000, ZERO_ADDRESS, 0,
            { from: sender2, value }), 'ERR_RETURN_TOO_LOW');
    });

    it('should revert when attempting to convert2 and passing an amount higher than the ETH amount sent with the request', async () => {
        await expectRevert(bancorNetwork.convert2(anchor2BuyPath, value, MIN_RETURN, ZERO_ADDRESS, 0,
            { from: sender2, value: value.add(new BN(1)) }), 'ERR_ETH_AMOUNT_MISMATCH');
    });

    it('verifies the caller balances after selling directly for ether with a single converter', async () => {
        await anchor1.approve(bancorNetwork.address, value);

        const prevTokenBalance = await anchor1.balanceOf.call(sender);
        const prevETHBalance = await balance.current(sender);

        const res = await bancorNetwork.convert2(anchor1SellPath, value, MIN_RETURN, ZERO_ADDRESS, 0);
        const newETHBalance = await balance.current(sender);
        const newTokenBalance = await anchor1.balanceOf.call(sender);

        const transaction = await web3.eth.getTransaction(res.tx);
        const transactionCost = new BN(transaction.gasPrice).mul(new BN(res.receipt.cumulativeGasUsed));

        expect(newETHBalance).to.be.bignumber.gt(prevETHBalance.sub(transactionCost));
        expect(newTokenBalance).to.be.bignumber.lt(prevTokenBalance);
    });

    it('verifies the caller balances after selling directly for ether with multiple converters', async () => {
        await anchor2.approve(bancorNetwork.address, value);
        const prevTokenBalance = await anchor2.balanceOf.call(sender);
        const prevETHBalance = await balance.current(sender);

        const res = await bancorNetwork.convert2(anchor2SellPath, value, MIN_RETURN, ZERO_ADDRESS, 0);
        const newETHBalance = await balance.current(sender);
        const newTokenBalance = await anchor2.balanceOf.call(sender);

        const transaction = await web3.eth.getTransaction(res.tx);
        const transactionCost = new BN(transaction.gasPrice).mul(new BN(res.receipt.cumulativeGasUsed));

        expect(newETHBalance).to.be.bignumber.gt(prevETHBalance.sub(transactionCost));
        expect(newTokenBalance).to.be.bignumber.lt(prevTokenBalance);
    });

    it('should revert when attempting to sell directly for ether and the return amount is lower than the given minimum', async () => {
        await anchor2.approve(bancorNetwork.address, value);

        await expectRevert(bancorNetwork.convert2(anchor2SellPath, value, value.add(new BN(10)), ZERO_ADDRESS, 0),
            'ERR_RETURN_TOO_LOW');
    });

    it('verifies the caller balances after converting from one token to another with multiple converters', async () => {
        const path = [
            anchor1.address,
            anchor2.address, anchor2.address,
            anchor2.address, anchor3.address,
            anchor3.address, anchor4.address
        ];

        await anchor1.approve(bancorNetwork.address, value);

        const prevToken1Balance = await anchor1.balanceOf.call(sender);
        const prevToken4Balance = await anchor4.balanceOf.call(sender);

        await bancorNetwork.convert2(path, value, MIN_RETURN, ZERO_ADDRESS, 0);

        const newToken1Balance = await anchor1.balanceOf.call(sender);
        const newToken4Balance = await anchor4.balanceOf.call(sender);

        expect(newToken4Balance).to.be.bignumber.gt(prevToken4Balance);
        expect(newToken1Balance).to.be.bignumber.lt(prevToken1Balance);
    });

    it('verifies that getReturnByPath returns the correct amount for cross reserve conversion', async () => {
        await bancorNetwork.convert2([etherToken.address, anchor1.address, anchor1.address], value, MIN_RETURN,
            ZERO_ADDRESS, 0, { from: sender2, value });
        await anchor1.approve(bancorNetwork.address, value, { from: sender2 });

        const path = [anchor1.address, anchor2.address, anchor3.address];

        const returnByPath = (await bancorNetwork.getReturnByPath.call(path, value))[0];

        const prevTokenBalance = await anchor3.balanceOf.call(sender2);

        await bancorNetwork.convert2(path, value, MIN_RETURN, ZERO_ADDRESS, 0, { from: sender2 });

        const newTokenBalance = await anchor3.balanceOf.call(sender2);
        expect(newTokenBalance).to.be.bignumber.equal(prevTokenBalance.add(returnByPath));
    });

    it('verifies that getReturnByPath returns the correct amount for selling the liquid token via convert2', async () => {
        await bancorNetwork.convert2(anchor1BuyPath, value, MIN_RETURN, ZERO_ADDRESS, 0, { from: sender2, value });
        await anchor1.approve(bancorNetwork.address, value, { from: sender2 });

        const returnByPath = (await bancorNetwork.getReturnByPath.call(anchor1SellPath, value))[0];

        const prevEthBalance = await balance.current(sender2);

        const res = await bancorNetwork.convert2(anchor1SellPath, value, MIN_RETURN, ZERO_ADDRESS, 0, { from: sender2 });
        const transaction = await web3.eth.getTransaction(res.tx);
        const transactionCost = new BN(transaction.gasPrice).mul(new BN(res.receipt.cumulativeGasUsed));

        const newEthBalance = await balance.current(sender2);
        expect(newEthBalance).to.be.bignumber.equal(prevEthBalance.add(returnByPath).sub(transactionCost));
    });

    it('verifies that getReturnByPath returns the correct amount for selling the liquid token through multiple converters', async () => {
        await bancorNetwork.convert2(anchor2BuyPath, value, MIN_RETURN, ZERO_ADDRESS, 0, { from: sender2, value });
        await anchor2.approve(bancorNetwork.address, value, { from: sender2 });

        const returnByPath = (await bancorNetwork.getReturnByPath.call(anchor2SellPath, value))[0];
        const prevEthBalance = await balance.current(sender2);

        const res = await bancorNetwork.convert2(anchor2SellPath, value, MIN_RETURN, ZERO_ADDRESS, 0, { from: sender2 });
        const transaction = await web3.eth.getTransaction(res.tx);
        const transactionCost = new BN(transaction.gasPrice).mul(new BN(res.receipt.cumulativeGasUsed));

        const newEthBalance = await balance.current(sender2);
        expect(newEthBalance).to.be.bignumber.equal(prevEthBalance.add(returnByPath).sub(transactionCost));
    });

    it('verifies that getReturnByPath returns the correct amount for selling the liquid token with a long conversion path', async () => {
        await bancorNetwork.convert2([etherToken.address, anchor1.address, anchor1.address, anchor2.address,
            anchor3.address], value, MIN_RETURN, ZERO_ADDRESS, 0, { from: sender2, value });
        await anchor3.approve(bancorNetwork.address, value, { from: sender2 });

        const path = [anchor3.address, anchor2.address, anchor2.address, anchor2.address, anchor1.address,
            anchor1.address, etherToken.address];
        const returnByPath = (await bancorNetwork.getReturnByPath.call(path, value))[0];

        const prevEthBalance = await balance.current(sender2);

        const res = await bancorNetwork.convert2(path, value, MIN_RETURN, ZERO_ADDRESS, 0, { from: sender2 });
        const transaction = await web3.eth.getTransaction(res.tx);
        const transactionCost = new BN(transaction.gasPrice).mul(new BN(res.receipt.cumulativeGasUsed));

        const newEthBalance = await balance.current(sender2);
        expect(newEthBalance).to.be.bignumber.equal(prevEthBalance.add(returnByPath).sub(transactionCost));
    });

    it('verifies that convertFor2 transfers the affiliate fee correctly', async () => {
        const prevTokenBalance = await anchor1.balanceOf.call(affiliate);

        await bancorNetwork.convertFor2(anchor1BuyPath, value, MIN_RETURN, sender2, affiliate, AFFILIATE_FEE, { value });

        const newTokenBalance = await anchor1.balanceOf.call(affiliate);
        expect(newTokenBalance).to.be.bignumber.gt(prevTokenBalance);
    });

    it('verifies that convert2 transfers the affiliate fee correctly', async () => {
        const prevTokenBalance = await anchor1.balanceOf.call(affiliate);

        await bancorNetwork.convert2(anchor1BuyPath, value, MIN_RETURN, affiliate, AFFILIATE_FEE, { from: sender2, value });

        const newTokenBalance = await anchor1.balanceOf.call(affiliate);
        expect(newTokenBalance).to.be.bignumber.gt(prevTokenBalance);
    });

    it('verifies that claimAndConvert2 transfers the affiliate fee correctly', async () => {
        await anchor3.approve(bancorNetwork.address, value);

        const prevTokenBalance = await anchor1.balanceOf.call(affiliate);

        await bancorNetwork.claimAndConvert2(anchor3SellPath, value, MIN_RETURN, affiliate, AFFILIATE_FEE);

        const newTokenBalance = await anchor1.balanceOf.call(affiliate);
        expect(newTokenBalance).to.be.bignumber.gt(prevTokenBalance);
    });

    it('verifies that claimAndConvertFor2 transfers the affiliate fee correctly', async () => {
        await anchor3.approve(bancorNetwork.address, value);

        const prevTokenBalance = await anchor1.balanceOf.call(affiliate);

        await bancorNetwork.claimAndConvertFor2(anchor3SellPath, value, MIN_RETURN, sender2, affiliate, AFFILIATE_FEE);

        const newTokenBalance = await anchor1.balanceOf.call(affiliate);
        expect(newTokenBalance).to.be.bignumber.gt(prevTokenBalance);
    });

    it('verifies that setMaxAffiliateFee can set the maximum affiliate-fee', async () => {
        const oldMaxAffiliateFee = await bancorNetwork.maxAffiliateFee.call();
        await bancorNetwork.setMaxAffiliateFee(oldMaxAffiliateFee.add(MIN_RETURN));

        const newMaxAffiliateFee = await bancorNetwork.maxAffiliateFee.call();
        await bancorNetwork.setMaxAffiliateFee(oldMaxAffiliateFee);

        expect(newMaxAffiliateFee).to.be.bignumber.equal(oldMaxAffiliateFee.add(MIN_RETURN));
    });

    it('should revert when calling setMaxAffiliateFee with a non-owner', async () => {
        await expectRevert(bancorNetwork.setMaxAffiliateFee(new BN(1000000), { from: nonOwner }), 'ERR_ACCESS_DENIED');
    });

    it('should revert when calling setMaxAffiliateFee with an illegal value', async () => {
        await expectRevert(bancorNetwork.setMaxAffiliateFee(new BN(1000001), { from: sender }), 'ERR_INVALID_AFFILIATE_FEE');
    });
});
