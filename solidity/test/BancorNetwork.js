/* global artifacts, contract, before, it, assert, web3 */
/* eslint-disable prefer-reflect */

const utils = require('./helpers/Utils');
const ContractRegistryClient = require('./helpers/ContractRegistryClient');

const Whitelist = artifacts.require('Whitelist');
const BancorNetwork = artifacts.require('BancorNetwork');
const BancorConverter = artifacts.require('BancorConverter');
const SmartToken = artifacts.require('SmartToken');
const BancorFormula = artifacts.require('BancorFormula');
const ContractRegistry = artifacts.require('ContractRegistry');
const ContractFeatures = artifacts.require('ContractFeatures');
const EtherToken = artifacts.require('EtherToken');
const ERC20Token = artifacts.require('ERC20Token');
const TestNonStandardERC20Token = artifacts.require('TestNonStandardERC20Token');
const BancorConverterHelper = require('./helpers/BancorConverter');

const ETH_RESERVE = '0x'.padEnd(42, 'e');

const OLD_CONVERTER_VERSION = 9;

let bnt;
let erc20Token1;
let erc20Token2;
let smartToken1;
let smartToken2;
let smartToken3;
let smartToken4;
let converter1;
let converter2;
let converter3;
let converter4;
let bancorNetwork;
let contractRegistry;
let pathsTokens;
let paths;

/*
Token network structure:

      SmartToken1  SmartToken2
        /     \     /     \
      ETH       BNT    ERC20Token1


      SmartToken3  SmartToken4
        /       \     /
   ERC20Token2    BNT

*/

function initPaths(tokens, generatePaths) {
    let bnt         = tokens[0];
    let erc20Token1 = tokens[1];
    let erc20Token2 = tokens[2];
    let smartToken1 = tokens[3];
    let smartToken2 = tokens[4];
    let smartToken3 = tokens[5];
    let smartToken4 = tokens[6];

    pathsTokens = {
        'ETH': {
            'BNT':      ['', smartToken1, bnt],
            'ERC1':     ['', smartToken1, bnt, smartToken2, erc20Token1],
            'SMART1':   ['', smartToken1, smartToken1],
            'SMART2':   ['', smartToken1, bnt, smartToken2, smartToken2],
            'SMART4':   ['', smartToken1, bnt, smartToken4, smartToken4]
        },
        'BNT': {
            'ETH':      [bnt, smartToken1, ''],
            'ERC1':     [bnt, smartToken2, erc20Token1],
            'SMART3':   [bnt, smartToken3, smartToken3],
            'SMART4':   [bnt, smartToken4, smartToken4]
        },
        'ERC1': {
            'ETH':      [erc20Token1, smartToken2, bnt, smartToken1, ''],
            'BNT':      [erc20Token1, smartToken2, bnt],
            'ERC2':     [erc20Token1, smartToken2, bnt, smartToken3, erc20Token2],
            'SMART2':   [erc20Token1, smartToken2, smartToken2],
            'SMART4':   [erc20Token1, smartToken2, bnt, smartToken4, smartToken4]
        },
        'ERC2': {
            'ETH':      [erc20Token2, smartToken3, bnt, smartToken1, ''],
            'BNT':      [erc20Token2, smartToken3, bnt],
            'ERC1':     [erc20Token2, smartToken3, bnt, smartToken2, erc20Token1],
            'SMART2':   [erc20Token2, smartToken3, bnt, smartToken2, smartToken2],
            'SMART3':   [erc20Token2, smartToken3, smartToken3]
        },
        'SMART1': {
            'ETH':      [smartToken1, smartToken1, ''],
            'BNT':      [smartToken1, smartToken1, bnt],
            'ERC1':     [smartToken1, smartToken1, bnt, smartToken2, erc20Token1],
            'ERC2':     [smartToken1, smartToken1, bnt, smartToken3, erc20Token2],
            'SMART3':   [smartToken1, smartToken1, bnt, smartToken3, smartToken3]
        },
        'SMART2': {
            'ETH':      [smartToken2, smartToken2, bnt, smartToken1, ''],
            'BNT':      [smartToken2, smartToken2, bnt],
            'ERC1':     [smartToken2, smartToken2, bnt, smartToken2, erc20Token1],
            'ERC2':     [smartToken2, smartToken2, bnt, smartToken3, erc20Token2],
            'SMART4':   [smartToken2, smartToken2, bnt, smartToken4, smartToken4]
        },
        'SMART4': {
            'ETH':      [smartToken4, smartToken4, bnt, smartToken1, ''],
            'BNT':      [smartToken4, smartToken4, bnt],
            'ERC1':     [smartToken4, smartToken4, bnt, smartToken2, erc20Token1],
            'ERC2':     [smartToken4, smartToken4, bnt, smartToken3, erc20Token2],
            'SMART3':   [smartToken4, smartToken4, bnt, smartToken3, smartToken3]
        },
    };

    if (tokens.length <= 0)
        return;

    paths = {};
    for (let sourceSymbol in pathsTokens) {
        paths[sourceSymbol] = {};

        for (let targetSymbol in pathsTokens[sourceSymbol]) {
            paths[sourceSymbol][targetSymbol] = [];
            path = paths[sourceSymbol][targetSymbol];

            let pathTokens = pathsTokens[sourceSymbol][targetSymbol];
            for (let i = 0; i < pathTokens.length; i++) {
                if (pathTokens[i] == '')
                    path[i] = ETH_RESERVE;
                else
                    path[i] = pathTokens[i]['address'];
            }
        }
    }
};

