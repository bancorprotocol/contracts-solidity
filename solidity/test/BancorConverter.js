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

const CRR10Percent = 100000;
const gasPrice = 22000000000;
const gasPriceBad = 22000000001;

let token;
let tokenAddress;
let converterExtensionsAddress;
let reserveToken;
let reserveToken2;
let reserveTokenAddress;
let reserveTokenAddress2 = '0x32f0f93396f0865d7ce412695beb3c3ad9ccca75';

// used by purchase/sale tests
async function initConverter(accounts, activate) {
    token = await SmartToken.new('Token1', 'TKN1', 2);
    tokenAddress = token.address;

    reserveToken = await TestERC20Token.new('ERC Token 1', 'ERC1', 100000);
    reserveTokenAddress = reserveToken.address;

    reserveToken2 = await TestERC20Token.new('ERC Token 2', 'ERC2', 200000);
    reserveTokenAddress2 = reserveToken2.address;

    let converter = await BancorConverter.new(tokenAddress, converterExtensionsAddress, 0, reserveTokenAddress, 250000);
    let converterAddress = converter.address;
    await converter.addReserve(reserveTokenAddress2, 150000, false);

    await token.issue(accounts[0], 20000);
    await reserveToken.transfer(converterAddress, 5000);
    await reserveToken2.transfer(converterAddress, 8000);

    if (activate) {
        await token.transferOwnership(converterAddress);
        await converter.acceptTokenOwnership();
    }

    return converter;
}

function verifyReserve(reserve, isSet, isEnabled, ratio, isVirtualBalanceEnabled, virtualBalance) {
    assert.equal(reserve[0], virtualBalance);
    assert.equal(reserve[1], ratio);
    assert.equal(reserve[2], isVirtualBalanceEnabled);
    assert.equal(reserve[3], isEnabled);
    assert.equal(reserve[4], isSet);
}

function getConversionAmount(transaction, logIndex = 0) {
    return transaction.logs[logIndex].args._return.toNumber();
}

