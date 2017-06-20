/* global artifacts, contract, before, it, assert */
/* eslint-disable prefer-reflect */

const BancorChanger = artifacts.require('BancorChanger.sol');
const SmartToken = artifacts.require('SmartToken.sol');
const BancorFormula = artifacts.require('BancorFormula.sol');
const TestERC20Token = artifacts.require('TestERC20Token.sol');
const utils = require('./helpers/Utils');

let token;
let tokenAddress;
let formulaAddress;
let reserveToken;
let reserveToken2;
let reserveTokenAddress;
let reserveTokenAddress2 = '0x32f0f93396f0865d7ce412695beb3c3ad9ccca75';

// used by purchase/sale tests
async function initChanger(accounts, activate) {
    token = await SmartToken.new('Token1', 'TKN1', 2);
    tokenAddress = token.address;

    reserveToken = await TestERC20Token.new('ERC Token 1', 'ERC1', 100000);
    reserveTokenAddress = reserveToken.address;

    reserveToken2 = await TestERC20Token.new('ERC Token 2', 'ERC2', 200000);
    reserveTokenAddress2 = reserveToken2.address;

    let changer = await BancorChanger.new(tokenAddress, formulaAddress, reserveTokenAddress, 25);
    let changerAddress = changer.address;
    await changer.addReserve(reserveTokenAddress2, 15, false);

    await token.issue(accounts[0], 20000);
    await reserveToken.transfer(changerAddress, 5000);
    await reserveToken2.transfer(changerAddress, 8000);

    if (activate) {
        await token.transferOwnership(changerAddress);
        await changer.acceptTokenOwnership();
    }

    return changer;
}

function verifyReserve(reserve, isSet, isEnabled, ratio, isVirtualBalanceEnabled, virtualBalance) {
    assert.equal(reserve[0], virtualBalance);
    assert.equal(reserve[1], ratio);
    assert.equal(reserve[2], isVirtualBalanceEnabled);
    assert.equal(reserve[3], isEnabled);
    assert.equal(reserve[4], isSet);
}

function getChangeAmount(transaction, logIndex = 0) {
    return transaction.logs[logIndex].args._return.toNumber();
}