async function initTokensAndConverters(accounts) {
    contractRegistry = await ContractRegistry.new();
    
    let contractFeatures = await ContractFeatures.new();
    await contractRegistry.registerAddress(ContractRegistryClient.CONTRACT_FEATURES, contractFeatures.address);

    let bancorFormula = await BancorFormula.new();
    await contractRegistry.registerAddress(ContractRegistryClient.BANCOR_FORMULA, bancorFormula.address);

    bancorNetwork = await BancorNetwork.new(contractRegistry.address);
    await contractRegistry.registerAddress(ContractRegistryClient.BANCOR_NETWORK, bancorNetwork.address);

    bnt = await ERC20Token.new('BNT', 'BNT', 2, 10000000);
    erc20Token1 = await ERC20Token.new('ERC20Token', 'ERC1', 2, 1000000);
    erc20Token2 = await TestNonStandardERC20Token.new('ERC20Token', 'ERC2', 2, 2000000);

    smartToken1 = await SmartToken.new('Smart1', 'SMART1', 2);
    await smartToken1.issue(accounts[0], 1000000);

    smartToken2 = await SmartToken.new('Smart2', 'SMART2', 2);
    await smartToken2.issue(accounts[0], 2000000);

    smartToken3 = await SmartToken.new('Smart3', 'SMART3', 2);
    await smartToken3.issue(accounts[0], 3000000);

    smartToken4 = await SmartToken.new('Smart4', 'SMART4', 2);
    await smartToken4.issue(accounts[0], 2500000);

    await contractRegistry.registerAddress(ContractRegistryClient.BNT_TOKEN, bnt.address);

    converter1 = await BancorConverter.new(smartToken1.address, contractRegistry.address, 0, bnt.address, 500000);
    await converter1.addReserve(ETH_RESERVE, 500000);

    converter2 = await BancorConverter.new(smartToken2.address, contractRegistry.address, 0, bnt.address, 300000);
    await converter2.addReserve(erc20Token1.address, 150000);

    converter3 = await BancorConverter.new(smartToken3.address, contractRegistry.address, 0, bnt.address, 350000);
    await converter3.addReserve(erc20Token2.address, 100000);

    converter4 = await BancorConverterHelper.new(smartToken4.address, contractRegistry.address, 0, bnt.address, 220000, OLD_CONVERTER_VERSION);

    await bnt.transfer(converter1.address, 40000);
    await bnt.transfer(converter2.address, 70000);
    await bnt.transfer(converter3.address, 110000);
    await bnt.transfer(converter4.address, 130000);

    await web3.eth.sendTransaction({from: accounts[0], to: converter1.address, value: 50000});
    await erc20Token1.transfer(converter2.address, 25000);
    await erc20Token2.transfer(converter3.address, 30000);

    await smartToken1.transferOwnership(converter1.address);
    await converter1.acceptTokenOwnership();

    await smartToken2.transferOwnership(converter2.address);
    await converter2.acceptTokenOwnership();

    await smartToken3.transferOwnership(converter3.address);
    await converter3.acceptTokenOwnership();

    await smartToken4.transferOwnership(converter4.address);
    await converter4.acceptTokenOwnership();

    initPaths([bnt, erc20Token1, erc20Token2, smartToken1, smartToken2, smartToken3, smartToken4]);
};

async function getBalance(token, symbol, account) {
    if (symbol == 'ETH')
        return await web3.eth.getBalance(account);
    else
        return await token.balanceOf.call(account);
}

async function getTransactionCost(txResult) {
    let transaction = await web3.eth.getTransaction(txResult.tx);
    return transaction.gasPrice.times(txResult.receipt.cumulativeGasUsed);
}

initPaths([]);