contract('BancorConverter', (accounts) => {
    before(async () => {
        let token = await SmartToken.new('Token1', 'TKN1', 2);
        let formula = await BancorFormula.new();
        let gasPriceLimit = await BancorGasPriceLimit.new(gasPrice);
        let quickConverter = await BancorQuickConverter.new();
        let converterExtensions = await BancorConverterExtensions.new(formula.address, gasPriceLimit.address, quickConverter.address);
        let reserveToken = await TestERC20Token.new('ERC Token 1', 'ERC1', 100000);
        tokenAddress = token.address;
        converterExtensionsAddress = converterExtensions.address;
        reserveTokenAddress = reserveToken.address;
    });

    it('verifies the converter data after construction', async () => {
        let converter = await BancorConverter.new(tokenAddress, converterExtensionsAddress, 0, '0x0', 0);
        let token = await converter.token.call();
        assert.equal(token, tokenAddress);
        let extensions = await converter.extensions.call();
        assert.equal(extensions, converterExtensionsAddress);
        let maxConversionFee = await converter.maxConversionFee.call();
        assert.equal(maxConversionFee, 0);
        let conversionsEnabled = await converter.conversionsEnabled.call();
        assert.equal(conversionsEnabled, true);
    });

    it('should throw when attempting to construct a converter with no token', async () => {
        try {
            await BancorConverter.new('0x0', converterExtensionsAddress, 0, '0x0', 0);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to construct a converter with no converter extensions', async () => {
        try {
            await BancorConverter.new(tokenAddress, '0x0', 0, '0x0', 0);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to construct a converter with invalid max fee', async () => {
        try {
            await BancorConverter.new(tokenAddress, converterExtensionsAddress, 1000000000, '0x0', 0);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies the first reserve when provided at construction time', async () => {
        let converter = await BancorConverter.new(tokenAddress, converterExtensionsAddress, 0, reserveTokenAddress, 200000);
        let reserveToken = await converter.reserveTokens.call(0);
        assert.equal(reserveToken, reserveTokenAddress);
        let reserve = await converter.reserves.call(reserveToken);
        verifyReserve(reserve, true, true, 200000, false, 0);
    });

    it('should throw when attempting to construct a converter with reserve with invalid ratio', async () => {
        try {
            await BancorConverter.new(tokenAddress, converterExtensionsAddress, 0, reserveTokenAddress, 1000001);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies the reserve token count before / after adding a reserve', async () => {
        let converter = await BancorConverter.new(tokenAddress, converterExtensionsAddress, 0, '0x0', 0);
        let reserveTokenCount = await converter.reserveTokenCount.call();
        assert.equal(reserveTokenCount, 0);
        await converter.addReserve(reserveTokenAddress, CRR10Percent, false);
        reserveTokenCount = await converter.reserveTokenCount.call();
        assert.equal(reserveTokenCount, 1);
    });

    it('verifies the convertible token count before / after adding a reserve', async () => {
        let converter = await BancorConverter.new(tokenAddress, converterExtensionsAddress, 0, '0x0', 0);
        let convertibleTokenCount = await converter.convertibleTokenCount.call();
        assert.equal(convertibleTokenCount, 1);
        await converter.addReserve(reserveTokenAddress, CRR10Percent, false);
        convertibleTokenCount = await converter.convertibleTokenCount.call();
        assert.equal(convertibleTokenCount, 2);
    });

    it('verifies the convertible token addresses', async () => {
        let converter = await BancorConverter.new(tokenAddress, converterExtensionsAddress, 0, '0x0', 0);
        await converter.addReserve(reserveTokenAddress, CRR10Percent, false);
        let convertibleTokenAddress = await converter.convertibleToken.call(0);
        assert.equal(convertibleTokenAddress, tokenAddress);
        convertibleTokenAddress = await converter.convertibleToken.call(1);
        assert.equal(convertibleTokenAddress, reserveTokenAddress);
    });

    it('verifies the owner can update the converter extensions contract address', async () => {
        let converter = await BancorConverter.new(tokenAddress, converterExtensionsAddress, 0, '0x0', 0);
        await converter.setExtensions(accounts[3]);
        let extensions = await converter.extensions.call();
        assert.notEqual(extensions, converterExtensionsAddress);
    });

    it('should throw when a non owner attempts update the converter extensions contract address', async () => {
        let converter = await BancorConverter.new(tokenAddress, converterExtensionsAddress, 0, '0x0', 0);

        try {
            await converter.setExtensions(accounts[3], { from: accounts[1] });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when a non owner attempts update the converter extensions contract address with an invalid address', async () => {
        let converter = await BancorConverter.new(tokenAddress, converterExtensionsAddress, 0, '0x0', 0);

        try {
            await converter.setExtensions('0x0', { from: accounts[1] });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when a non owner attempts update the converter extensions contract address with the converter address', async () => {
        let converter = await BancorConverter.new(tokenAddress, converterExtensionsAddress, 0, '0x0', 0);

        try {
            await converter.setExtensions(converter.address, { from: accounts[1] });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when a non owner attempts update the converter extensions contract address with the same existing address', async () => {
        let converter = await BancorConverter.new(tokenAddress, converterExtensionsAddress, 0, '0x0', 0);

        try {
            await converter.setExtensions(converterExtensionsAddress, { from: accounts[1] });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies the owner can update the fee', async () => {
        let converter = await BancorConverter.new(tokenAddress, converterExtensionsAddress, 200000, '0x0', 0);
        await converter.setConversionFee(30000);
        let conversionFee = await converter.conversionFee.call();
        assert.equal(conversionFee, 30000);
    });

    it('should throw when attempting to update the fee to an invalid value', async () => {
        let converter = await BancorConverter.new(tokenAddress, converterExtensionsAddress, 200000, '0x0', 0);

        try {
            await converter.setConversionFee(200001);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when a non owner attempts to update the fee', async () => {
        let converter = await BancorConverter.new(tokenAddress, converterExtensionsAddress, 200000, '0x0', 0);

        try {
            await converter.setConversionFee(30000, { from: accounts[1] });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies that getConversionFeeAmount returns the correct amount', async () => {
        let converter = await BancorConverter.new(tokenAddress, converterExtensionsAddress, 200000, '0x0', 0);
        await converter.setConversionFee(10000);
        let conversionFeeAmount = await converter.getConversionFeeAmount.call(500000);
        assert.equal(conversionFeeAmount, 5000);
    });

    it('verifies that 2 reserves are added correctly', async () => {
        let converter = await BancorConverter.new(tokenAddress, converterExtensionsAddress, 0, '0x0', 0);
        await converter.addReserve(reserveTokenAddress, CRR10Percent, false);
        let reserve = await converter.reserves.call(reserveTokenAddress);
        verifyReserve(reserve, true, true, CRR10Percent, false, 0);
        await converter.addReserve(reserveTokenAddress2, 200000, false);
        reserve = await converter.reserves.call(reserveTokenAddress2);
        verifyReserve(reserve, true, true, 200000, false, 0);
    });

    it('should throw when a non owner attempts to add a reserve', async () => {
        let converter = await BancorConverter.new(tokenAddress, converterExtensionsAddress, 0, '0x0', 0);

        try {
            await converter.addReserve(reserveTokenAddress, CRR10Percent, false, { from: accounts[1] });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to add a reserve when the converter is active', async () => {
        let token = await SmartToken.new('Token1', 'TKN1', 2);
        let converter = await BancorConverter.new(token.address, converterExtensionsAddress, 0, '0x0', 0);
        token.transferOwnership(converter.address);
        converter.acceptTokenOwnership();

        try {
            await converter.addReserve(reserveTokenAddress, CRR10Percent, false);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to add a reserve with invalid address', async () => {
        let converter = await BancorConverter.new(tokenAddress, converterExtensionsAddress, 0, '0x0', 0);

        try {
            await converter.addReserve('0x0', CRR10Percent, false);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to add a reserve with ratio = 0', async () => {
        let converter = await BancorConverter.new(tokenAddress, converterExtensionsAddress, 0, '0x0', 0);

        try {
            await converter.addReserve(reserveTokenAddress, 0, false);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to add a reserve with ratio greater than 100%', async () => {
        let converter = await BancorConverter.new(tokenAddress, converterExtensionsAddress, 0, '0x0', 0);

        try {
            await converter.addReserve(reserveTokenAddress, 1000001, false);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to add the token as a reserve', async () => {
        let converter = await BancorConverter.new(tokenAddress, converterExtensionsAddress, 0, '0x0', 0);

        try {
            await converter.addReserve(tokenAddress, CRR10Percent, false);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to add the converter as a reserve', async () => {
        let converter = await BancorConverter.new(tokenAddress, converterExtensionsAddress, 0, '0x0', 0);

        try {
            await converter.addReserve(converter.address, CRR10Percent, false);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to add a reserve that already exists', async () => {
        let converter = await BancorConverter.new(tokenAddress, converterExtensionsAddress, 0, '0x0', 0);
        await converter.addReserve(reserveTokenAddress, CRR10Percent, false);

        try {
            await converter.addReserve(reserveTokenAddress, 200000, false);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to add multiple reserves with total ratio greater than 100%', async () => {
        let converter = await BancorConverter.new(tokenAddress, converterExtensionsAddress, 0, '0x0', 0);
        await converter.addReserve(reserveTokenAddress, 500000, false);

        try {
            await converter.addReserve(reserveTokenAddress2, 500001, false);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies that the owner can update a reserve', async () => {
        let converter = await BancorConverter.new(tokenAddress, converterExtensionsAddress, 0, '0x0', 0);
        await converter.addReserve(reserveTokenAddress, CRR10Percent, false);
        let reserve = await converter.reserves.call(reserveTokenAddress);
        verifyReserve(reserve, true, true, CRR10Percent, false, 0);
        await converter.updateReserve(reserveTokenAddress, 200000, true, 50);
        reserve = await converter.reserves.call(reserveTokenAddress);
        verifyReserve(reserve, true, true, 200000, true, 50);
    });

    it('should throw when a non owner attempts to update a reserve', async () => {
        let converter = await BancorConverter.new(tokenAddress, converterExtensionsAddress, 0, '0x0', 0);
        await converter.addReserve(reserveTokenAddress, CRR10Percent, false);

        try {
            await converter.updateReserve(reserveTokenAddress, 200000, false, 0, { from: accounts[1] });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to update a reserve that does not exist', async () => {
        let converter = await BancorConverter.new(tokenAddress, converterExtensionsAddress, 0, '0x0', 0);
        await converter.addReserve(reserveTokenAddress, CRR10Percent, false);

        try {
            await converter.updateReserve(reserveTokenAddress2, 200000, false, 0);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to update a reserve with ratio = 0', async () => {
        let converter = await BancorConverter.new(tokenAddress, converterExtensionsAddress, 0, '0x0', 0);
        await converter.addReserve(reserveTokenAddress, CRR10Percent, false);

        try {
            await converter.updateReserve(reserveTokenAddress, 0, false, 0);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to update a reserve with ratio greater than 100%', async () => {
        let converter = await BancorConverter.new(tokenAddress, converterExtensionsAddress, 0, '0x0', 0);
        await converter.addReserve(reserveTokenAddress, CRR10Percent, false);

        try {
            await converter.updateReserve(reserveTokenAddress, 1000001, false, 0);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to update a reserve that will result in total ratio greater than 100%', async () => {
        let converter = await BancorConverter.new(tokenAddress, converterExtensionsAddress, 0, '0x0', 0);
        await converter.addReserve(reserveTokenAddress, 500000, false);
        await converter.addReserve(reserveTokenAddress2, 400000, false);

        try {
            await converter.updateReserve(reserveTokenAddress2, 500001, false, 0);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies that the manager can disable / re-enable conversions', async () => {
        let converter = await BancorConverter.new(tokenAddress, converterExtensionsAddress, 0, '0x0', 0);
        await converter.transferManagement(accounts[4]);
        await converter.acceptManagement({ from: accounts[4] });

        let conversionsEnabled = await converter.conversionsEnabled.call();
        assert.equal(conversionsEnabled, true);

        await converter.disableConversions(true, { from: accounts[4] });
        conversionsEnabled = await converter.conversionsEnabled.call();
        assert.equal(conversionsEnabled, false);

        await converter.disableConversions(false, { from: accounts[4] });
        conversionsEnabled = await converter.conversionsEnabled.call();
        assert.equal(conversionsEnabled, true);
    });

    it('should throw when a non owner attempts to disable conversions', async () => {
        let converter = await BancorConverter.new(tokenAddress, converterExtensionsAddress, 0, '0x0', 0);

        try {
            await converter.disableConversions(true, { from: accounts[1] });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies that the owner can disable / re-enable reserve purchases', async () => {
        let converter = await BancorConverter.new(tokenAddress, converterExtensionsAddress, 0, '0x0', 0);
        await converter.addReserve(reserveTokenAddress, CRR10Percent, false);
        let reserve = await converter.reserves.call(reserveTokenAddress);
        verifyReserve(reserve, true, true, CRR10Percent, false, 0);
        await converter.disableReservePurchases(reserveTokenAddress, true);
        reserve = await converter.reserves.call(reserveTokenAddress);
        verifyReserve(reserve, true, false, CRR10Percent, false, 0);
        await converter.disableReservePurchases(reserveTokenAddress, false);
        reserve = await converter.reserves.call(reserveTokenAddress);
        verifyReserve(reserve, true, true, CRR10Percent, false, 0);
    });

    it('should throw when a non owner attempts to disable reserve purchases', async () => {
        let converter = await BancorConverter.new(tokenAddress, converterExtensionsAddress, 0, '0x0', 0);
        await converter.addReserve(reserveTokenAddress, CRR10Percent, false);

        try {
            await converter.disableReservePurchases(reserveTokenAddress, true, { from: accounts[1] });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to disable reserve purchases for a reserve that does not exist', async () => {
        let converter = await BancorConverter.new(tokenAddress, converterExtensionsAddress, 0, '0x0', 0);
        await converter.addReserve(reserveTokenAddress, CRR10Percent, false);

        try {
            await converter.disableReservePurchases(reserveTokenAddress2, true);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies that the correct reserve balance is returned regardless of whether virtual balance is set or not', async () => {
        let converter = await BancorConverter.new(tokenAddress, converterExtensionsAddress, 0, '0x0', 0);
        let reserveToken = await TestERC20Token.new('ERC Token 1', 'ERC1', 100000);
        await converter.addReserve(reserveToken.address, CRR10Percent, false);
        let reserveBalance;
        reserveBalance = await converter.getReserveBalance.call(reserveToken.address);
        assert.equal(reserveBalance, 0);
        await reserveToken.transfer(converter.address, 1000);
        reserveBalance = await converter.getReserveBalance.call(reserveToken.address);
        assert.equal(reserveBalance, 1000);
        await converter.updateReserve(reserveToken.address, 200000, true, 5000);
        reserveBalance = await converter.getReserveBalance.call(reserveToken.address);
        assert.equal(reserveBalance, 5000);
        await converter.updateReserve(reserveToken.address, 200000, false, 5000);
        reserveBalance = await converter.getReserveBalance.call(reserveToken.address);
        assert.equal(reserveBalance, 1000);
    });

    it('should throw when attempting to retrieve the balance for a reserve that does not exist', async () => {
        let converter = await BancorConverter.new(tokenAddress, converterExtensionsAddress, 0, '0x0', 0);
        await converter.addReserve(reserveTokenAddress, CRR10Percent, false);

        try {
            await converter.getReserveBalance.call(reserveTokenAddress2);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies that the owner can withdraw from the reserve', async () => {
        let converter = await BancorConverter.new(tokenAddress, converterExtensionsAddress, 0, '0x0', 0);
        let reserveToken = await TestERC20Token.new('ERC Token 1', 'ERC1', 100000);
        await converter.addReserve(reserveToken.address, CRR10Percent, false);
        await reserveToken.transfer(converter.address, 1000);
        let converterBalance = await reserveToken.balanceOf(converter.address);
        assert.equal(converterBalance, 1000);
        await converter.withdrawTokens(reserveToken.address, accounts[2], 50);
        converterBalance = await reserveToken.balanceOf(converter.address);
        assert.equal(converterBalance, 950);
        let account2Balance = await reserveToken.balanceOf(accounts[2]);
        assert.equal(account2Balance, 50);
    });

    it('should throw when a non owner attempts to withdraw from the reserve', async () => {
        let converter = await BancorConverter.new(tokenAddress, converterExtensionsAddress, 0, '0x0', 0);
        let reserveToken = await TestERC20Token.new('ERC Token 1', 'ERC1', 100000);
        await converter.addReserve(reserveToken.address, CRR10Percent, false);
        await reserveToken.transfer(converter.address, 1000);

        try {
            await converter.withdrawTokens(reserveToken.address, accounts[3], 50, { from: accounts[1] });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to withdraw from a reserve to an invalid address', async () => {
        let converter = await BancorConverter.new(tokenAddress, converterExtensionsAddress, 0, '0x0', 0);
        let reserveToken = await TestERC20Token.new('ERC Token 1', 'ERC1', 100000);
        await converter.addReserve(reserveToken.address, CRR10Percent, false);
        await reserveToken.transfer(converter.address, 1000);

        try {
            await converter.withdrawTokens(reserveToken.address, '0x0', 50);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to withdraw from a reserve to the converter address', async () => {
        let converter = await BancorConverter.new(tokenAddress, converterExtensionsAddress, 0, '0x0', 0);
        let reserveToken = await TestERC20Token.new('ERC Token 1', 'ERC1', 100000);
        await converter.addReserve(reserveToken.address, CRR10Percent, false);
        await reserveToken.transfer(converter.address, 1000);

        try {
            await converter.withdrawTokens(reserveToken.address, converter.address, 50);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies that getReturn returns a valid amount', async () => {
        let converter = await initConverter(accounts, true);
        let returnAmount = await converter.getReturn.call(reserveTokenAddress, tokenAddress, 500);
        assert.isNumber(returnAmount.toNumber());
        assert.notEqual(returnAmount.toNumber(), 0);
    });

    it('verifies that getReturn returns the same amount as getPurchaseReturn when converting from a reserve to the token', async () => {
        let converter = await initConverter(accounts, true);
        let returnAmount = await converter.getReturn.call(reserveTokenAddress, tokenAddress, 500);
        let purchaseReturnAmount = await converter.getPurchaseReturn.call(reserveTokenAddress, 500);
        assert.equal(returnAmount.toNumber(), purchaseReturnAmount.toNumber());
    });

    it('verifies that getReturn returns the same amount as getSaleReturn when converting from the token to a reserve', async () => {
        let converter = await initConverter(accounts, true);
        let returnAmount = await converter.getReturn.call(tokenAddress, reserveTokenAddress, 500);
        let saleReturnAmount = await converter.getSaleReturn.call(reserveTokenAddress, 500);
        assert.isNumber(returnAmount.toNumber());
        assert.notEqual(returnAmount.toNumber(), 0);
        assert.equal(returnAmount.toNumber(), saleReturnAmount.toNumber());
    });

    it('verifies that getReturn returns the same amount as buy -> sell when converting from reserve 1 to reserve 2', async () => {
        let converter = await initConverter(accounts, true);
        let returnAmount = await converter.getReturn.call(reserveTokenAddress, reserveTokenAddress2, 500);

        await reserveToken.approve(converter.address, 500);
        let purchaseRes = await converter.buy(reserveTokenAddress, 500, 1);
        let purchaseAmount = getConversionAmount(purchaseRes);

        let saleRes = await converter.sell(reserveTokenAddress2, purchaseAmount, 1);
        let saleAmount = getConversionAmount(saleRes);

        assert.equal(returnAmount, saleAmount);
    });

    it('should throw when attempting to get the return with an invalid from token adress', async () => {
        let converter = await initConverter(accounts, true);

        try {
            await converter.getReturn.call('0x0', reserveTokenAddress2, 500);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to get the return with an invalid to token address', async () => {
        let converter = await initConverter(accounts, true);

        try {
            await converter.getReturn.call(reserveTokenAddress, '0x0', 500);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to get the return with identical from/to addresses', async () => {
        let converter = await initConverter(accounts, true);

        try {
            await converter.getReturn.call(reserveTokenAddress, reserveTokenAddress, 500);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to get the purchase return while the converter is not active', async () => {
        let converter = await initConverter(accounts, false);

        try {
            await converter.getPurchaseReturn.call(reserveTokenAddress, 500);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to get the purchase return with a non reserve address', async () => {
        let converter = await initConverter(accounts, true);

        try {
            await converter.getPurchaseReturn.call(tokenAddress, 500);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to get the purchase return while purchasing with the reserve is disabled', async () => {
        let converter = await initConverter(accounts, true);
        await converter.disableReservePurchases(reserveTokenAddress, true);

        try {
            await converter.getPurchaseReturn.call(reserveTokenAddress, 500);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to get the sale return while the converter is not active', async () => {
        let converter = await initConverter(accounts, false);

        try {
            await converter.getSaleReturn.call(reserveTokenAddress, 500);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to get the sale return with a non reserve address', async () => {
        let converter = await initConverter(accounts, true);

        try {
            await converter.getSaleReturn.call(tokenAddress, 500);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies that convert returns a valid amount', async () => {
        let converter = await initConverter(accounts, true);
        await reserveToken.approve(converter.address, 500);
        let res = await converter.convert(reserveTokenAddress, tokenAddress, 500, 1);
        let conversionAmount = getConversionAmount(res);
        assert.isNumber(conversionAmount);
        assert.notEqual(conversionAmount, 0);
    });

    it('verifies that convert returns the same amount as buy when converting from a reserve to the token', async () => {
        let converter = await initConverter(accounts, true);
        await reserveToken.approve(converter.address, 500);
        let conversionRes = await converter.convert(reserveTokenAddress, tokenAddress, 500, 1);
        let conversionAmount = getConversionAmount(conversionRes);
        assert.isNumber(conversionAmount);
        assert.notEqual(conversionAmount, 0);

        converter = await initConverter(accounts, true);
        await reserveToken.approve(converter.address, 500);
        let purchaseRes = await converter.buy(reserveTokenAddress, 500, 1);
        let purchaseAmount = getConversionAmount(purchaseRes);
        assert.equal(conversionAmount, purchaseAmount);
    });

    it('verifies that convert returns the same amount as sell when converting from the token to a reserve', async () => {
        let converter = await initConverter(accounts, true);
        let conversionRes = await converter.convert(tokenAddress, reserveTokenAddress, 500, 1);
        let conversionAmount = getConversionAmount(conversionRes);
        assert.isNumber(conversionAmount);
        assert.notEqual(conversionAmount, 0);

        converter = await initConverter(accounts, true);
        let saleRes = await converter.sell(reserveTokenAddress, 500, 1);
        let saleAmount = getConversionAmount(saleRes);
        assert.equal(conversionAmount, saleAmount);
    });

    it('verifies that convert returns the same amount as buy -> sell when converting from reserve 1 to reserve 2', async () => {
        let converter = await initConverter(accounts, true);
        await reserveToken.approve(converter.address, 500);

        let conversionRes = await converter.convert(reserveTokenAddress, reserveTokenAddress2, 500, 1);
        let conversionAmount = getConversionAmount(conversionRes, 1);
        assert.isNumber(conversionAmount);
        assert.notEqual(conversionAmount, 0);

        converter = await initConverter(accounts, true);
        await reserveToken.approve(converter.address, 500);
        let purchaseRes = await converter.buy(reserveTokenAddress, 500, 1);
        let purchaseAmount = getConversionAmount(purchaseRes);

        let saleRes = await converter.sell(reserveTokenAddress2, purchaseAmount, 1);
        let saleAmount = getConversionAmount(saleRes);

        assert.equal(conversionAmount, saleAmount);
    });

    it('verifies that selling right after buying does not result in an amount greater than the original purchase amount', async () => {
        let converter = await initConverter(accounts, true);
        await reserveToken.approve(converter.address, 500);
        let purchaseRes = await converter.buy(reserveTokenAddress, 500, 1);
        let purchaseAmount = getConversionAmount(purchaseRes);

        let saleRes = await converter.sell(reserveTokenAddress, purchaseAmount, 1);
        let saleAmount = getConversionAmount(saleRes);

        assert(saleAmount <= 500);
    });

    it('verifies that buying right after selling does not result in an amount greater than the original sale amount', async () => {
        let converter = await initConverter(accounts, true);

        let saleRes = await converter.sell(reserveTokenAddress, 500, 1);
        let saleAmount = getConversionAmount(saleRes);

        await reserveToken.approve(converter.address, 500);
        let purchaseRes = await converter.buy(reserveTokenAddress, saleAmount, 1);
        let purchaseAmount = getConversionAmount(purchaseRes);

        assert(purchaseAmount <= 500);
    });

    it('should throw when attempting to convert with an invalid from token adress', async () => {
        let converter = await initConverter(accounts, true);
        await reserveToken.approve(converter.address, 500);

        try {
            await converter.convert('0x0', reserveTokenAddress2, 500, 1);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to convert with an invalid to token address', async () => {
        let converter = await initConverter(accounts, true);
        await reserveToken.approve(converter.address, 500);

        try {
            await converter.convert(reserveTokenAddress, '0x0', 500, 1);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to convert with identical from/to addresses', async () => {
        let converter = await initConverter(accounts, true);
        await reserveToken.approve(converter.address, 500);

        try {
            await converter.convert(reserveTokenAddress, reserveTokenAddress, 500, 0);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to convert with 0 minimum requested amount', async () => {
        let converter = await initConverter(accounts, true);
        await reserveToken.approve(converter.address, 500);

        try {
            await converter.convert(reserveTokenAddress, reserveTokenAddress2, 500, 2000);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to convert when the return is smaller than the minimum requested amount', async () => {
        let converter = await initConverter(accounts, true);
        await reserveToken.approve(converter.address, 500);

        try {
            await converter.convert(reserveTokenAddress, reserveTokenAddress2, 500, 2000);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies balances after buy', async () => {
        let converter = await initConverter(accounts, true);

        let tokenPrevBalance = await token.balanceOf.call(accounts[0]);
        let reserveTokenPrevBalance = await reserveToken.balanceOf.call(accounts[0]);

        await reserveToken.approve(converter.address, 500);
        let purchaseRes = await converter.buy(reserveTokenAddress, 500, 1);
        let purchaseAmount = getConversionAmount(purchaseRes);

        let reserveTokenNewBalance = await reserveToken.balanceOf.call(accounts[0]);
        assert.equal(reserveTokenNewBalance.toNumber(), reserveTokenPrevBalance.minus(500).toNumber());

        let tokenNewBalance = await token.balanceOf.call(accounts[0]);
        assert.equal(tokenNewBalance.toNumber(), tokenPrevBalance.plus(purchaseAmount).toNumber());
    });

    it('should throw when attempting to buy while the converter is not active', async () => {
        let converter = await initConverter(accounts, false);
        await reserveToken.approve(converter.address, 500);

        try {
            await converter.buy(reserveTokenAddress, 500, 1);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to buy with a non reserve address', async () => {
        let converter = await initConverter(accounts, true);
        await reserveToken.approve(converter.address, 500);

        try {
            await converter.buy(tokenAddress, 500, 1);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to buy while the purchase yields 0 return', async () => {
        let converter = await initConverter(accounts, true);
        await reserveToken.approve(converter.address, 500);

        try {
            await converter.buy(reserveTokenAddress, 0, 1);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to buy while conversions are disabled', async () => {
        let converter = await initConverter(accounts, true);
        await converter.disableConversions(true);
        await reserveToken.approve(converter.address, 500);

        try {
            await converter.buy(reserveTokenAddress, 500, 1);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to buy with gas price higher than the universal limit', async () => {
        let converter = await initConverter(accounts, true);
        await reserveToken.approve(converter.address, 500);

        try {
            await converter.buy(reserveTokenAddress, 500, 1, { gasPrice: gasPriceBad });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to buy with 0 minimum requested amount', async () => {
        let converter = await initConverter(accounts, true);
        await reserveToken.approve(converter.address, 500);

        try {
            await converter.buy(reserveTokenAddress, 500, 0);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to buy when the return is smaller than the minimum requested amount', async () => {
        let converter = await initConverter(accounts, true);
        await reserveToken.approve(converter.address, 500);

        try {
            await converter.buy(reserveTokenAddress, 500, 2000);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to buy while the reserve purchases are disabled', async () => {
        let converter = await initConverter(accounts, true);
        await reserveToken.approve(converter.address, 500);
        await converter.disableReservePurchases(reserveTokenAddress, true);

        try {
            await converter.buy(reserveTokenAddress, 500, 1);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to buy without first approving the converter to transfer from the buyer account in the reserve contract', async () => {
        let converter = await initConverter(accounts, true);

        try {
            await converter.buy(reserveTokenAddress, 500, 1);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies balances after sell', async () => {
        let converter = await initConverter(accounts, true);

        let tokenPrevBalance = await token.balanceOf.call(accounts[0]);
        let reserveTokenPrevBalance = await reserveToken.balanceOf.call(accounts[0]);

        let saleRes = await converter.sell(reserveTokenAddress, 500, 1);
        let saleAmount = getConversionAmount(saleRes);

        let reserveTokenNewBalance = await reserveToken.balanceOf.call(accounts[0]);
        assert.equal(reserveTokenNewBalance.toNumber(), reserveTokenPrevBalance.plus(saleAmount).toNumber());

        let tokenNewBalance = await token.balanceOf.call(accounts[0]);
        assert.equal(tokenNewBalance.toNumber(), tokenPrevBalance.minus(500).toNumber());
    });

    it('should throw when attempting to sell while the converter is not active', async () => {
        let converter = await initConverter(accounts, false);

        try {
            await converter.sell(reserveTokenAddress, 500, 1);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to sell with a non reserve address', async () => {
        let converter = await initConverter(accounts, true);

        try {
            await converter.sell(tokenAddress, 500, 1);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to sell while the sale yields 0 return', async () => {
        let converter = await initConverter(accounts, true);

        try {
            await converter.sell(reserveTokenAddress, 0, 1);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to sell while conversions are disabled', async () => {
        let converter = await initConverter(accounts, true);
        await converter.disableConversions(true);

        try {
            await converter.sell(reserveTokenAddress, 500, 1);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to sell with 0 minimum requested amount', async () => {
        let converter = await initConverter(accounts, true);

        try {
            await converter.sell(reserveTokenAddress, 500, 0);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to sell when the return is smaller than the minimum requested amount', async () => {
        let converter = await initConverter(accounts, true);

        try {
            await converter.sell(reserveTokenAddress, 500, 2000);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to sell with amount greater then the seller balance', async () => {
        let converter = await initConverter(accounts, true);

        try {
            await converter.sell(reserveTokenAddress, 30000, 1);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });
});