contract('BancorChanger', (accounts) => {
    before(async () => {
        let token = await SmartToken.new('Token1', 'TKN1', 2);
        let formula = await BancorFormula.new();
        let reserveToken = await TestERC20Token.new('ERC Token 1', 'ERC1', 100000);
        tokenAddress = token.address;
        formulaAddress = formula.address;
        reserveTokenAddress = reserveToken.address;
    });

    it('verifies the token address and formula address after construction', async () => {
        let changer = await BancorChanger.new(tokenAddress, formulaAddress, '0x0', 0);
        let token = await changer.token.call();
        assert.equal(token, tokenAddress);
        let formula = await changer.formula.call();
        assert.equal(formula, formulaAddress);
    });

    it('should throw when attempting to construct a changer with no token', async () => {
        try {
            await BancorChanger.new('0x0', formulaAddress, '0x0', 0);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to construct a changer with no formula', async () => {
        try {
            await BancorChanger.new(tokenAddress, '0x0', '0x0', 0);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies the first reserve when provided at construction time', async () => {
        let changer = await BancorChanger.new(tokenAddress, formulaAddress, reserveTokenAddress, 20);
        let reserveToken = await changer.reserveTokens.call(0);
        assert.equal(reserveToken, reserveTokenAddress);
        let reserve = await changer.reserves.call(reserveToken);
        verifyReserve(reserve, true, true, 20, false, 0);
    });

    it('should throw when attempting to construct a changer with reserve with invalid ratio', async () => {
        try {
            await BancorChanger.new(tokenAddress, formulaAddress, reserveTokenAddress, 101);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies the reserve token count before / after adding a reserve', async () => {
        let changer = await BancorChanger.new(tokenAddress, formulaAddress, '0x0', 0);
        let reserveTokenCount = await changer.reserveTokenCount.call();
        assert.equal(reserveTokenCount, 0);
        await changer.addReserve(reserveTokenAddress, 10, false);
        reserveTokenCount = await changer.reserveTokenCount.call();
        assert.equal(reserveTokenCount, 1);
    });

    it('verifies the changeable token count before / after adding a reserve', async () => {
        let changer = await BancorChanger.new(tokenAddress, formulaAddress, '0x0', 0);
        let changeableTokenCount = await changer.changeableTokenCount.call();
        assert.equal(changeableTokenCount, 1);
        await changer.addReserve(reserveTokenAddress, 10, false);
        changeableTokenCount = await changer.changeableTokenCount.call();
        assert.equal(changeableTokenCount, 2);
    });

    it('verifies the changeable token addresses', async () => {
        let changer = await BancorChanger.new(tokenAddress, formulaAddress, '0x0', 0);
        await changer.addReserve(reserveTokenAddress, 10, false);
        let changeableTokenAddress = await changer.changeableToken.call(0);
        assert.equal(changeableTokenAddress, tokenAddress);
        changeableTokenAddress = await changer.changeableToken.call(1);
        assert.equal(changeableTokenAddress, reserveTokenAddress);
    });

    it('verifies the owner can update the formula contract address', async () => {
        let changer = await BancorChanger.new(tokenAddress, formulaAddress, '0x0', 0);
        await changer.setFormula(accounts[3]);
        let formula = await changer.formula.call(0);
        assert.notEqual(formula, formulaAddress);
    });

    it('should throw when a non owner attempts update the formula contract address', async () => {
        let changer = await BancorChanger.new(tokenAddress, formulaAddress, '0x0', 0);

        try {
            await changer.setFormula(accounts[3], { from: accounts[1] });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when a non owner attempts update the formula contract address with an invalid address', async () => {
        let changer = await BancorChanger.new(tokenAddress, formulaAddress, '0x0', 0);

        try {
            await changer.setFormula('0x0', { from: accounts[1] });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when a non owner attempts update the formula contract address with the changer address', async () => {
        let changer = await BancorChanger.new(tokenAddress, formulaAddress, '0x0', 0);

        try {
            await changer.setFormula(changer.address, { from: accounts[1] });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when a non owner attempts update the formula contract address with the same existing address', async () => {
        let changer = await BancorChanger.new(tokenAddress, formulaAddress, '0x0', 0);

        try {
            await changer.setFormula(formulaAddress, { from: accounts[1] });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies that 2 reserves are added correctly', async () => {
        let changer = await BancorChanger.new(tokenAddress, formulaAddress, '0x0', 0);
        await changer.addReserve(reserveTokenAddress, 10, false);
        let reserve = await changer.reserves.call(reserveTokenAddress);
        verifyReserve(reserve, true, true, 10, false, 0);
        await changer.addReserve(reserveTokenAddress2, 20, false);
        reserve = await changer.reserves.call(reserveTokenAddress2);
        verifyReserve(reserve, true, true, 20, false, 0);
    });

    it('should throw when a non owner attempts to add a reserve', async () => {
        let changer = await BancorChanger.new(tokenAddress, formulaAddress, '0x0', 0);

        try {
            await changer.addReserve(reserveTokenAddress, 10, false, { from: accounts[1] });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to add a reserve when the changer is active', async () => {
        let token = await SmartToken.new('Token1', 'TKN1', 2);
        let changer = await BancorChanger.new(token.address, formulaAddress, '0x0', 0);
        token.transferOwnership(changer.address);
        changer.acceptTokenOwnership();

        try {
            await changer.addReserve(reserveTokenAddress, 10, false);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to add a reserve with invalid address', async () => {
        let changer = await BancorChanger.new(tokenAddress, formulaAddress, '0x0', 0);

        try {
            await changer.addReserve('0x0', 10, false);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to add a reserve with ratio = 0', async () => {
        let changer = await BancorChanger.new(tokenAddress, formulaAddress, '0x0', 0);

        try {
            await changer.addReserve(reserveTokenAddress, 0, false);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to add a reserve with ratio greater than 100', async () => {
        let changer = await BancorChanger.new(tokenAddress, formulaAddress, '0x0', 0);

        try {
            await changer.addReserve(reserveTokenAddress, 101, false);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to add the token as a reserve', async () => {
        let changer = await BancorChanger.new(tokenAddress, formulaAddress, '0x0', 0);

        try {
            await changer.addReserve(tokenAddress, 10, false);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to add the changer as a reserve', async () => {
        let changer = await BancorChanger.new(tokenAddress, formulaAddress, '0x0', 0);

        try {
            await changer.addReserve(changer.address, 10, false);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to add a reserve that already exists', async () => {
        let changer = await BancorChanger.new(tokenAddress, formulaAddress, '0x0', 0);
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
        let changer = await BancorChanger.new(tokenAddress, formulaAddress, '0x0', 0);
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
        let changer = await BancorChanger.new(tokenAddress, formulaAddress, '0x0', 0);
        await changer.addReserve(reserveTokenAddress, 10, false);
        let reserve = await changer.reserves.call(reserveTokenAddress);
        verifyReserve(reserve, true, true, 10, false, 0);
        await changer.updateReserve(reserveTokenAddress, 20, true, 50);
        reserve = await changer.reserves.call(reserveTokenAddress);
        verifyReserve(reserve, true, true, 20, true, 50);
    });

    it('should throw when a non owner attempts to update a reserve', async () => {
        let changer = await BancorChanger.new(tokenAddress, formulaAddress, '0x0', 0);
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
        let changer = await BancorChanger.new(tokenAddress, formulaAddress, '0x0', 0);
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
        let changer = await BancorChanger.new(tokenAddress, formulaAddress, '0x0', 0);
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
        let changer = await BancorChanger.new(tokenAddress, formulaAddress, '0x0', 0);
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
        let changer = await BancorChanger.new(tokenAddress, formulaAddress, '0x0', 0);
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

    it('verifies that the owner can disable / re-enable reserve purchases', async () => {
        let changer = await BancorChanger.new(tokenAddress, formulaAddress, '0x0', 0);
        await changer.addReserve(reserveTokenAddress, 10, false);
        let reserve = await changer.reserves.call(reserveTokenAddress);
        verifyReserve(reserve, true, true, 10, false, 0);
        await changer.disableReservePurchases(reserveTokenAddress, true);
        reserve = await changer.reserves.call(reserveTokenAddress);
        verifyReserve(reserve, true, false, 10, false, 0);
        await changer.disableReservePurchases(reserveTokenAddress, false);
        reserve = await changer.reserves.call(reserveTokenAddress);
        verifyReserve(reserve, true, true, 10, false, 0);
    });

    it('should throw when a non owner attempts to disable reserve purchases', async () => {
        let changer = await BancorChanger.new(tokenAddress, formulaAddress, '0x0', 0);
        await changer.addReserve(reserveTokenAddress, 10, false);

        try {
            await changer.disableReservePurchases(reserveTokenAddress, true, { from: accounts[1] });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to disable reserve purchases for a reserve that does not exist', async () => {
        let changer = await BancorChanger.new(tokenAddress, formulaAddress, '0x0', 0);
        await changer.addReserve(reserveTokenAddress, 10, false);

        try {
            await changer.disableReservePurchases(reserveTokenAddress2, true);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies that the correct reserve balance is returned regardless of whether virtual balance is set or not', async () => {
        let changer = await BancorChanger.new(tokenAddress, formulaAddress, '0x0', 0);
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
        let changer = await BancorChanger.new(tokenAddress, formulaAddress, '0x0', 0);
        await changer.addReserve(reserveTokenAddress, 10, false);

        try {
            await changer.getReserveBalance.call(reserveTokenAddress2);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies that the owner can withdraw from the reserve', async () => {
        let changer = await BancorChanger.new(tokenAddress, formulaAddress, '0x0', 0);
        let reserveToken = await TestERC20Token.new('ERC Token 1', 'ERC1', 100000);
        await changer.addReserve(reserveToken.address, 10, false);
        await reserveToken.transfer(changer.address, 1000);
        let changerBalance = await reserveToken.balanceOf(changer.address);
        assert.equal(changerBalance, 1000);
        await changer.withdrawTokens(reserveToken.address, accounts[2], 50);
        changerBalance = await reserveToken.balanceOf(changer.address);
        assert.equal(changerBalance, 950);
        let account2Balance = await reserveToken.balanceOf(accounts[2]);
        assert.equal(account2Balance, 50);
    });

    it('should throw when a non owner attempts to withdraw from the reserve', async () => {
        let changer = await BancorChanger.new(tokenAddress, formulaAddress, '0x0', 0);
        let reserveToken = await TestERC20Token.new('ERC Token 1', 'ERC1', 100000);
        await changer.addReserve(reserveToken.address, 10, false);
        await reserveToken.transfer(changer.address, 1000);

        try {
            await changer.withdrawTokens(reserveToken.address, accounts[3], 50, { from: accounts[1] });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to withdraw from a reserve to an invalid address', async () => {
        let changer = await BancorChanger.new(tokenAddress, formulaAddress, '0x0', 0);
        let reserveToken = await TestERC20Token.new('ERC Token 1', 'ERC1', 100000);
        await changer.addReserve(reserveToken.address, 10, false);
        await reserveToken.transfer(changer.address, 1000);

        try {
            await changer.withdrawTokens(reserveToken.address, '0x0', 50);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to withdraw from a reserve to the changer address', async () => {
        let changer = await BancorChanger.new(tokenAddress, formulaAddress, '0x0', 0);
        let reserveToken = await TestERC20Token.new('ERC Token 1', 'ERC1', 100000);
        await changer.addReserve(reserveToken.address, 10, false);
        await reserveToken.transfer(changer.address, 1000);

        try {
            await changer.withdrawTokens(reserveToken.address, changer.address, 50);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies that getReturn returns a valid amount', async () => {
        let changer = await initChanger(accounts, true);
        let returnAmount = await changer.getReturn.call(reserveTokenAddress, tokenAddress, 500);
        assert.isNumber(returnAmount.toNumber());
        assert.notEqual(returnAmount.toNumber(), 0);
    });

    it('verifies that getReturn returns the same amount as getPurchaseReturn when changing from a reserve to the token', async () => {
        let changer = await initChanger(accounts, true);
        let returnAmount = await changer.getReturn.call(reserveTokenAddress, tokenAddress, 500);
        let purchaseReturnAmount = await changer.getPurchaseReturn.call(reserveTokenAddress, 500);
        assert.equal(returnAmount.toNumber(), purchaseReturnAmount.toNumber());
    });

    it('verifies that getReturn returns the same amount as getSaleReturn when changing from the token to a reserve', async () => {
        let changer = await initChanger(accounts, true);
        let returnAmount = await changer.getReturn.call(tokenAddress, reserveTokenAddress, 500);
        let saleReturnAmount = await changer.getSaleReturn.call(reserveTokenAddress, 500);
        assert.isNumber(returnAmount.toNumber());
        assert.notEqual(returnAmount.toNumber(), 0);
        assert.equal(returnAmount.toNumber(), saleReturnAmount.toNumber());
    });

    it('verifies that getReturn returns the same amount as buy -> sell when changing from reserve 1 to reserve 2', async () => {
        let changer = await initChanger(accounts, true);
        let returnAmount = await changer.getReturn.call(reserveTokenAddress, reserveTokenAddress2, 500);

        await reserveToken.approve(changer.address, 500);
        let purchaseRes = await changer.buy(reserveTokenAddress, 500, 1);
        let purchaseAmount = getChangeAmount(purchaseRes);

        let saleRes = await changer.sell(reserveTokenAddress2, purchaseAmount, 1);
        let saleAmount = getChangeAmount(saleRes);

        assert.equal(returnAmount, saleAmount);
    });

    it('should throw when attempting to get the return with an invalid from token adress', async () => {
        let changer = await initChanger(accounts, true);

        try {
            await changer.getReturn.call('0x0', reserveTokenAddress2, 500);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to get the return with an invalid to token address', async () => {
        let changer = await initChanger(accounts, true);

        try {
            await changer.getReturn.call(reserveTokenAddress, '0x0', 500);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to get the return with identical from/to addresses', async () => {
        let changer = await initChanger(accounts, true);

        try {
            await changer.getReturn.call(reserveTokenAddress, reserveTokenAddress, 500);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to get the purchase return while the changer is not active', async () => {
        let changer = await initChanger(accounts, false);

        try {
            await changer.getPurchaseReturn.call(reserveTokenAddress, 500);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to get the purchase return with a non reserve address', async () => {
        let changer = await initChanger(accounts, true);

        try {
            await changer.getPurchaseReturn.call(tokenAddress, 500);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to get the purchase return while purchasing with the reserve is disabled', async () => {
        let changer = await initChanger(accounts, true);
        await changer.disableReservePurchases(reserveTokenAddress, true);

        try {
            await changer.getPurchaseReturn.call(reserveTokenAddress, 500);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to get the sale return while the changer is not active', async () => {
        let changer = await initChanger(accounts, false);

        try {
            await changer.getSaleReturn.call(reserveTokenAddress, 500);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to get the sale return with a non reserve address', async () => {
        let changer = await initChanger(accounts, true);

        try {
            await changer.getSaleReturn.call(tokenAddress, 500);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies that change returns a valid amount', async () => {
        let changer = await initChanger(accounts, true);
        await reserveToken.approve(changer.address, 500);
        let res = await changer.change(reserveTokenAddress, tokenAddress, 500, 1);
        let changeAmount = getChangeAmount(res);
        assert.isNumber(changeAmount);
        assert.notEqual(changeAmount, 0);
    });

    it('verifies that change returns the same amount as buy when changing from a reserve to the token', async () => {
        let changer = await initChanger(accounts, true);
        await reserveToken.approve(changer.address, 500);
        let changeRes = await changer.change(reserveTokenAddress, tokenAddress, 500, 1);
        let changeAmount = getChangeAmount(changeRes);
        assert.isNumber(changeAmount);
        assert.notEqual(changeAmount, 0);

        changer = await initChanger(accounts, true);
        await reserveToken.approve(changer.address, 500);
        let purchaseRes = await changer.buy(reserveTokenAddress, 500, 1);
        let purchaseAmount = getChangeAmount(purchaseRes);
        assert.equal(changeAmount, purchaseAmount);
    });

    it('verifies that change returns the same amount as sell when changing from the token to a reserve', async () => {
        let changer = await initChanger(accounts, true);
        let changeRes = await changer.change(tokenAddress, reserveTokenAddress, 500, 1);
        let changeAmount = getChangeAmount(changeRes);
        assert.isNumber(changeAmount);
        assert.notEqual(changeAmount, 0);

        changer = await initChanger(accounts, true);
        let saleRes = await changer.sell(reserveTokenAddress, 500, 1);
        let saleAmount = getChangeAmount(saleRes);
        assert.equal(changeAmount, saleAmount);
    });

    it('verifies that change returns the same amount as buy -> sell when changing from reserve 1 to reserve 2', async () => {
        let changer = await initChanger(accounts, true);
        await reserveToken.approve(changer.address, 500);

        let changeRes = await changer.change(reserveTokenAddress, reserveTokenAddress2, 500, 1);
        let changeAmount = getChangeAmount(changeRes, 1);
        assert.isNumber(changeAmount);
        assert.notEqual(changeAmount, 0);

        changer = await initChanger(accounts, true);
        await reserveToken.approve(changer.address, 500);
        let purchaseRes = await changer.buy(reserveTokenAddress, 500, 1);
        let purchaseAmount = getChangeAmount(purchaseRes);

        let saleRes = await changer.sell(reserveTokenAddress2, purchaseAmount, 1);
        let saleAmount = getChangeAmount(saleRes);

        assert.equal(changeAmount, saleAmount);
    });

    it('verifies that selling right after buying does not result in an amount greater than the original purchase amount', async () => {
        let changer = await initChanger(accounts, true);
        await reserveToken.approve(changer.address, 500);
        let purchaseRes = await changer.buy(reserveTokenAddress, 500, 1);
        let purchaseAmount = getChangeAmount(purchaseRes);

        let saleRes = await changer.sell(reserveTokenAddress, purchaseAmount, 1);
        let saleAmount = getChangeAmount(saleRes);

        assert(saleAmount <= 500);
    });

    it('verifies that buying right after selling does not result in an amount greater than the original sale amount', async () => {
        let changer = await initChanger(accounts, true);

        let saleRes = await changer.sell(reserveTokenAddress, 500, 1);
        let saleAmount = getChangeAmount(saleRes);

        await reserveToken.approve(changer.address, 500);
        let purchaseRes = await changer.buy(reserveTokenAddress, saleAmount, 1);
        let purchaseAmount = getChangeAmount(purchaseRes);

        assert(purchaseAmount <= 500);
    });

    it('should throw when attempting to change with an invalid from token adress', async () => {
        let changer = await initChanger(accounts, true);
        await reserveToken.approve(changer.address, 500);

        try {
            await changer.change('0x0', reserveTokenAddress2, 500, 1);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to change with an invalid to token address', async () => {
        let changer = await initChanger(accounts, true);
        await reserveToken.approve(changer.address, 500);

        try {
            await changer.change(reserveTokenAddress, '0x0', 500, 1);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to change with identical from/to addresses', async () => {
        let changer = await initChanger(accounts, true);
        await reserveToken.approve(changer.address, 500);

        try {
            await changer.change(reserveTokenAddress, reserveTokenAddress, 500, 0);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to change with 0 minimum requested amount', async () => {
        let changer = await initChanger(accounts, true);
        await reserveToken.approve(changer.address, 500);

        try {
            await changer.change(reserveTokenAddress, reserveTokenAddress2, 500, 2000);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to change when the return is smaller than the minimum requested amount', async () => {
        let changer = await initChanger(accounts, true);
        await reserveToken.approve(changer.address, 500);

        try {
            await changer.change(reserveTokenAddress, reserveTokenAddress2, 500, 2000);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies balances after buy', async () => {
        let changer = await initChanger(accounts, true);

        let tokenPrevBalance = await token.balanceOf.call(accounts[0]);
        let reserveTokenPrevBalance = await reserveToken.balanceOf.call(accounts[0]);

        await reserveToken.approve(changer.address, 500);
        let purchaseRes = await changer.buy(reserveTokenAddress, 500, 1);
        let purchaseAmount = getChangeAmount(purchaseRes);

        let reserveTokenNewBalance = await reserveToken.balanceOf.call(accounts[0]);
        assert.equal(reserveTokenNewBalance.toNumber(), reserveTokenPrevBalance.minus(500).toNumber());

        let tokenNewBalance = await token.balanceOf.call(accounts[0]);
        assert.equal(tokenNewBalance.toNumber(), tokenPrevBalance.plus(purchaseAmount).toNumber());
    });

    it('should throw when attempting to buy while the changer is not active', async () => {
        let changer = await initChanger(accounts, false);
        await reserveToken.approve(changer.address, 500);

        try {
            await changer.buy(reserveTokenAddress, 500, 1);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to buy with a non reserve address', async () => {
        let changer = await initChanger(accounts, true);
        await reserveToken.approve(changer.address, 500);

        try {
            await changer.buy(tokenAddress, 500, 1);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to buy while the purchase yields 0 return', async () => {
        let changer = await initChanger(accounts, true);
        await reserveToken.approve(changer.address, 500);

        try {
            await changer.buy(reserveTokenAddress, 0, 1);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to buy with 0 minimum requested amount', async () => {
        let changer = await initChanger(accounts, true);
        await reserveToken.approve(changer.address, 500);

        try {
            await changer.buy(reserveTokenAddress, 500, 0);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to buy when the return is smaller than the minimum requested amount', async () => {
        let changer = await initChanger(accounts, true);
        await reserveToken.approve(changer.address, 500);

        try {
            await changer.buy(reserveTokenAddress, 500, 2000);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to buy while the reserve purchases are disabled', async () => {
        let changer = await initChanger(accounts, true);
        await reserveToken.approve(changer.address, 500);
        await changer.disableReservePurchases(reserveTokenAddress, true);

        try {
            await changer.buy(reserveTokenAddress, 500, 1);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to buy without first approving the change to transfer from the buyer account in the reserve contract', async () => {
        let changer = await initChanger(accounts, true);

        try {
            await changer.buy(reserveTokenAddress, 500, 1);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies balances after sell', async () => {
        let changer = await initChanger(accounts, true);

        let tokenPrevBalance = await token.balanceOf.call(accounts[0]);
        let reserveTokenPrevBalance = await reserveToken.balanceOf.call(accounts[0]);

        let saleRes = await changer.sell(reserveTokenAddress, 500, 1);
        let saleAmount = getChangeAmount(saleRes);

        let reserveTokenNewBalance = await reserveToken.balanceOf.call(accounts[0]);
        assert.equal(reserveTokenNewBalance.toNumber(), reserveTokenPrevBalance.plus(saleAmount).toNumber());

        let tokenNewBalance = await token.balanceOf.call(accounts[0]);
        assert.equal(tokenNewBalance.toNumber(), tokenPrevBalance.minus(500).toNumber());
    });

    it('should throw when attempting to sell while the changer is not active', async () => {
        let changer = await initChanger(accounts, false);

        try {
            await changer.sell(reserveTokenAddress, 500, 1);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to sell with a non reserve address', async () => {
        let changer = await initChanger(accounts, true);

        try {
            await changer.sell(tokenAddress, 500, 1);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to sell while the sale yields 0 return', async () => {
        let changer = await initChanger(accounts, true);

        try {
            await changer.sell(reserveTokenAddress, 0, 1);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to sell with 0 minimum requested amount', async () => {
        let changer = await initChanger(accounts, true);

        try {
            await changer.sell(reserveTokenAddress, 500, 0);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to sell when the return is smaller than the minimum requested amount', async () => {
        let changer = await initChanger(accounts, true);

        try {
            await changer.sell(reserveTokenAddress, 500, 2000);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to sell with amount greater then the seller balance', async () => {
        let changer = await initChanger(accounts, true);

        try {
            await changer.sell(reserveTokenAddress, 30000, 1);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });
});
