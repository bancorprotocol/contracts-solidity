/* global artifacts, contract, before, it, assert, web3 */
/* eslint-disable prefer-reflect */

const CrowdsaleChanger = artifacts.require('CrowdsaleChanger.sol');
const SmartToken = artifacts.require('SmartToken.sol');
const EtherToken = artifacts.require('EtherToken.sol');
const TestERC20Token = artifacts.require('TestERC20Token.sol');
const TestCrowdsaleChanger = artifacts.require('TestCrowdsaleChanger.sol');
const utils = require('./helpers/Utils');

let token;
let tokenAddress;
let etherToken;
let etherTokenAddress;
let erc20Token;
let erc20Token2;
let erc20TokenAddress;
let erc20TokenAddress2 = '0x32f0f93396f0865d7ce412695beb3c3ad9ccca75';
let beneficiaryAddress = '0x69aa30b306805bd17488ce957d03e3c0213ee9e6';
let btcsAddress;
let address1 = '0x3e3ac49882f3fc4b768139af45588242e50e5701';
let startTime = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60; // crowdsale hasn't started
let startTimeInProgress = Math.floor(Date.now() / 1000) - 12 * 60 * 60; // ongoing crowdsale
let startTimeFinished = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60; // ongoing crowdsale
let realCap = 1000;
let realCapKey = 234;
let realEtherCapHash = '0xd3a40f1165164f13f237cc938419cc292e66b7bb3aa190f21087a3813c5ae1ca';  // sha3(uint256(1000), uint256(234))

async function generateDefaultChanger() {
    return await CrowdsaleChanger.new(tokenAddress, etherTokenAddress, startTime, beneficiaryAddress, btcsAddress, realEtherCapHash);
}

// used by contribution tests, creates a changer that's already in progress
async function initChanger(accounts, activate, startTimeOverride = startTimeInProgress) {
    token = await SmartToken.new('Token1', 'TKN1', 2);
    tokenAddress = token.address;

    etherToken = await EtherToken.new();
    etherTokenAddress = etherToken.address;

    erc20Token = await TestERC20Token.new('ERC Token 1', 'ERC1', 100000);
    erc20TokenAddress = erc20Token.address;

    erc20Token2 = await TestERC20Token.new('ERC Token 2', 'ERC2', 200000);
    erc20TokenAddress2 = erc20Token2.address;

    let changer = await TestCrowdsaleChanger.new(tokenAddress, etherTokenAddress, startTime, beneficiaryAddress, btcsAddress, realEtherCapHash, startTimeOverride);
    let changerAddress = changer.address;
    await changer.addERC20Token(erc20TokenAddress, 2, 5);
    await changer.addERC20Token(erc20TokenAddress2, 3, 7);

    if (activate)
        await token.setChanger(changerAddress);

    return changer;
}

function verifyERC20Token(erc20Token, isSet, isEnabled, valueN, valueD) {
    assert.equal(erc20Token[0], valueN);
    assert.equal(erc20Token[1], valueD);
    assert.equal(erc20Token[2], isEnabled);
    assert.equal(erc20Token[3], isSet);
}

function getChangeAmount(transaction, logIndex = 0) {
    return transaction.logs[logIndex].args._return.toNumber();
}

