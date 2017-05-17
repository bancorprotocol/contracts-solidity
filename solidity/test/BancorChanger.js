/* global artifacts, contract, before, it, assert */
/* eslint-disable prefer-reflect */

const BancorChanger = artifacts.require('BancorChanger.sol');
const SmartToken = artifacts.require('SmartToken.sol');
const BancorFormula = artifacts.require('BancorFormula.sol');
const TestERC20Token = artifacts.require('TestERC20Token.sol');
const utils = require('./helpers/Utils');

let tokenAddress;
let formulaAddress;
let reserveTokenAddress;
let reserveTokenAddress2 = '0x32f0f93396f0865d7ce412695beb3c3ad9ccca75';

function verifyReserve(reserve, isSet, isEnabled, ratio, isVirtualBalanceEnabled, virtualBalance) {
    assert.equal(reserve[0], virtualBalance);
    assert.equal(reserve[1], ratio);
    assert.equal(reserve[2], isVirtualBalanceEnabled);
    assert.equal(reserve[3], isEnabled);
    assert.equal(reserve[4], isSet);
}

contract('BancorChanger', (accounts) => {
    before(async () => {
        let token = await SmartToken.new('Token1', 'TKN1', 2, '0x0');
        let formula = await BancorFormula.new();
        let reserveToken = await TestERC20Token.new('ERC Token 1', 'ERC1', 100000);
        tokenAddress = token.address;
        formulaAddress = formula.address;
        reserveTokenAddress = reserveToken.address;
    });

    it('verifies the token address and formula address after construction', async () => {
        let changer = await BancorChanger.new(tokenAddress, formulaAddress, '0x0', '0x0', 0);
        let token = await changer.token.call();
        assert.equal(token, tokenAddress);
        let formula = await changer.formula.call();
        assert.equal(formula, formulaAddress);
    });

    it('should throw when attempting to construct a changer with no token', async () => {
        try {
            await BancorChanger.new('0x0', formulaAddress, '0x0', '0x0', 0);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to construct a changer with no formula', async () => {
        try {
            await BancorChanger.new(tokenAddress, '0x0', '0x0', '0x0', 0);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies the first reserve when provided at construction time', async () => {
        let changer = await BancorChanger.new(tokenAddress, formulaAddress, '0x0', reserveTokenAddress, 20);
        let reserveToken = await changer.reserveTokens.call(0);
        assert.equal(reserveToken, reserveTokenAddress);
        let reserve = await changer.reserves.call(reserveToken);
        verifyReserve(reserve, true, true, 20, false, 0);
    });

    it('should throw when attempting to construct a changer with reserve with invalid ratio', async () => {
        try {
            await BancorChanger.new(tokenAddress, formulaAddress, '0x0', reserveTokenAddress, 101);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies the reserve token count before / after adding a reserve', async () => {
        let changer = await BancorChanger.new(tokenAddress, formulaAddress, '0x0', '0x0', 0);
        let reserveTokenCount = await changer.reserveTokenCount.call();
        assert.equal(reserveTokenCount, 0);
        await changer.addReserve(reserveTokenAddress, 10, false);
        reserveTokenCount = await changer.reserveTokenCount.call();
        assert.equal(reserveTokenCount, 1);
    });

    it('verifies the changeable token count before / after adding a reserve', async () => {
        let changer = await BancorChanger.new(tokenAddress, formulaAddress, '0x0', '0x0', 0);
        let changeableTokenCount = await changer.changeableTokenCount.call();
        assert.equal(changeableTokenCount, 1);
        await changer.addReserve(reserveTokenAddress, 10, false);
        changeableTokenCount = await changer.changeableTokenCount.call();
        assert.equal(changeableTokenCount, 2);
    });

    it('verifies the changeable token addresses', async () => {
        let changer = await BancorChanger.new(tokenAddress, formulaAddress, '0x0', '0x0', 0);
        await changer.addReserve(reserveTokenAddress, 10, false);
        let changeableTokenAddress = await changer.changeableToken.call(0);
        assert.equal(changeableTokenAddress, tokenAddress);
        changeableTokenAddress = await changer.changeableToken.call(1);
        assert.equal(changeableTokenAddress, reserveTokenAddress);
    });

    it('verifies that 2 reserves are added correctly', async () => {
        let changer = await BancorChanger.new(tokenAddress, formulaAddress, '0x0', '0x0', 0);
        await changer.addReserve(reserveTokenAddress, 10, false);
        let reserve = await changer.reserves.call(reserveTokenAddress);
        verifyReserve(reserve, true, true, 10, false, 0);
        await changer.addReserve(reserveTokenAddress2, 20, false);
        reserve = await changer.reserves.call(reserveTokenAddress2);
        verifyReserve(reserve, true, true, 20, false, 0);
    });

    it('should throw when a non owner attempts to add a reserve', async () => {
        let changer = await BancorChanger.new(tokenAddress, formulaAddress, '0x0', '0x0', 0);

        try {
            await changer.addReserve(reserveTokenAddress, 10, false, { from: accounts[1] });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to add a reserve when the changer is active', async () => {
        let token = await SmartToken.new('Token1', 'TKN1', 2, '0x0');
        let changer = await BancorChanger.new(token.address, formulaAddress, '0x0', '0x0', 0);
        await token.setChanger(changer.address);

        try {
            await changer.addReserve(reserveTokenAddress, 10, false);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to add a reserve with invalid address', async () => {
        let changer = await BancorChanger.new(tokenAddress, formulaAddress, '0x0', '0x0', 0);

        try {
            await changer.addReserve('0x0', 10, false);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to add a reserve with ratio = 0', async () => {
        let changer = await BancorChanger.new(tokenAddress, formulaAddress, '0x0', '0x0', 0);

        try {
            await changer.addReserve(reserveTokenAddress, 0, false);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to add a reserve with ratio greater than 100', async () => {
        let changer = await BancorChanger.new(tokenAddress, formulaAddress, '0x0', '0x0', 0);

        try {
            await changer.addReserve(reserveTokenAddress, 101, false);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to add the token as a reserve', async () => {
        let changer = await BancorChanger.new(tokenAddress, formulaAddress, '0x0', '0x0', 0);

        try {
            await changer.addReserve(tokenAddress, 10, false);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to add the changer as a reserve', async () => {
        let changer = await BancorChanger.new(tokenAddress, formulaAddress, '0x0', '0x0', 0);

        try {
            await changer.addReserve(changer.address, 10, false);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to add a reserve that already exists', async () => {
        let changer = await BancorChanger.new(tokenAddress, formulaAddress, '0x0', '0x0', 0);
        await changer.addReserve(reserveTokenAddress, 10, false);

        try {
            await changer.addReserve(reserveTokenAddress, 20, false);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to add multiple reserves with total ratio greater than 100', async () => {
        let changer = await BancorChanger.new(tokenAddress, formulaAddress, '0x0', '0x0', 0);
        await changer.addReserve(reserveTokenAddress, 50, false);

        try {
            await changer.addReserve(reserveTokenAddress2, 51, false);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies that the owner can update a reserve', async () => {
        let changer = await BancorChanger.new(tokenAddress, formulaAddress, '0x0', '0x0', 0);
        await changer.addReserve(reserveTokenAddress, 10, false);
        let reserve = await changer.reserves.call(reserveTokenAddress);
        verifyReserve(reserve, true, true, 10, false, 0);
        await changer.updateReserve(reserveTokenAddress, 20, true, 50);
        reserve = await changer.reserves.call(reserveTokenAddress);
        verifyReserve(reserve, true, true, 20, true, 50);
    });

    it('should throw when a non owner attempts to update a reserve', async () => {
        let changer = await BancorChanger.new(tokenAddress, formulaAddress, '0x0', '0x0', 0);
        await changer.addReserve(reserveTokenAddress, 10, false);

        try {
            await changer.updateReserve(reserveTokenAddress, 20, false, 0, { from: accounts[1] });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to update a reserve that does not exist', async () => {
        let changer = await BancorChanger.new(tokenAddress, formulaAddress, '0x0', '0x0', 0);
        await changer.addReserve(reserveTokenAddress, 10, false);

        try {
            await changer.updateReserve(reserveTokenAddress2, 20, false, 0);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to update a reserve with ratio = 0', async () => {
        let changer = await BancorChanger.new(tokenAddress, formulaAddress, '0x0', '0x0', 0);
        await changer.addReserve(reserveTokenAddress, 10, false);

        try {
            await changer.updateReserve(reserveTokenAddress, 0, false, 0);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to update a reserve with ratio greater than 100', async () => {
        let changer = await BancorChanger.new(tokenAddress, formulaAddress, '0x0', '0x0', 0);
        await changer.addReserve(reserveTokenAddress, 10, false);

        try {
            await changer.updateReserve(reserveTokenAddress, 101, false, 0);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to update a reserve that will result in total ratio greater than 100', async () => {
        let changer = await BancorChanger.new(tokenAddress, formulaAddress, '0x0', '0x0', 0);
        await changer.addReserve(reserveTokenAddress, 50, false);
        await changer.addReserve(reserveTokenAddress2, 40, false);

        try {
            await changer.updateReserve(reserveTokenAddress2, 51, false, 0);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies that the owner can disable / re-enable a reserve', async () => {
        let changer = await BancorChanger.new(tokenAddress, formulaAddress, '0x0', '0x0', 0);
        await changer.addReserve(reserveTokenAddress, 10, false);
        let reserve = await changer.reserves.call(reserveTokenAddress);
        verifyReserve(reserve, true, true, 10, false, 0);
        await changer.disableReserve(reserveTokenAddress, true);
        reserve = await changer.reserves.call(reserveTokenAddress);
        verifyReserve(reserve, true, false, 10, false, 0);
        await changer.disableReserve(reserveTokenAddress, false);
        reserve = await changer.reserves.call(reserveTokenAddress);
        verifyReserve(reserve, true, true, 10, false, 0);
    });

    it('should throw when a non owner attempts to disable a reserve', async () => {
        let changer = await BancorChanger.new(tokenAddress, formulaAddress, '0x0', '0x0', 0);
        await changer.addReserve(reserveTokenAddress, 10, false);

        try {
            await changer.disableReserve(reserveTokenAddress, true, { from: accounts[1] });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to disable a reserve that does not exist', async () => {
        let changer = await BancorChanger.new(tokenAddress, formulaAddress, '0x0', '0x0', 0);
        await changer.addReserve(reserveTokenAddress, 10, false);

        try {
            await changer.disableReserve(reserveTokenAddress2, true);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies that the correct reserve balance is returned regardless of whether virtual balance is set or not', async () => {
        let changer = await BancorChanger.new(tokenAddress, formulaAddress, '0x0', '0x0', 0);
        let reserveToken = await TestERC20Token.new('ERC Token 1', 'ERC1', 100000);
        await changer.addReserve(reserveToken.address, 10, false);
        let reserveBalance;
        reserveBalance = await changer.getReserveBalance.call(reserveToken.address);
        assert.equal(reserveBalance, 0);
        await reserveToken.transfer(changer.address, 1000);
        reserveBalance = await changer.getReserveBalance.call(reserveToken.address);
        assert.equal(reserveBalance, 1000);
        await changer.updateReserve(reserveToken.address, 20, true, 5000);
        reserveBalance = await changer.getReserveBalance.call(reserveToken.address);
        assert.equal(reserveBalance, 5000);
        await changer.updateReserve(reserveToken.address, 20, false, 5000);
        reserveBalance = await changer.getReserveBalance.call(reserveToken.address);
        assert.equal(reserveBalance, 1000);
    });

    it('should throw when attempting to retrieve the balance for a reserve that does not exist', async () => {
        let changer = await BancorChanger.new(tokenAddress, formulaAddress, '0x0', '0x0', 0);
        await changer.addReserve(reserveTokenAddress, 10, false);

        try {
            await changer.getReserveBalance.call(reserveTokenAddress2);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies that the owner can issue tokens', async () => {
        let token = await SmartToken.new('Token1', 'TKN1', 2, '0x0');
        let changer = await BancorChanger.new(token.address, formulaAddress, '0x0', '0x0', 0);
        token.setChanger(changer.address);
        await changer.issueTokens(accounts[1], 100);
        let totalSupply = await token.totalSupply.call();
        assert.equal(totalSupply, 100);
        let balance = await token.balanceOf.call(accounts[1]);
        assert.equal(balance, 100);
    });

    it('should throw when a non owner attempts to issue tokens', async () => {
        let token = await SmartToken.new('Token1', 'TKN1', 2, '0x0');
        let changer = await BancorChanger.new(token.address, formulaAddress, '0x0', '0x0', 0);
        token.setChanger(changer.address);

        try {
            await changer.issueTokens(accounts[1], 100, { from: accounts[1] });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to issue tokens while the changer is inactive', async () => {
        let changer = await BancorChanger.new(tokenAddress, formulaAddress, '0x0', '0x0', 0);

        try {
            await changer.issueTokens(accounts[1], 100);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies that the owner can destroy tokens', async () => {
        let token = await SmartToken.new('Token1', 'TKN1', 2, '0x0');
        let changer = await BancorChanger.new(token.address, formulaAddress, '0x0', '0x0', 0);
        token.setChanger(changer.address);
        await changer.issueTokens(accounts[1], 100);
        await changer.destroyTokens(accounts[1], 20);
        let totalSupply = await token.totalSupply.call();
        assert.equal(totalSupply, 80);
        let balance = await token.balanceOf.call(accounts[1]);
        assert.equal(balance, 80);
    });

    it('should throw when a non owner attempts to destroy tokens', async () => {
        let token = await SmartToken.new('Token1', 'TKN1', 2, '0x0');
        let changer = await BancorChanger.new(token.address, formulaAddress, '0x0', '0x0', 0);
        token.setChanger(changer.address);
        await changer.issueTokens(accounts[1], 100);

        try {
            await changer.destroyTokens(accounts[1], 100, { from: accounts[1] });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to destroy tokens while the changer is inactive', async () => {
        let token = await SmartToken.new('Token1', 'TKN1', 2, '0x0');
        let changer = await BancorChanger.new(token.address, formulaAddress, '0x0', '0x0', 0);
        token.setChanger(changer.address);
        await changer.issueTokens(accounts[1], 100);
        await changer.setTokenChanger('0x0');

        try {
            await changer.destroyTokens(accounts[1], 20);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies that the owner can withdraw from the reserve', async () => {
        let changer = await BancorChanger.new(tokenAddress, formulaAddress, '0x0', '0x0', 0);
        let reserveToken = await TestERC20Token.new('ERC Token 1', 'ERC1', 100000);
        await changer.addReserve(reserveToken.address, 10, false);
        await reserveToken.transfer(changer.address, 1000);
        let changerBalance = await reserveToken.balanceOf(changer.address);
        assert.equal(changerBalance, 1000);
        await changer.withdraw(reserveToken.address, accounts[2], 50);
        changerBalance = await reserveToken.balanceOf(changer.address);
        assert.equal(changerBalance, 950);
        let account2Balance = await reserveToken.balanceOf(accounts[2]);
        assert.equal(account2Balance, 50);
    });

    it('should throw when a non owner attempts to withdraw from the reserve', async () => {
        let changer = await BancorChanger.new(tokenAddress, formulaAddress, '0x0', '0x0', 0);
        let reserveToken = await TestERC20Token.new('ERC Token 1', 'ERC1', 100000);
        await changer.addReserve(reserveToken.address, 10, false);
        await reserveToken.transfer(changer.address, 1000);

        try {
            await changer.withdraw(reserveToken.address, accounts[3], 50, { from: accounts[1] });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to withdraw from a reserve that does not exist', async () => {
        let changer = await BancorChanger.new(tokenAddress, formulaAddress, '0x0', '0x0', 0);
        let reserveToken = await TestERC20Token.new('ERC Token 1', 'ERC1', 100000);
        await changer.addReserve(reserveToken.address, 10, false);
        await reserveToken.transfer(changer.address, 1000);

        try {
            await changer.withdraw(reserveTokenAddress2, accounts[2], 50);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to withdraw from a reserve to an invalid address', async () => {
        let changer = await BancorChanger.new(tokenAddress, formulaAddress, '0x0', '0x0', 0);
        let reserveToken = await TestERC20Token.new('ERC Token 1', 'ERC1', 100000);
        await changer.addReserve(reserveToken.address, 10, false);
        await reserveToken.transfer(changer.address, 1000);

        try {
            await changer.withdraw(reserveToken.address, '0x0', 50);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to withdraw 0 amount from a reserve', async () => {
        let changer = await BancorChanger.new(tokenAddress, formulaAddress, '0x0', '0x0', 0);
        let reserveToken = await TestERC20Token.new('ERC Token 1', 'ERC1', 100000);
        await changer.addReserve(reserveToken.address, 10, false);
        await reserveToken.transfer(changer.address, 1000);

        try {
            await changer.withdraw(reserveToken.address, accounts[2], 0);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to withdraw from a reserve to the changer address', async () => {
        let changer = await BancorChanger.new(tokenAddress, formulaAddress, '0x0', '0x0', 0);
        let reserveToken = await TestERC20Token.new('ERC Token 1', 'ERC1', 100000);
        await changer.addReserve(reserveToken.address, 10, false);
        await reserveToken.transfer(changer.address, 1000);

        try {
            await changer.withdraw(changer.address, '0x0', 50);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to withdraw from a reserve to the token address', async () => {
        let changer = await BancorChanger.new(tokenAddress, formulaAddress, '0x0', '0x0', 0);
        let reserveToken = await TestERC20Token.new('ERC Token 1', 'ERC1', 100000);
        await changer.addReserve(reserveToken.address, 10, false);
        await reserveToken.transfer(changer.address, 1000);

        try {
            await changer.withdraw(tokenAddress, '0x0', 50);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });
});