contract('BancorNetwork', accounts => {
    describe('Settings', () => {
        before(async () => {
            contractRegistry = await ContractRegistry.new();
            bancorNetwork = await BancorNetwork.new(contractRegistry.address);
        });

        it('verifies valid ether token registration', async () => {
            let etherToken = await EtherToken.new('Token0', 'TKN0');
            await etherToken.deposit({ value: 10000000 });
            let bancorNetwork1 = await BancorNetwork.new(contractRegistry.address);
            await bancorNetwork1.registerEtherToken(etherToken.address, true);
            let validEtherToken = await bancorNetwork1.etherTokens.call(etherToken.address);
            assert.isTrue(validEtherToken, 'registered etherToken address verification');
        });

        it('should throw when attempting register ether token with invalid address', async () => {
            let bancorNetwork1 = await BancorNetwork.new(contractRegistry.address);
            await utils.catchRevert(bancorNetwork1.registerEtherToken(utils.zeroAddress, true));
        });

        it('should throw when non owner attempting register ether token', async () => {
            let etherToken = await EtherToken.new('Token0', 'TKN0');
            await etherToken.deposit({ value: 10000000 });
            let bancorNetwork1 = await BancorNetwork.new(contractRegistry.address);
            await utils.catchRevert(bancorNetwork1.registerEtherToken(etherToken.address, true, { from: accounts[1] }));
        });

        it('verifies valid ether token unregistration', async () => {
            let etherToken = await EtherToken.new('Token0', 'TKN0');
            await etherToken.deposit({ value: 10000000 });
            let bancorNetwork1 = await BancorNetwork.new(contractRegistry.address);
            await bancorNetwork1.registerEtherToken(etherToken.address, true);
            let validEtherToken = await bancorNetwork1.etherTokens.call(etherToken.address);
            assert.isTrue(validEtherToken, 'registered etherToken address verification');
            await bancorNetwork1.registerEtherToken(etherToken.address, false);
            let validEtherToken2 = await bancorNetwork1.etherTokens.call(etherToken.address);
            assert.isNotTrue(validEtherToken2, 'unregistered etherToken address verification');
        });

        it('should throw when non owner attempting to unregister ether token', async () => {
            let etherToken = await EtherToken.new('Token0', 'TKN0');
            await etherToken.deposit({ value: 10000000 });
            let bancorNetwork1 = await BancorNetwork.new(contractRegistry.address);
            await bancorNetwork1.registerEtherToken(etherToken.address, true);
            let validEtherToken = await bancorNetwork1.etherTokens.call(etherToken.address);
            assert.isTrue(validEtherToken, 'registered etherToken address verification');
            await utils.catchRevert(bancorNetwork1.registerEtherToken(etherToken.address, false, { from: accounts[1] }));
        });

        it('verifies that setMaxAffiliateFee can set the maximum affiliate-fee', async () => {
            let oldMaxAffiliateFee = await bancorNetwork.maxAffiliateFee.call();
            await bancorNetwork.setMaxAffiliateFee(oldMaxAffiliateFee.plus(1));
            let newMaxAffiliateFee = await bancorNetwork.maxAffiliateFee.call();
            await bancorNetwork.setMaxAffiliateFee(oldMaxAffiliateFee);
            assert.equal(newMaxAffiliateFee.toString(), oldMaxAffiliateFee.plus(1));
        });

        it('should throw when calling setMaxAffiliateFee with a non-owner or an illegal value', async () => {
            await utils.catchRevert(bancorNetwork.setMaxAffiliateFee("1000000", { from: accounts[1] }));
            await utils.catchRevert(bancorNetwork.setMaxAffiliateFee("1000001", { from: accounts[0] }));
        });
    });

    /*
    TODO: should move to converter tests
    it('verifies that sending ether to the converter fails if it has no ETH reserve', async () => {
        await utils.catchRevert(converter2.send(100));
    });
    */

    describe('Conversions', () => {
        before(async () => {
            await initTokensAndConverters(accounts);
        });

        it('verifies that isV28OrHigherConverter returns true', async () => {
            assert.isTrue(await bancorNetwork.isV28OrHigherConverter.call(converter1.address));
        });

        for (let sourceSymbol in pathsTokens) {
            for (let targetSymbol in pathsTokens[sourceSymbol]) {
                it(`verifies that converting from ${sourceSymbol} to ${targetSymbol} succeeds`, async () => {
                    let pathTokens = pathsTokens[sourceSymbol][targetSymbol];
                    let sourceToken = pathTokens[0];
                    let targetToken = pathTokens[pathTokens.length - 1];
                    let value = 0;
                    if (sourceSymbol == 'ETH')
                        value = 1000;
                    else
                        await sourceToken.approve(bancorNetwork.address, 1000);

                    let prevBalance = await getBalance(targetToken, targetSymbol, accounts[0]);
                    let res = await bancorNetwork.convert(paths[sourceSymbol][targetSymbol], 1000, 1, { value });
                    let postBalance = await getBalance(targetToken, targetSymbol, accounts[0]);

                    let transactionCost = 0;
                    if (targetSymbol == 'ETH')
                        transactionCost = await getTransactionCost(res);

                    assert(postBalance.greaterThan(prevBalance.minus(transactionCost)), "new balance isn't higher than previous balance");
                });
            }
        }

        for (let sourceSymbol in pathsTokens) {
            for (let targetSymbol in pathsTokens[sourceSymbol]) {
                it(`verifies that converting from ${sourceSymbol} to ${targetSymbol} returns the same amount returned by getReturnByPath`, async () => {
                    let pathTokens = pathsTokens[sourceSymbol][targetSymbol];
                    let sourceToken = pathTokens[0];
                    let targetToken = pathTokens[pathTokens.length - 1];
                    let value = 0;
                    if (sourceSymbol == 'ETH')
                        value = 1000;
                    else
                        await sourceToken.approve(bancorNetwork.address, 1000);

                    let expectedReturn = (await bancorNetwork.getReturnByPath(paths[sourceSymbol][targetSymbol], 1000))[0];
                    let prevBalance = await getBalance(targetToken, targetSymbol, accounts[0]);
                    let res = await bancorNetwork.convert(paths[sourceSymbol][targetSymbol], 1000, 1, { value });
                    let postBalance = await getBalance(targetToken, targetSymbol, accounts[0]);

                    let transactionCost = 0;
                    if (targetSymbol == 'ETH')
                        transactionCost = await getTransactionCost(res);

                    assert(expectedReturn.equals(postBalance.minus(prevBalance.minus(transactionCost))), "expected return differs from actual return");
                });
            }
        }

        it('verifies that quick buy with minimum return equal to the full expected return amount results in the exact increase in balance for the buyer', async () => {
            let prevBalance = await smartToken2.balanceOf.call(accounts[0]);
            let path = paths['ETH']['SMART2'];

            let token2Return = (await bancorNetwork.getReturnByPath(path, 100000))[0];

            await converter2.quickConvert(path, 100000, token2Return, { value: 100000 });
            let newBalance = await smartToken2.balanceOf.call(accounts[0]);

            assert.equal(token2Return.toNumber(), newBalance.toNumber() - prevBalance.toNumber(), "new balance isn't equal to the expected purchase return");
        });

        it('should throw when attempting to quick buy and the return amount is lower than the given minimum', async () => {
            let path = paths['ETH']['SMART2'];
            await utils.catchRevert(converter2.quickConvert(path, 100, 1000000, { from: accounts[1], value: 100 }));
        });

        it('should throw when attempting to quick buy and passing an amount higher than the ETH amount sent with the request', async () => {
            let path = paths['ETH']['SMART2'];
            await utils.catchRevert(converter2.quickConvert(path, 100001, 1, { from: accounts[1], value: 100000 }));
        });

        it('verifies the caller balances after selling directly for ether with a single converter', async () => {
            let prevETHBalance = web3.eth.getBalance(accounts[0]);
            let prevTokenBalance = await smartToken1.balanceOf.call(accounts[0]);

            let path = paths['SMART1']['ETH'];
            let res = await converter1.quickConvert(path, 10000, 1);
            let newETHBalance = web3.eth.getBalance(accounts[0]);
            let newTokenBalance = await smartToken1.balanceOf.call(accounts[0]);

            let transaction = web3.eth.getTransaction(res.tx);
            let transactionCost = transaction.gasPrice.times(res.receipt.cumulativeGasUsed);
            assert(newETHBalance.greaterThan(prevETHBalance.minus(transactionCost)), "new ETH balance isn't higher than previous balance");
            assert(newTokenBalance.lessThan(prevTokenBalance), "new token balance isn't lower than previous balance");
        });

        it('verifies the caller balances after selling directly for ether with multiple converters', async () => {
            let prevETHBalance = web3.eth.getBalance(accounts[0]);
            let prevTokenBalance = await smartToken2.balanceOf.call(accounts[0]);

            let path = paths['SMART2']['ETH'];
            let res = await converter2.quickConvert(path, 10000, 1);
            let newETHBalance = web3.eth.getBalance(accounts[0]);
            let newTokenBalance = await smartToken2.balanceOf.call(accounts[0]);

            let transaction = web3.eth.getTransaction(res.tx);
            let transactionCost = transaction.gasPrice.times(res.receipt.cumulativeGasUsed);
            assert(newETHBalance.greaterThan(prevETHBalance.minus(transactionCost)), "new ETH balance isn't higher than previous balance");
            assert(newTokenBalance.lessThan(prevTokenBalance), "new token balance isn't lower than previous balance");
        });

        it('should throw when attempting to sell directly for ether and the return amount is lower than the given minimum', async () => {
            let path = paths['ERC2']['ETH'];
            await utils.catchRevert(bancorNetwork.convert(path, 100, 2000000));
        });

        it('verifies the caller balances after converting from one token to another with multiple converters', async () => {
            let path = paths['SMART1']['SMART3'];

            let prevToken1Balance = await smartToken1.balanceOf.call(accounts[0]);
            let prevToken4Balance = await smartToken3.balanceOf.call(accounts[0]);

            await converter1.quickConvert(path, 1000, 1);
            let newToken1Balance = await smartToken1.balanceOf.call(accounts[0]);
            let newToken4Balance = await smartToken3.balanceOf.call(accounts[0]);

            assert(newToken4Balance.greaterThan(prevToken4Balance), "bought token balance isn't higher than previous balance");
            assert(newToken1Balance.lessThan(prevToken1Balance), "sold token balance isn't lower than previous balance");
        });

        it('verifies that convertFor transfers the converted amount correctly', async () => {
            let path = paths['ETH']['SMART1'];
            let balanceBeforeTransfer = await smartToken1.balanceOf.call(accounts[1]);
            await bancorNetwork.convertFor(path, 10000, 1, accounts[1], { value: 10000 });
            let balanceAfterTransfer = await smartToken1.balanceOf.call(accounts[1]);
            assert.isAbove(balanceAfterTransfer.toNumber(), balanceBeforeTransfer.toNumber(), 'amount transfered');
        });

        it('verifies that convert transfers the converted amount correctly', async () => {
            let path = paths['ETH']['SMART1'];
            let balanceBeforeTransfer = await smartToken1.balanceOf.call(accounts[1]);
            await bancorNetwork.convert(path, 10000, 1, { from: accounts[1], value: 10000 });
            let balanceAfterTransfer = await smartToken1.balanceOf.call(accounts[1]);
            assert.isAbove(balanceAfterTransfer.toNumber(), balanceBeforeTransfer.toNumber(), 'amount transfered');
        });

        it('verifies that convertFor returns a valid amount when buying the smart token', async () => {
            let path = paths['ETH']['SMART1'];
            let amount = await bancorNetwork.convertFor.call(path, 10000, 1, accounts[1], { value: 10000 });
            assert.isAbove(amount.toNumber(), 0, 'amount converted');
        });

        it('verifies that convert returns a valid amount when buying the smart token', async () => {
            let path = paths['ETH']['SMART1'];
            let amount = await bancorNetwork.convert.call(path, 10000, 1, { from: accounts[1], value: 10000 });
            assert.isAbove(amount.toNumber(), 0, 'amount converted');
        });

        it('should throw when calling convertFor with ether token but without sending ether', async () => {
            let path = paths['ETH']['SMART1'];
            await utils.catchRevert(bancorNetwork.convertFor(path, 10000, 1, accounts[1]));
        });

        it('should throw when calling convertFor with ether amount different than the amount sent', async () => {
            let path = paths['ETH']['SMART1'];
            await utils.catchRevert(bancorNetwork.convertFor.call(path, 20000, 1, accounts[1], { value: 10000 }));
        });

        it('should throw when calling convertFor with too-short path', async () => {
            let invalidPath = [ETH_RESERVE, smartToken1.address];
            await utils.catchRevert(bancorNetwork.convertFor(invalidPath, 10000, 1, accounts[1], { value: 10000 }));
        });

        it('should throw when calling convertFor with even-length path', async () => {
            let invalidPath = [ETH_RESERVE, smartToken1.address, smartToken2.address, smartToken3.address];
            await utils.catchRevert(bancorNetwork.convertFor(invalidPath, 10000, 1, accounts[1], { value: 10000 }));
        });

        it('should throw when calling convert with ether token but without sending ether', async () => {
            let path = paths['ETH']['SMART1'];
            await utils.catchRevert(bancorNetwork.convert(path, 10000, 1, { from: accounts[1] }));
        });

        it('should throw when calling convert with ether amount different than the amount sent', async () => {
            let path = paths['ETH']['SMART1'];
            await utils.catchRevert(bancorNetwork.convert.call(path, 20000, 1, { from: accounts[1], value: 10000 }));
        });

        it('should throw when calling convert with too-short path', async () => {
            let invalidPath = [ETH_RESERVE, smartToken1.address];
            await utils.catchRevert(bancorNetwork.convert(invalidPath, 10000, 1, { from: accounts[1], value: 10000 }));
        });

        it('should throw when calling convert with even-length path', async () => {
            let invalidPath = [ETH_RESERVE, smartToken1.address, smartToken2.address, smartToken3.address];
            await utils.catchRevert(bancorNetwork.convert(invalidPath, 10000, 1, { from: accounts[1], value: 10000 }));
        });

        it('verifies that claimAndConvertFor transfers the converted amount correctly when converter from a new converter to an old one', async () => {
            let path = paths['SMART2']['SMART4'];
            await smartToken2.approve(bancorNetwork.address, 10000);
            let balanceBeforeTransfer = await smartToken4.balanceOf.call(accounts[1]);
            await bancorNetwork.claimAndConvertFor(path, 10000, 1, accounts[1]);
            let balanceAfterTransfer = await smartToken4.balanceOf.call(accounts[1]);
            assert.isAbove(balanceAfterTransfer.toNumber(), balanceBeforeTransfer.toNumber(), 'amount transfered');
        });

        it('verifies that claimAndConvertFor transfers the converted amount correctly when converter from an old converter to a new one', async () => {
            let path = paths['SMART4']['SMART3'];
            await smartToken4.approve(bancorNetwork.address, 10000);
            let balanceBeforeTransfer = await smartToken3.balanceOf.call(accounts[1]);
            await bancorNetwork.claimAndConvertFor(path, 10000, 1, accounts[1]);
            let balanceAfterTransfer = await smartToken3.balanceOf.call(accounts[1]);
            assert.isAbove(balanceAfterTransfer.toNumber(), balanceBeforeTransfer.toNumber(), 'amount transfered');
        });

        it('should throw when calling claimAndConvertFor without approval', async () => {
            let path = paths['ERC1']['SMART4'];
            await utils.catchRevert(bancorNetwork.claimAndConvertFor(path, 10000, 1, accounts[1]));
        });

        it('verifies that claimAndConvert transfers the converted amount correctly', async () => {
            await smartToken1.approve(bancorNetwork.address, 10000);
            let balanceBeforeTransfer = await smartToken3.balanceOf.call(accounts[0]);
            let path = paths['SMART1']['SMART3'];
            await bancorNetwork.claimAndConvert(path, 10000, 1);
            let balanceAfterTransfer = await smartToken3.balanceOf.call(accounts[0]);
            assert.isAbove(balanceAfterTransfer.toNumber(), balanceBeforeTransfer.toNumber(), 'amount transfered');
        });

        it('should throw when calling claimAndConvert without approval', async () => {
            let path = paths['ERC1']['SMART4'];
            await utils.catchRevert(bancorNetwork.claimAndConvert(path, 10000, 1));
        });

        it('verifies that convertFor is allowed for a whitelisted account', async () => {
            let whitelist = await Whitelist.new();
            await whitelist.addAddress(accounts[1]);
            await converter1.setConversionWhitelist(whitelist.address);
            let path = paths['ETH']['SMART1'];

            let balanceBeforeTransfer = await smartToken1.balanceOf.call(accounts[1]);
            await bancorNetwork.convertFor(path, 10000, 1, accounts[1], { value: 10000 });
            let balanceAfterTransfer = await smartToken1.balanceOf.call(accounts[1]);
            assert.isAbove(balanceAfterTransfer.toNumber(), balanceBeforeTransfer.toNumber(), 'amount transfered');

            await converter1.setConversionWhitelist(utils.zeroAddress);
        });

        it('should throw when calling convertFor with a non whitelisted account', async () => {
            let whitelist = await Whitelist.new();
            await converter1.setConversionWhitelist(whitelist.address);
            let path = paths['ETH']['SMART1'];

            await utils.catchRevert(bancorNetwork.convertFor(path, 10000, 1, accounts[1], { value: 10000 }));
            await converter1.setConversionWhitelist(utils.zeroAddress);
        });

        it('verifies that convert is allowed for a whitelisted account', async () => {
            let whitelist = await Whitelist.new();
            await whitelist.addAddress(accounts[1]);
            await converter1.setConversionWhitelist(whitelist.address);
            let path = paths['ETH']['SMART1'];

            let balanceBeforeTransfer = await smartToken1.balanceOf.call(accounts[1]);
            await bancorNetwork.convert(path, 10000, 1, { from: accounts[1], value: 10000 });
            let balanceAfterTransfer = await smartToken1.balanceOf.call(accounts[1]);
            assert.isAbove(balanceAfterTransfer.toNumber(), balanceBeforeTransfer.toNumber(), 'amount transfered');

            await converter1.setConversionWhitelist(utils.zeroAddress);
        });

        it('should throw when calling convert with a non whitelisted account', async () => {
            let whitelist = await Whitelist.new();
            await converter1.setConversionWhitelist(whitelist.address);
            let path = paths['ETH']['SMART1'];

            await utils.catchRevert(bancorNetwork.convert(path, 10000, 1, { from: accounts[1], value: 10000 }));
            await converter1.setConversionWhitelist(utils.zeroAddress);
        });

        it('should throw when attempting to call getReturnByPath on a path with fewer than 3 elements', async () => {
            let invalidPath = [ETH_RESERVE, smartToken1.address];
            await utils.catchRevert(bancorNetwork.getReturnByPath.call(invalidPath, 1000));
        });

        it('should throw when attempting to call getReturnByPath on a path with an even number of elements', async () => {
            let invalidPath = [ETH_RESERVE, smartToken1.address, smartToken2.address, smartToken3.address];
            await utils.catchRevert(bancorNetwork.getReturnByPath.call(invalidPath, 1000));
        });

        it('verifies that convertFor2 transfers the converted amount correctly', async () => {
            let balanceBeforeTransfer = await smartToken1.balanceOf.call(accounts[1]);
            let path = paths['ETH']['SMART1'];
            await bancorNetwork.convertFor2(path, 10000, 1, accounts[1], utils.zeroAddress, 0, { value: 10000 });
            let balanceAfterTransfer = await smartToken1.balanceOf.call(accounts[1]);
            assert.isAbove(balanceAfterTransfer.toNumber(), balanceBeforeTransfer.toNumber(), 'amount transfered');
        });

        it('verifies that convert2 transfers the converted amount correctly', async () => {
            let balanceBeforeTransfer = await smartToken1.balanceOf.call(accounts[1]);
            let path = paths['ETH']['SMART1'];
            await bancorNetwork.convert2(path, 10000, 1, utils.zeroAddress, 0, { from: accounts[1], value: 10000 });
            let balanceAfterTransfer = await smartToken1.balanceOf.call(accounts[1]);
            assert.isAbove(balanceAfterTransfer.toNumber(), balanceBeforeTransfer.toNumber(), 'amount transfered');
        });

        it('verifies that convertFor2 returns a valid amount when buying the smart token', async () => {
            let path = paths['ETH']['SMART1'];
            let amount = await bancorNetwork.convertFor2.call(path, 10000, 1, accounts[1], utils.zeroAddress, 0, { value: 10000 });
            assert.isAbove(amount.toNumber(), 0, 'amount converted');
        });

        it('verifies that convert2 returns a valid amount when buying the smart token', async () => {
            let path = paths['ETH']['SMART1'];
            let amount = await bancorNetwork.convert2.call(path, 10000, 1, utils.zeroAddress, 0, { from: accounts[1], value: 10000 });
            assert.isAbove(amount.toNumber(), 0, 'amount converted');
        });

        it('should throw when calling convertFor2 with ether token but without sending ether', async () => {
            let path = paths['ETH']['SMART1'];
            await utils.catchRevert(bancorNetwork.convertFor2(path, 10000, 1, accounts[1], utils.zeroAddress, 0));
        });

        it('should throw when calling convertFor2 with ether amount different than the amount sent', async () => {
            let path = paths['ETH']['SMART1'];
            await utils.catchRevert(bancorNetwork.convertFor2.call(path, 20000, 1, accounts[1], utils.zeroAddress, 0, { value: 10000 }));
        });

        it('should throw when calling convertFor2 with too-short path', async () => {
            let invalidPath = [ETH_RESERVE, smartToken1.address];
            await utils.catchRevert(bancorNetwork.convertFor2(invalidPath, 10000, 1, accounts[1], utils.zeroAddress, 0, { value: 10000 }));
        });

        it('should throw when calling convertFor2 with even-length path', async () => {
            let invalidPath = [ETH_RESERVE, smartToken1.address, smartToken2.address, smartToken3.address];
            await utils.catchRevert(bancorNetwork.convertFor2(invalidPath, 10000, 1, accounts[1], utils.zeroAddress, 0, { value: 10000 }));
        });

        it('should throw when calling convert2 with ether token but without sending ether', async () => {
            let path = paths['ETH']['SMART1'];
            await utils.catchRevert(bancorNetwork.convert2(path, 10000, 1, utils.zeroAddress, 0, { from: accounts[1] }));
        });

        it('should throw when calling convert2 with ether amount different than the amount sent', async () => {
            let path = paths['ETH']['SMART1'];
            await utils.catchRevert(bancorNetwork.convert2.call(path, 20000, 1, utils.zeroAddress, 0, { from: accounts[1], value: 10000 }));
        });

        it('should throw when calling convert2 with too-short path', async () => {
            let invalidPath = [ETH_RESERVE, smartToken1.address];
            await utils.catchRevert(bancorNetwork.convert2(invalidPath, 10000, 1, utils.zeroAddress, 0, { from: accounts[1], value: 10000 }));
        });

        it('should throw when calling convert2 with even-length path', async () => {
            let invalidPath = [ETH_RESERVE, smartToken1.address, smartToken2.address, smartToken3.address];
            await utils.catchRevert(bancorNetwork.convert2(invalidPath, 10000, 1, utils.zeroAddress, 0, { from: accounts[1], value: 10000 }));
        });

        it('verifies that claimAndConvertFor2 transfers the converted amount correctly', async () => {
            await smartToken1.approve(bancorNetwork.address, 10000);
            let balanceBeforeTransfer = await smartToken3.balanceOf.call(accounts[1]);
            let path = paths['SMART1']['SMART3'];
            await bancorNetwork.claimAndConvertFor2(path, 10000, 1, accounts[1], utils.zeroAddress, 0);
            let balanceAfterTransfer = await smartToken3.balanceOf.call(accounts[1]);
            assert.isAbove(balanceAfterTransfer.toNumber(), balanceBeforeTransfer.toNumber(), 'amount transfered');
        });

        it('should throw when calling claimAndConvertFor2 without approval', async () => {
            let path = paths['ERC1']['SMART4'];
            await utils.catchRevert(bancorNetwork.claimAndConvertFor2(path, 10000, 1, accounts[1], utils.zeroAddress, 0));
        });

        it('verifies that claimAndConvert2 transfers the converted amount correctly', async () => {
            await smartToken1.approve(bancorNetwork.address, 10000);
            let balanceBeforeTransfer = await smartToken3.balanceOf.call(accounts[0]);
            let path = paths['SMART1']['SMART3'];
            await bancorNetwork.claimAndConvert2(path, 10000, 1, utils.zeroAddress, 0);
            let balanceAfterTransfer = await smartToken3.balanceOf.call(accounts[0]);
            assert.isAbove(balanceAfterTransfer.toNumber(), balanceBeforeTransfer.toNumber(), 'amount transfered');
        });

        it('should throw when calling claimAndConvert2 without approval', async () => {
            let path = paths['ERC1']['SMART4'];
            await utils.catchRevert(bancorNetwork.claimAndConvert2(path, 10000, 1, utils.zeroAddress, 0));
        });

        it('verifies that convertFor2 is allowed for a whitelisted account', async () => {
            let whitelist = await Whitelist.new();
            await whitelist.addAddress(accounts[1]);
            await converter1.setConversionWhitelist(whitelist.address);

            let balanceBeforeTransfer = await smartToken1.balanceOf.call(accounts[1]);
            let path = paths['ETH']['SMART1'];
            await bancorNetwork.convertFor2(path, 10000, 1, accounts[1], utils.zeroAddress, 0, { value: 10000 });
            let balanceAfterTransfer = await smartToken1.balanceOf.call(accounts[1]);
            assert.isAbove(balanceAfterTransfer.toNumber(), balanceBeforeTransfer.toNumber(), 'amount transfered');

            await converter1.setConversionWhitelist(utils.zeroAddress);
        });

        it('should throw when calling convertFor2 with a non whitelisted account', async () => {
            let whitelist = await Whitelist.new();
            await converter1.setConversionWhitelist(whitelist.address);

            let path = paths['ETH']['SMART1'];
            await utils.catchRevert(bancorNetwork.convertFor2(path, 10000, 1, accounts[1], utils.zeroAddress, 0, { value: 10000 }));
            await converter1.setConversionWhitelist(utils.zeroAddress);
        });

        it('verifies that convert2 is allowed for a whitelisted account', async () => {
            let whitelist = await Whitelist.new();
            await whitelist.addAddress(accounts[1]);
            await converter1.setConversionWhitelist(whitelist.address);

            let balanceBeforeTransfer = await smartToken1.balanceOf.call(accounts[1]);
            let path = paths['ETH']['SMART1'];
            await bancorNetwork.convert2(path, 10000, 1, utils.zeroAddress, 0, { from: accounts[1], value: 10000 });
            let balanceAfterTransfer = await smartToken1.balanceOf.call(accounts[1]);
            assert.isAbove(balanceAfterTransfer.toNumber(), balanceBeforeTransfer.toNumber(), 'amount transfered');

            await converter1.setConversionWhitelist(utils.zeroAddress);
        });

        it('should throw when calling convert2 with a non whitelisted account', async () => {
            let whitelist = await Whitelist.new();
            await converter1.setConversionWhitelist(whitelist.address);

            let path = paths['ETH']['SMART1'];
            await utils.catchRevert(bancorNetwork.convert2(path, 10000, 1, utils.zeroAddress, 0, { from: accounts[1], value: 10000 }));
            await converter1.setConversionWhitelist(utils.zeroAddress);
        });

        it('verifies that quick buy with minimum return equal to the full expected return amount results in the exact increase in balance for the buyer', async () => {
            let path = paths['ETH']['SMART2'];
            let prevBalance = await smartToken2.balanceOf.call(accounts[0]);

            let token2Return = (await bancorNetwork.getReturnByPath(path, 100000))[0];

            await converter2.quickConvert2(path, 100000, token2Return, utils.zeroAddress, 0, { value: 100000 });
            let newBalance = await smartToken2.balanceOf.call(accounts[0]);

            assert.equal(token2Return.toNumber(), newBalance.toNumber() - prevBalance.toNumber(), "new balance isn't equal to the expected purchase return");
        });

        it('should throw when attempting to quick buy and the return amount is lower than the given minimum', async () => {
            let path = paths['ETH']['SMART2'];
            await utils.catchRevert(converter2.quickConvert2(path, 100, 1000000, utils.zeroAddress, 0, { from: accounts[1], value: 100 }));
        });

        it('should throw when attempting to quick buy and passing an amount higher than the ETH amount sent with the request', async () => {
            let path = paths['ETH']['SMART2'];
            await utils.catchRevert(converter2.quickConvert2(path, 100001, 1, utils.zeroAddress, 0, { from: accounts[1], value: 100000 }));
        });

        it('verifies the caller balances after selling directly for ether with a single converter', async () => {
            let prevETHBalance = web3.eth.getBalance(accounts[0]);
            let prevTokenBalance = await smartToken1.balanceOf.call(accounts[0]);

            let path = paths['SMART1']['ETH'];
            let res = await converter1.quickConvert2(path, 10000, 1, utils.zeroAddress, 0);
            let newETHBalance = web3.eth.getBalance(accounts[0]);
            let newTokenBalance = await smartToken1.balanceOf.call(accounts[0]);

            let transaction = web3.eth.getTransaction(res.tx);
            let transactionCost = transaction.gasPrice.times(res.receipt.cumulativeGasUsed);
            assert(newETHBalance.greaterThan(prevETHBalance.minus(transactionCost)), "new ETH balance isn't higher than previous balance");
            assert(newTokenBalance.lessThan(prevTokenBalance), "new token balance isn't lower than previous balance");
        });

        it('verifies the caller balances after selling directly for ether with multiple converters', async () => {
            let prevETHBalance = web3.eth.getBalance(accounts[0]);
            let prevTokenBalance = await smartToken2.balanceOf.call(accounts[0]);

            let path = paths['SMART2']['ETH'];
            let res = await converter2.quickConvert2(path, 10000, 1, utils.zeroAddress, 0);
            let newETHBalance = web3.eth.getBalance(accounts[0]);
            let newTokenBalance = await smartToken2.balanceOf.call(accounts[0]);

            let transaction = web3.eth.getTransaction(res.tx);
            let transactionCost = transaction.gasPrice.times(res.receipt.cumulativeGasUsed);
            assert(newETHBalance.greaterThan(prevETHBalance.minus(transactionCost)), "new ETH balance isn't higher than previous balance");
            assert(newTokenBalance.lessThan(prevTokenBalance), "new token balance isn't lower than previous balance");
        });

        it('should throw when attempting to sell directly for ether and the return amount is lower than the given minimum', async () => {
            let path = paths['ERC2']['ETH'];
            await utils.catchRevert(bancorNetwork.convert2(path, 100, 2000000, utils.zeroAddress, 0));
        });

        it('verifies the caller balances after converting from one token to another with multiple converters', async () => {
            let path = paths['SMART1']['SMART3'];

            let prevToken1Balance = await smartToken1.balanceOf.call(accounts[0]);
            let prevToken4Balance = await smartToken3.balanceOf.call(accounts[0]);

            await converter1.quickConvert2(path, 1000, 1, utils.zeroAddress, 0);
            let newToken1Balance = await smartToken1.balanceOf.call(accounts[0]);
            let newToken4Balance = await smartToken3.balanceOf.call(accounts[0]);

            assert(newToken4Balance.greaterThan(prevToken4Balance), "bought token balance isn't higher than previous balance");
            assert(newToken1Balance.lessThan(prevToken1Balance), "sold token balance isn't lower than previous balance");
        });

        it('verifies that convertFor2 transfers the affiliate fee correctly', async () => {
            let path = paths['ETH']['ERC1'];
            let balanceBeforeTransfer = await bnt.balanceOf.call(accounts[2]);
            await bancorNetwork.convertFor2(path, 10000, 1, accounts[1], accounts[2], 10000, { value: 10000 });
            let balanceAfterTransfer = await bnt.balanceOf.call(accounts[2]);
            assert.isAbove(balanceAfterTransfer.toNumber(), balanceBeforeTransfer.toNumber(), 'amount transfered');
        });

        it('verifies that convert2 transfers the affiliate fee correctly', async () => {
            let path = paths['ETH']['ERC1'];
            let balanceBeforeTransfer = await bnt.balanceOf.call(accounts[2]);
            await bancorNetwork.convert2(path, 10000, 1, accounts[2], 10000, { from: accounts[1], value: 10000 });
            let balanceAfterTransfer = await bnt.balanceOf.call(accounts[2]);
            assert.isAbove(balanceAfterTransfer.toNumber(), balanceBeforeTransfer.toNumber(), 'amount transfered');
        });

        it('verifies that claimAndConvert2 transfers the affiliate fee correctly', async () => {
            await erc20Token2.approve(bancorNetwork.address, 10000);
            let balanceBeforeTransfer = await bnt.balanceOf.call(accounts[2]);
            let path = paths['ERC2']['ETH'];
            await bancorNetwork.claimAndConvert2(path, 10000, 1, accounts[2], 10000);
            let balanceAfterTransfer = await bnt.balanceOf.call(accounts[2]);
            assert.isAbove(balanceAfterTransfer.toNumber(), balanceBeforeTransfer.toNumber(), 'amount transfered');
        });

        it('verifies that claimAndConvertFor2 transfers the affiliate fee correctly', async () => {
            await erc20Token2.approve(bancorNetwork.address, 10000);
            let balanceBeforeTransfer = await bnt.balanceOf.call(accounts[2]);
            let path = paths['ERC2']['ETH'];
            await bancorNetwork.claimAndConvertFor2(path, 10000, 1, accounts[1], accounts[2], 10000);
            let balanceAfterTransfer = await bnt.balanceOf.call(accounts[2]);
            assert.isAbove(balanceAfterTransfer.toNumber(), balanceBeforeTransfer.toNumber(), 'amount transfered');
        });
    });
});