contract('CrowdsaleChanger', (accounts) => {
    before(async () => {
        let token = await SmartToken.new('Token1', 'TKN1', 2);
        let etherToken = await EtherToken.new();
        let erc20Token = await TestERC20Token.new('ERC Token 1', 'ERC1', 100000);
        tokenAddress = token.address;
        etherTokenAddress = etherToken.address;
        erc20TokenAddress = erc20Token.address;
        btcsAddress = accounts[4];
    });

    it('verifies the base storage values after construction', async () => {
        let changer = await generateDefaultChanger();
        let token = await changer.token.call();
        assert.equal(token, tokenAddress);
        let etherToken = await changer.etherToken.call();
        assert.equal(etherToken, etherTokenAddress);
        let start = await changer.startTime.call();
        assert.equal(start, startTime);
        let endTime = await changer.endTime.call();
        assert.equal(endTime, startTime + 7 * 24 * 60 * 60); // start time + 7 days
        let beneficiary = await changer.beneficiary.call();
        assert.equal(beneficiary, beneficiaryAddress);
        let btcs = await changer.btcs.call();
        assert.equal(btcs, btcsAddress);
        let realCapHash = await changer.realEtherCapHash.call();
        assert.equal(realCapHash, realEtherCapHash);
        let acceptedTokenCount = await changer.acceptedTokenCount.call();
        assert.equal(acceptedTokenCount, 1); // ether token is added on construction
    });

    it('should throw when attempting to construct a changer with no token', async () => {
        try {
            await CrowdsaleChanger.new('0x0', etherTokenAddress, startTime, beneficiaryAddress, btcsAddress, realEtherCapHash);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to construct a changer with no ether token', async () => {
        try {
            await CrowdsaleChanger.new(tokenAddress, '0x0', startTime, beneficiaryAddress, btcsAddress, realEtherCapHash);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to construct a changer with start time that has already passed', async () => {
        try {
            await CrowdsaleChanger.new(tokenAddress, etherTokenAddress, 10000000, beneficiaryAddress, btcsAddress, realEtherCapHash);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to construct a changer without beneficiary address', async () => {
        try {
            await CrowdsaleChanger.new(tokenAddress, etherTokenAddress, startTime, '0x0', btcsAddress, realEtherCapHash);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to construct a changer without bitcoin suisse address', async () => {
        try {
            await CrowdsaleChanger.new(tokenAddress, etherTokenAddress, startTime, beneficiaryAddress, '0x0', realEtherCapHash);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to construct a changer without ether cap hash', async () => {
        try {
            await CrowdsaleChanger.new(tokenAddress, etherTokenAddress, startTime, beneficiaryAddress, btcsAddress, 0);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies the erc20 token count before / after adding an erc20 token', async () => {
        let changer = await generateDefaultChanger();
        let acceptedTokenCount = await changer.acceptedTokenCount.call();
        assert.equal(acceptedTokenCount, 1); // ether token is added on construction
        await changer.addERC20Token(erc20TokenAddress, 2, 5);
        acceptedTokenCount = await changer.acceptedTokenCount.call();
        assert.equal(acceptedTokenCount, 2);
    });

    it('verifies the changeable token count before / after adding an erc20 token', async () => {
        let changer = await generateDefaultChanger();
        let changeableTokenCount = await changer.changeableTokenCount.call();
        assert.equal(changeableTokenCount, 2);
        await changer.addERC20Token(erc20TokenAddress, 2, 5);
        changeableTokenCount = await changer.changeableTokenCount.call();
        assert.equal(changeableTokenCount, 3);
    });

    it('verifies the changeable token addresses', async () => {
        let changer = await generateDefaultChanger();
        await changer.addERC20Token(erc20TokenAddress, 2, 5);
        let changeableTokenAddress = await changer.changeableToken.call(0);
        assert.equal(changeableTokenAddress, tokenAddress);
        changeableTokenAddress = await changer.changeableToken.call(1);
        assert.equal(changeableTokenAddress, etherTokenAddress);
    });

    it('verifies that the owner can initialze the erc20 tokens', async () => {
        let changer = await generateDefaultChanger();
        await changer.initERC20Tokens();
        let acceptedTokenCount = await changer.acceptedTokenCount.call();
        assert.isAbove(acceptedTokenCount, 1);
    });

    it('should throw when a non token owner attempts initialze the erc20 tokens', async () => {
        let changer = await generateDefaultChanger();

        try {
            await changer.initERC20Tokens({ from: accounts[1] });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies that 2 erc20 tokens are added correctly', async () => {
        let changer = await generateDefaultChanger();
        await changer.addERC20Token(erc20TokenAddress, 2, 5);
        let erc20Token = await changer.tokenData.call(erc20TokenAddress);
        verifyERC20Token(erc20Token, true, true, 2, 5);
        await changer.addERC20Token(erc20TokenAddress2, 3, 7);
        erc20Token = await changer.tokenData.call(erc20TokenAddress2);
        verifyERC20Token(erc20Token, true, true, 3, 7);
    });

    it('should throw when a non token owner attempts to add an erc20 token', async () => {
        let changer = await generateDefaultChanger();

        try {
            await changer.addERC20Token(erc20TokenAddress, 2, 5, { from: accounts[1] });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to add an erc20 token when the changer is active', async () => {
        let token = await SmartToken.new('Token1', 'TKN1', 2);
        let changer = await CrowdsaleChanger.new(token.address, etherTokenAddress, startTime, beneficiaryAddress, btcsAddress, realEtherCapHash);
        await token.setChanger(changer.address);

        try {
            await changer.addERC20Token(erc20TokenAddress, 2, 5);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to add an erc20 token with invalid address', async () => {
        let changer = await generateDefaultChanger();

        try {
            await changer.addERC20Token('0x0', 2, 5);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to add an erc20 token with valueN = 0', async () => {
        let changer = await generateDefaultChanger();

        try {
            await changer.addERC20Token(erc20TokenAddress, 0, 2);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to add an erc20 token with valueD = 0', async () => {
        let changer = await generateDefaultChanger();

        try {
            await changer.addERC20Token(erc20TokenAddress, 2, 0);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to add the token as an erc20 token', async () => {
        let changer = await generateDefaultChanger();

        try {
            await changer.addERC20Token(tokenAddress, 2, 5);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to add the changer as an erc20 token', async () => {
        let changer = await generateDefaultChanger();

        try {
            await changer.addERC20Token(changer.address, 2, 5);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to add an erc20 token that already exists', async () => {
        let changer = await generateDefaultChanger();
        await changer.addERC20Token(erc20TokenAddress, 2, 5);

        try {
            await changer.addERC20Token(erc20TokenAddress, 2, 7);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies that the token owner can update an erc20 value', async () => {
        let changer = await generateDefaultChanger();
        await changer.addERC20Token(erc20TokenAddress, 2, 5);
        let erc20Token = await changer.tokenData.call(erc20TokenAddress);
        verifyERC20Token(erc20Token, true, true, 2, 5);
        await changer.updateERC20Token(erc20TokenAddress, 3, 7);
        erc20Token = await changer.tokenData.call(erc20TokenAddress);
        verifyERC20Token(erc20Token, true, true, 3, 7);
    });

    it('should throw when a non token owner attempts to update an erc20 token', async () => {
        let changer = await generateDefaultChanger();
        await changer.addERC20Token(erc20TokenAddress, 2, 5);

        try {
            await changer.updateERC20Token(erc20TokenAddress, 3, 7, { from: accounts[1] });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to update an erc20 token that does not exist', async () => {
        let changer = await generateDefaultChanger();
        await changer.addERC20Token(erc20TokenAddress, 2, 5);

        try {
            await changer.updateERC20Token(erc20TokenAddress2, 3, 7);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to update an erc20 token with valueN = 0', async () => {
        let changer = await generateDefaultChanger();
        await changer.addERC20Token(erc20TokenAddress, 2, 5);

        try {
            await changer.updateERC20Token(erc20TokenAddress, 0, 7);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to update an erc20 token with valueD = 0', async () => {
        let changer = await generateDefaultChanger();
        await changer.addERC20Token(erc20TokenAddress, 2, 5);

        try {
            await changer.updateERC20Token(erc20TokenAddress, 3, 0);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies that the token owner can disable / re-enable purchases with an erc20 token', async () => {
        let changer = await generateDefaultChanger();
        await changer.addERC20Token(erc20TokenAddress, 2, 5);
        let erc20Token = await changer.tokenData.call(erc20TokenAddress);
        verifyERC20Token(erc20Token, true, true, 2, 5);
        await changer.disableERC20Token(erc20TokenAddress, true);
        erc20Token = await changer.tokenData.call(erc20TokenAddress);
        verifyERC20Token(erc20Token, true, false, 2, 5);
        await changer.disableERC20Token(erc20TokenAddress, false);
        erc20Token = await changer.tokenData.call(erc20TokenAddress);
        verifyERC20Token(erc20Token, true, true, 2, 5);
    });

    it('should throw when a non token owner attempts to disable purchases with an erc20 token', async () => {
        let changer = await generateDefaultChanger();
        await changer.addERC20Token(erc20TokenAddress, 2, 5);

        try {
            await changer.disableERC20Token(erc20TokenAddress, true, { from: accounts[1] });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to disable purchases for an erc20 token that does not exist', async () => {
        let changer = await generateDefaultChanger();
        await changer.addERC20Token(erc20TokenAddress, 2, 5);

        try {
            await changer.disableERC20Token(erc20TokenAddress2, true);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies that the token owner can withdraw from the changer address in one of the erc20 tokens', async () => {
        let changer = await generateDefaultChanger();
        let erc20Token = await TestERC20Token.new('ERC Token 1', 'ERC1', 100000);
        await changer.addERC20Token(erc20Token.address, 2, 5);
        await erc20Token.transfer(changer.address, 1000);
        let changerBalance = await erc20Token.balanceOf(changer.address);
        assert.equal(changerBalance, 1000);
        await changer.withdraw(erc20Token.address, accounts[2], 50);
        changerBalance = await erc20Token.balanceOf(changer.address);
        assert.equal(changerBalance, 950);
        let account2Balance = await erc20Token.balanceOf(accounts[2]);
        assert.equal(account2Balance, 50);
    });

    it('should throw when a non token owner attempts to withdraw from the changer address in one of the erc20 tokens', async () => {
        let changer = await generateDefaultChanger();
        let erc20Token = await TestERC20Token.new('ERC Token 1', 'ERC1', 100000);
        await changer.addERC20Token(erc20Token.address, 2, 5);
        await erc20Token.transfer(changer.address, 1000);

        try {
            await changer.withdraw(erc20Token.address, accounts[3], 50, { from: accounts[1] });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to withdraw from the changer address in an erc20 token that does not exist', async () => {
        let changer = await generateDefaultChanger();
        let erc20Token = await TestERC20Token.new('ERC Token 1', 'ERC1', 100000);
        await changer.addERC20Token(erc20Token.address, 2, 5);
        await erc20Token.transfer(changer.address, 1000);

        try {
            await changer.withdraw(erc20TokenAddress2, accounts[2], 50);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to withdraw from the changer address in an erc20 token to an invalid address', async () => {
        let changer = await generateDefaultChanger();
        let erc20Token = await TestERC20Token.new('ERC Token 1', 'ERC1', 100000);
        await changer.addERC20Token(erc20Token.address, 2, 5);
        await erc20Token.transfer(changer.address, 1000);

        try {
            await changer.withdraw(erc20Token.address, '0x0', 50);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to withdraw 0 amount from the changer address in an erc20 token', async () => {
        let changer = await generateDefaultChanger();
        let erc20Token = await TestERC20Token.new('ERC Token 1', 'ERC1', 100000);
        await changer.addERC20Token(erc20Token.address, 2, 5);
        await erc20Token.transfer(changer.address, 1000);

        try {
            await changer.withdraw(erc20Token.address, accounts[2], 0);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to withdraw from the changer address in an erc20 token to the changer address', async () => {
        let changer = await generateDefaultChanger();
        let erc20Token = await TestERC20Token.new('ERC Token 1', 'ERC1', 100000);
        await changer.addERC20Token(erc20Token.address, 2, 5);
        await erc20Token.transfer(changer.address, 1000);

        try {
            await changer.withdraw(erc20Token.address, changer.address, 50);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to withdraw from the changer address in an erc20 token to the token address', async () => {
        let changer = await generateDefaultChanger();
        let erc20Token = await TestERC20Token.new('ERC Token 1', 'ERC1', 100000);
        await changer.addERC20Token(erc20Token.address, 2, 5);
        await erc20Token.transfer(changer.address, 1000);

        try {
            await changer.withdraw(erc20Token.address, tokenAddress, 50);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies the real ether cap balance after enabled by the owner', async () => {
        let changer = await initChanger(accounts, true);
        await changer.enableRealCap(realCap, realCapKey);
        let totalEtherCap = await changer.totalEtherCap.call();
        assert.equal(totalEtherCap, realCap);
    });

    it('should throw when a non owner attempts to enable the real ether cap', async () => {
        let changer = await initChanger(accounts, true);

        try {
            await changer.enableRealCap(realCap, realCapKey, { from: accounts[1] });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when the owner attempts to enable the real ether cap while the changer is not active', async () => {
        let changer = await initChanger(accounts, true);
        await changer.setTokenChanger('0x0');

        try {
            await changer.enableRealCap(realCap, realCapKey);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when the owner attempts to enable the real ether cap before the start time', async () => {
        let token = await SmartToken.new('Token1', 'TKN1', 2);
        let changer = await CrowdsaleChanger.new(token.address, etherTokenAddress, startTime, beneficiaryAddress, btcsAddress, realEtherCapHash);
        await token.setChanger(changer.address);

        try {
            await changer.enableRealCap(realCap, realCapKey);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when the owner attempts to enable the real ether cap with an invalid cap', async () => {
        let changer = await initChanger(accounts, true);

        try {
            await changer.enableRealCap(0, realCapKey);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when the owner attempts to enable the real ether cap with the wrong real cap', async () => {
        let changer = await initChanger(accounts, true);

        try {
            await changer.enableRealCap(1001, realCapKey);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when the owner attempts to enable the real ether cap with the wrong cap key', async () => {
        let changer = await initChanger(accounts, true);

        try {
            await changer.enableRealCap(realCap, 235);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies that the token owner can set the token changer', async () => {
        let token = await SmartToken.new('Token1', 'TKN1', 2);
        let changer = await CrowdsaleChanger.new(token.address, etherTokenAddress, startTime, beneficiaryAddress, btcsAddress, realEtherCapHash);
        await token.setChanger(changer.address);
        await changer.setTokenChanger(address1);
        let newChanger = await token.changer.call();
        assert.equal(newChanger, address1);
    });

    it('verifies that the token owner can remove the token changer', async () => {
        let token = await SmartToken.new('Token1', 'TKN1', 2);
        let changer = await CrowdsaleChanger.new(token.address, etherTokenAddress, startTime, beneficiaryAddress, btcsAddress, realEtherCapHash);
        await token.setChanger(changer.address);
        await changer.setTokenChanger('0x0');
        let newChanger = await token.changer.call();
        assert.equal(newChanger, utils.zeroAddress);
    });

    it('should throw when a non token owner attempts to set the changer', async () => {
        let token = await SmartToken.new('Token1', 'TKN1', 2);
        let changer = await CrowdsaleChanger.new(token.address, etherTokenAddress, startTime, beneficiaryAddress, btcsAddress, realEtherCapHash);
        await token.setChanger(changer.address);

        try {
            await changer.setTokenChanger(address1, { from: accounts[1] });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when the token owner attempts to set the token itself as the changer', async () => {
        let token = await SmartToken.new('Token1', 'TKN1', 2);
        let changer = await CrowdsaleChanger.new(token.address, etherTokenAddress, startTime, beneficiaryAddress, btcsAddress, realEtherCapHash);
        await token.setChanger(changer.address);

        try {
            await changer.setTokenChanger(token.address);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies that getReturn returns a valid amount', async () => {
        let changer = await initChanger(accounts, true);
        let returnAmount = await changer.getReturn.call(erc20TokenAddress, tokenAddress, 500);
        assert.isNumber(returnAmount.toNumber());
        assert.notEqual(returnAmount.toNumber(), 0);
    });

    it('verifies that getReturn returns the same amount as getPurchaseReturn when changing from a erc20 token to the token', async () => {
        let changer = await initChanger(accounts, true);
        let returnAmount = await changer.getReturn.call(erc20TokenAddress, tokenAddress, 500);
        let purchaseReturnAmount = await changer.getPurchaseReturn.call(erc20TokenAddress, 500);
        assert.equal(returnAmount.toNumber(), purchaseReturnAmount.toNumber());
    });

    it('verifies that getReturn returns the same amount as buyERC20', async () => {
        let changer = await initChanger(accounts, true);
        let returnAmount = await changer.getReturn.call(erc20TokenAddress, tokenAddress, 500);

        await erc20Token.approve(changer.address, 500);
        let purchaseRes = await changer.buyERC20(erc20TokenAddress, 500, 0);
        let purchaseAmount = getChangeAmount(purchaseRes);

        assert.equal(returnAmount, purchaseAmount);
    });

    it('verifies that getReturn returns the same amount as buyETH', async () => {
        let changer = await initChanger(accounts, true);
        let returnAmount = await changer.getReturn.call(etherTokenAddress, tokenAddress, 500);

        let purchaseRes = await changer.buyETH({ value: 500 });
        let purchaseAmount = getChangeAmount(purchaseRes);

        assert.equal(returnAmount, purchaseAmount);
    });

    it('verifies that getReturn returns the same amount as buyBTCs', async () => {
        let token = await SmartToken.new('Token1', 'TKN1', 2);
        let changer = await CrowdsaleChanger.new(token.address, etherTokenAddress, startTime, beneficiaryAddress, btcsAddress, realEtherCapHash);
        await token.setChanger(changer.address);

        let returnAmount = await changer.getReturn.call(etherTokenAddress, token.address, 500);

        let purchaseRes = await changer.buyBTCs(accounts[1], { value: 500, from: btcsAddress });
        let purchaseAmount = getChangeAmount(purchaseRes);

        assert.equal(returnAmount, purchaseAmount);
    });

    it('should throw when attempting to get the return with an invalid from token adress', async () => {
        let changer = await initChanger(accounts, true);

        try {
            await changer.getReturn.call('0x0', erc20TokenAddress2, 500);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to get the return with an invalid to token address', async () => {
        let changer = await initChanger(accounts, true);

        try {
            await changer.getReturn.call(erc20TokenAddress, '0x0', 500);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to get the return with identical from/to addresses', async () => {
        let changer = await initChanger(accounts, true);

        try {
            await changer.getReturn.call(erc20TokenAddress, erc20TokenAddress, 500);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to get the purchase return while the changer is not active', async () => {
        let changer = await initChanger(accounts, false);

        try {
            await changer.getPurchaseReturn.call(erc20TokenAddress, 500);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to get the purchase return with a non erc20 token address', async () => {
        let changer = await initChanger(accounts, true);

        try {
            await changer.getPurchaseReturn.call(tokenAddress, 500);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to get the purchase return with an invalid deposit amount', async () => {
        let changer = await initChanger(accounts, true);

        try {
            await changer.getPurchaseReturn.call(erc20TokenAddress, 0);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to get the purchase return while purchasing with the erc20 token is disabled', async () => {
        let changer = await initChanger(accounts, true);
        await changer.disableERC20Token(erc20TokenAddress, true);

        try {
            await changer.getPurchaseReturn.call(erc20TokenAddress, 500);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies that change returns a valid amount', async () => {
        let changer = await initChanger(accounts, true);
        await erc20Token.approve(changer.address, 500);
        let res = await changer.change(erc20TokenAddress, tokenAddress, 500, 0);
        let changeAmount = getChangeAmount(res);
        assert.isNumber(changeAmount);
        assert.notEqual(changeAmount, 0);
    });

    it('verifies that change returns the same amount as buyERC20 when changing from an erc20 to the token', async () => {
        let changer = await initChanger(accounts, true);
        await erc20Token.approve(changer.address, 500);
        let changeRes = await changer.change(erc20TokenAddress, tokenAddress, 500, 0);
        let changeAmount = getChangeAmount(changeRes);
        assert.isNumber(changeAmount);
        assert.notEqual(changeAmount, 0);

        changer = await initChanger(accounts, true);
        await erc20Token.approve(changer.address, 500);
        let purchaseRes = await changer.buyERC20(erc20TokenAddress, 500, 0);
        let purchaseAmount = getChangeAmount(purchaseRes);
        assert.equal(changeAmount, purchaseAmount);
    });

    it('should throw when attempting to change with an invalid from token adress', async () => {
        let changer = await initChanger(accounts, true);
        await erc20Token.approve(changer.address, 500);

        try {
            await changer.change('0x0', erc20TokenAddress2, 500, 0);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to change with an invalid to token address', async () => {
        let changer = await initChanger(accounts, true);
        await erc20Token.approve(changer.address, 500);

        try {
            await changer.change(erc20TokenAddress, '0x0', 500, 0);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to change with identical from/to addresses', async () => {
        let changer = await initChanger(accounts, true);
        await erc20Token.approve(changer.address, 500);

        try {
            await changer.change(erc20TokenAddress, erc20TokenAddress, 500, 0);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to change when the return is smaller than the minimum requested amount', async () => {
        let changer = await initChanger(accounts, true);
        await erc20Token.approve(changer.address, 500);

        try {
            await changer.change(erc20TokenAddress, tokenAddress, 500, 200000);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies balances, contributions and total eth contributed after buying with an erc20 token', async () => {
        let changer = await initChanger(accounts, true);
        await erc20Token.transfer(accounts[1], 9000);
        await erc20Token.approve(changer.address, 500, { from: accounts[1] });

        let res = await changer.buyERC20(erc20TokenAddress, 400, 0, { from: accounts[1] });
        let purchaseAmount = getChangeAmount(res);
        assert.isNumber(purchaseAmount);
        assert.notEqual(purchaseAmount, 0);

        let contributorTokenBalance = await token.balanceOf.call(accounts[1]);
        assert.equal(contributorTokenBalance, purchaseAmount);

        let beneficiaryTokenBalance = await token.balanceOf.call(beneficiaryAddress);
        assert.equal(beneficiaryTokenBalance, purchaseAmount);

        let beneficiaryERC20Balance = await erc20Token.balanceOf.call(beneficiaryAddress);
        assert.equal(beneficiaryERC20Balance, 400);

        let erc20Contribution = await changer.contributions.call(erc20TokenAddress);
        assert.equal(erc20Contribution, 400);

        let contributionEtherValue = Math.floor(400 * 2 / 5);
        let totalEtherContributed = await changer.totalEtherContributed.call();
        assert.equal(totalEtherContributed, contributionEtherValue);
    });

    it('should throw when attempting to buy with an erc20 token while the changer is not active', async () => {
        let changer = await initChanger(accounts, false);
        await erc20Token.approve(changer.address, 500);

        try {
            await changer.buyERC20(erc20TokenAddress, 500, 0);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to buy with an erc20 token with a non erc20 token address', async () => {
        let changer = await initChanger(accounts, true);
        await erc20Token.approve(changer.address, 500);

        try {
            await changer.buyERC20(tokenAddress, 500, 0);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to buy with an erc20 token and an invalid deposit amount', async () => {
        let changer = await initChanger(accounts, true);
        await erc20Token.approve(changer.address, 500);

        try {
            await changer.buyERC20(erc20TokenAddress, 0, 0);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to buy with an erc20 token when the return is smaller than the minimum requested amount', async () => {
        let changer = await initChanger(accounts, true);
        await erc20Token.approve(changer.address, 500);

        try {
            await changer.buyERC20(erc20TokenAddress, 500, 200000);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to buy with an erc20 token while the erc20 token is disabled', async () => {
        let changer = await initChanger(accounts, true);
        await erc20Token.approve(changer.address, 500);
        await changer.disableERC20Token(erc20TokenAddress, true);

        try {
            await changer.buyERC20(erc20TokenAddress, 500, 0);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to buy with an erc20 token without first approving the change to transfer from the buyer account in the erc20 token contract', async () => {
        let changer = await initChanger(accounts, true);

        try {
            await changer.buyERC20(erc20TokenAddress, 500, 0);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to buy with an erc20 token before the crowdsale has started', async () => {
        let token = await SmartToken.new('Token1', 'TKN1', 2);
        let changer = await CrowdsaleChanger.new(token.address, etherTokenAddress, startTime, beneficiaryAddress, btcsAddress, realEtherCapHash);
        await changer.addERC20Token(erc20TokenAddress, 2, 5);
        await erc20Token.approve(changer.address, 500);
        await token.setChanger(changer.address);

        try {
            await changer.buyERC20(erc20TokenAddress, 500, 0);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to buy with an erc20 token after the crowdsale has finished', async () => {
        let token = await SmartToken.new('Token1', 'TKN1', 2);
        let changer = await TestCrowdsaleChanger.new(token.address, etherTokenAddress, startTime, beneficiaryAddress, btcsAddress, realEtherCapHash, startTimeFinished);
        await changer.addERC20Token(erc20TokenAddress, 2, 5);
        await erc20Token.approve(changer.address, 500);
        await token.setChanger(changer.address);

        try {
            await changer.buyERC20(erc20TokenAddress, 500, 0);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to buy with an erc20 token while hitting the real ether cap', async () => {
        let changer = await initChanger(accounts, true);
        await changer.enableRealCap(realCap, realCapKey);
        await etherToken.deposit({ value: 2000 });
        await etherToken.approve(changer.address, 1500);

        try {
            await changer.buyERC20(etherTokenAddress, realCap + 1, 0);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies balances, contributions and total eth contributed after buying with ether', async () => {
        let changer = await initChanger(accounts, true);

        let res = await changer.buyETH({ value: 200, from: accounts[1] });
        let purchaseAmount = getChangeAmount(res);
        assert.isNumber(purchaseAmount);
        assert.notEqual(purchaseAmount, 0);

        let contributorTokenBalance = await token.balanceOf.call(accounts[1]);
        assert.equal(contributorTokenBalance, purchaseAmount);

        let beneficiaryTokenBalance = await token.balanceOf.call(beneficiaryAddress);
        assert.equal(beneficiaryTokenBalance, purchaseAmount);

        let beneficiaryEtherBalance = await etherToken.balanceOf.call(beneficiaryAddress);
        assert.equal(beneficiaryEtherBalance, 200);

        let etherContribution = await changer.contributions.call(etherTokenAddress);
        assert.equal(etherContribution, 200);

        let totalEtherContributed = await changer.totalEtherContributed.call();
        assert.equal(totalEtherContributed, 200);
    });

    it('should throw when attempting to buy with ether while the changer is not active', async () => {
        let changer = await initChanger(accounts, false);

        try {
            await changer.buyETH({ value: 2000 });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to buy with ether and an invalid deposit amount', async () => {
        let changer = await initChanger(accounts, true);

        try {
            await changer.buyETH({ value: 0 });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to buy with ether while the ether token is disabled', async () => {
        let changer = await initChanger(accounts, true);
        await changer.disableERC20Token(etherTokenAddress, true);

        try {
            await changer.buyETH({ value: 2000 });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to buy with ether before the crowdsale has started', async () => {
        let changer = await initChanger(accounts, true, startTime);

        try {
            await changer.buyETH({ value: 2000 });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to buy with ether after the crowdsale has finished', async () => {
        let changer = await initChanger(accounts, true, startTimeFinished);

        try {
            await changer.buyETH({ value: 2000 });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to buy with ether while hitting the real ether cap', async () => {
        let changer = await initChanger(accounts, true);
        await changer.enableRealCap(realCap, realCapKey);

        try {
            await changer.buyETH({ value: realCap + 1 });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies balances, contributions and total eth contributed after buying through btcs', async () => {
        let changer = await initChanger(accounts, true, startTime);

        let res = await changer.buyBTCs(accounts[1], { value: 200, from: btcsAddress });
        let purchaseAmount = getChangeAmount(res);
        assert.isNumber(purchaseAmount);
        assert.notEqual(purchaseAmount, 0);

        let contributorTokenBalance = await token.balanceOf.call(accounts[1]);
        assert.equal(contributorTokenBalance, purchaseAmount);

        let beneficiaryTokenBalance = await token.balanceOf.call(beneficiaryAddress);
        assert.equal(beneficiaryTokenBalance, purchaseAmount);

        let beneficiaryEtherBalance = await etherToken.balanceOf.call(beneficiaryAddress);
        assert.equal(beneficiaryEtherBalance, 200);

        let etherContribution = await changer.contributions.call(etherTokenAddress);
        assert.equal(etherContribution, 200);

        let totalEtherContributed = await changer.totalEtherContributed.call();
        assert.equal(totalEtherContributed, 200);
    });

    it('should throw when attempting to buy through btcs from a non btcs address', async () => {
        let changer = await initChanger(accounts, true, startTime);

        try {
            await changer.buyBTCs(accounts[1], { value: 2000 });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to buy through btcs while the changer is not active', async () => {
        let changer = await initChanger(accounts, false, startTime);

        try {
            await changer.buyBTCs(accounts[1], { value: 2000, from: btcsAddress });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to buy through btcs and an invalid deposit amount', async () => {
        let changer = await initChanger(accounts, true, startTime);

        try {
            await changer.buyBTCs(accounts[1], { value: 0, from: btcsAddress });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to buy through btcs while the ether token is disabled', async () => {
        let changer = await initChanger(accounts, true, startTime);
        await changer.disableERC20Token(etherTokenAddress, true);

        try {
            await changer.buyBTCs(accounts[1], { value: 2000, from: btcsAddress });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to buy through btcs after the crowdsale has started', async () => {
        let changer = await initChanger(accounts, true);

        try {
            await changer.buyBTCs(accounts[1], { value: 2000, from: btcsAddress });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to buy through btcs after the crowdsale has finished', async () => {
        let changer = await initChanger(accounts, true, startTimeFinished);

        try {
            await changer.buyBTCs(accounts[1], { value: 2000, from: btcsAddress });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to buy through btcs while hitting the btcs ether cap', async () => {
        let changer = await initChanger(accounts, true, startTime);
        let btcsEtherCap = await changer.BTCS_ETHER_CAP.call();
        let largerThanCap = btcsEtherCap.plus(1);

        try {
            await changer.buyBTCs(accounts[1], { value: largerThanCap.toString(), from: btcsAddress });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });
});

