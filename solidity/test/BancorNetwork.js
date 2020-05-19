/* global artifacts, contract, before, it, assert, web3 */
/* eslint-disable prefer-reflect */

const utils = require('./helpers/Utils');
const ContractRegistryClient = require('./helpers/ContractRegistryClient');
const BancorNetwork = artifacts.require('BancorNetwork');
const LiquidTokenConverter = artifacts.require('LiquidTokenConverter');
const LiquidityPoolV1Converter = artifacts.require('LiquidityPoolV1Converter');
const SmartToken = artifacts.require('SmartToken');
const BancorFormula = artifacts.require('BancorFormula');
const ContractRegistry = artifacts.require('ContractRegistry');
const BancorConverterRegistry = artifacts.require('BancorConverterRegistry');
const BancorConverterRegistryData = artifacts.require('BancorConverterRegistryData');
const BancorNetworkPathFinder = artifacts.require('BancorNetworkPathFinder');
const EtherToken = artifacts.require('EtherToken');
const ERC20Token = artifacts.require('ERC20Token');
const TestNonStandardToken = artifacts.require('TestNonStandardToken');
const BancorConverterHelper = require('./helpers/BancorConverter');
const TestBancorNetwork = artifacts.require('./helpers/TestBancorNetwork');

const ETH_RESERVE_ADDRESS = '0x'.padEnd(42, 'e');

const OLD_CONVERTER_VERSION = 9;

let bntToken;
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
    let bntToken    = tokens[0];
    let erc20Token1 = tokens[1];
    let erc20Token2 = tokens[2];
    let smartToken1 = tokens[3];
    let smartToken2 = tokens[4];
    let smartToken3 = tokens[5];
    let smartToken4 = tokens[6];

    pathsTokens = {
        'ETH': {
            'BNT':      ['', smartToken1, bntToken],
            'ERC1':     ['', smartToken1, bntToken, smartToken2, erc20Token1],
            'ERC2':     ['', smartToken1, bntToken, smartToken3, erc20Token2],
            'SMART4':   ['', smartToken1, bntToken, smartToken4, smartToken4]
        },
        'BNT': {
            'ETH':      [bntToken, smartToken1, ''],
            'ERC1':     [bntToken, smartToken2, erc20Token1],
            'ERC2':     [bntToken, smartToken3, erc20Token2],
            'SMART4':   [bntToken, smartToken4, smartToken4]
        },
        'ERC1': {
            'ETH':      [erc20Token1, smartToken2, bntToken, smartToken1, ''],
            'BNT':      [erc20Token1, smartToken2, bntToken],
            'ERC2':     [erc20Token1, smartToken2, bntToken, smartToken3, erc20Token2],
            'SMART4':   [erc20Token1, smartToken2, bntToken, smartToken4, smartToken4]
        },
        'ERC2': {
            'ETH':      [erc20Token2, smartToken3, bntToken, smartToken1, ''],
            'BNT':      [erc20Token2, smartToken3, bntToken],
            'ERC1':     [erc20Token2, smartToken3, bntToken, smartToken2, erc20Token1],
            'SMART4':   [erc20Token2, smartToken3, bntToken, smartToken4, smartToken4]
        },
        'SMART4': {
            'ETH':      [smartToken4, smartToken4, bntToken, smartToken1, ''],
            'BNT':      [smartToken4, smartToken4, bntToken],
            'ERC1':     [smartToken4, smartToken4, bntToken, smartToken2, erc20Token1],
            'ERC2':     [smartToken4, smartToken4, bntToken, smartToken3, erc20Token2]
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
                    path[i] = ETH_RESERVE_ADDRESS;
                else
                    path[i] = pathTokens[i]['address'];
            }
        }
    }
};

async function initTokensAndConverters(accounts) {
    contractRegistry = await ContractRegistry.new();
    
    let bancorFormula = await BancorFormula.new();
    await contractRegistry.registerAddress(ContractRegistryClient.BANCOR_FORMULA, bancorFormula.address);

    bancorNetwork = await BancorNetwork.new(contractRegistry.address);
    await contractRegistry.registerAddress(ContractRegistryClient.BANCOR_NETWORK, bancorNetwork.address);

    let converterRegistry = await BancorConverterRegistry.new(contractRegistry.address);
    let converterRegistryData = await BancorConverterRegistryData.new(contractRegistry.address);
    await contractRegistry.registerAddress(ContractRegistryClient.BANCOR_CONVERTER_REGISTRY, converterRegistry.address);
    await contractRegistry.registerAddress(ContractRegistryClient.BANCOR_CONVERTER_REGISTRY_DATA, converterRegistryData.address);

    let pathFinder = await BancorNetworkPathFinder.new(contractRegistry.address);
    await contractRegistry.registerAddress(ContractRegistryClient.CONVERSION_PATH_FINDER, pathFinder.address);

    bntToken = await ERC20Token.new('BNT', 'BNT', 2, 10000000);
    erc20Token1 = await ERC20Token.new('ERC20Token', 'ERC1', 2, 1000000);
    erc20Token2 = await TestNonStandardToken.new('ERC20Token', 'ERC2', 2, 2000000);

    smartToken1 = await SmartToken.new('Smart1', 'SMART1', 2);
    await smartToken1.issue(accounts[0], 1000000);

    smartToken2 = await SmartToken.new('Smart2', 'SMART2', 2);
    await smartToken2.issue(accounts[0], 2000000);

    smartToken3 = await SmartToken.new('Smart3', 'SMART3', 2);
    await smartToken3.issue(accounts[0], 3000000);

    smartToken4 = await SmartToken.new('Smart4', 'SMART4', 2);
    await smartToken4.issue(accounts[0], 2500000);

    await contractRegistry.registerAddress(ContractRegistryClient.BNT_TOKEN, bntToken.address);

    converter1 = await LiquidityPoolV1Converter.new(smartToken1.address, contractRegistry.address, 0);
    await converter1.addReserve(bntToken.address, 500000);
    await converter1.addReserve(ETH_RESERVE_ADDRESS, 500000);

    converter2 = await LiquidityPoolV1Converter.new(smartToken2.address, contractRegistry.address, 0);
    await converter2.addReserve(bntToken.address, 300000);
    await converter2.addReserve(erc20Token1.address, 150000);

    converter3 = await BancorConverterHelper.new(1, smartToken3.address, contractRegistry.address, 0, bntToken.address, 350000, OLD_CONVERTER_VERSION);
    await converter3.addConnector(erc20Token2.address, 100000, false);

    converter4 = await LiquidTokenConverter.new(smartToken4.address, contractRegistry.address, 0);
    await converter4.addReserve(bntToken.address, 220000);

    await bntToken.transfer(converter1.address, 40000);
    await bntToken.transfer(converter2.address, 70000);
    await bntToken.transfer(converter3.address, 110000);
    await bntToken.transfer(converter4.address, 130000);

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

    await pathFinder.setAnchorToken(bntToken.address);

    await converterRegistry.addConverter(converter1.address);
    await converterRegistry.addConverter(converter2.address);
    await converterRegistry.addConverter(converter3.address);
    await converterRegistry.addConverter(converter4.address);

    initPaths([bntToken, erc20Token1, erc20Token2, smartToken1, smartToken2, smartToken3, smartToken4]);
};

async function approve(token, from, to, amount) {
    await token.approve(to, 0, { from });
    return await token.approve(to, amount, { from });
}

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

    describe('Conversions', () => {
        before(async () => {
            await initTokensAndConverters(accounts);
        });

        it('verifies that isV28OrHigherConverter returns true', async () => {
            let network = await TestBancorNetwork.new(0, 0);
            assert.isTrue(await network.isV28OrHigherConverterExternal.call(converter1.address));
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
                        await approve(sourceToken, accounts[0], bancorNetwork.address, 1000);

                    let prevBalance = await getBalance(targetToken, targetSymbol, accounts[0]);
                    let res = await bancorNetwork.convertByPath(paths[sourceSymbol][targetSymbol], 1000, 1, utils.zeroAddress, utils.zeroAddress, 0, { value });
                    let postBalance = await getBalance(targetToken, targetSymbol, accounts[0]);

                    let transactionCost = 0;
                    if (targetSymbol == 'ETH')
                        transactionCost = await getTransactionCost(res);

                    assert(postBalance.greaterThan(prevBalance.minus(transactionCost)), "sender balance isn't higher than previous balance");
                });

                it(`verifies that converting from ${sourceSymbol} to ${targetSymbol} with a beneficiary succeeds`, async () => {
                    let pathTokens = pathsTokens[sourceSymbol][targetSymbol];
                    let sourceToken = pathTokens[0];
                    let targetToken = pathTokens[pathTokens.length - 1];
                    let value = 0;
                    if (sourceSymbol == 'ETH')
                        value = 1000;
                    else
                        await approve(sourceToken, accounts[0], bancorNetwork.address, 1000);

                    let prevBalance = await getBalance(targetToken, targetSymbol, accounts[1]);
                    await bancorNetwork.convertByPath(paths[sourceSymbol][targetSymbol], 1000, 1, accounts[1], utils.zeroAddress, 0, { value });
                    let postBalance = await getBalance(targetToken, targetSymbol, accounts[1]);

                    assert(postBalance.greaterThan(prevBalance), "beneficiary balance isn't higher than previous balance");
                });

                it(`verifies that converting from ${sourceSymbol} to ${targetSymbol} with an affiliate fee succeeds`, async () => {
                    let pathTokens = pathsTokens[sourceSymbol][targetSymbol];
                    let sourceToken = pathTokens[0];
                    let value = 0;
                    if (sourceSymbol == 'ETH')
                        value = 10000;
                    else
                        await approve(sourceToken, accounts[0], bancorNetwork.address, 10000);

                    let prevBalance = await getBalance(bntToken, 'BNT', accounts[2]);
                    await bancorNetwork.convertByPath(paths[sourceSymbol][targetSymbol], 10000, 1, utils.zeroAddress, accounts[2], 10000, { value });
                    let postBalance = await getBalance(bntToken, 'BNT', accounts[2]);

                    // affiliate fee is only taken when converting to BNT, so BNT must exist and not be the first token in the path
                    if (pathTokens.indexOf(bntToken) > 0)
                        assert(postBalance.greaterThan(prevBalance), "affiliate account balance isn't higher than previous balance");
                    else
                        assert(postBalance.equals(prevBalance), "affiliate account balance changed");
                });

                it(`verifies that converting from ${sourceSymbol} to ${targetSymbol} returns the same amount returned by rateByPath`, async () => {
                    let pathTokens = pathsTokens[sourceSymbol][targetSymbol];
                    let sourceToken = pathTokens[0];
                    let targetToken = pathTokens[pathTokens.length - 1];
                    let value = 0;
                    if (sourceSymbol == 'ETH')
                        value = 1000;
                    else
                        await approve(sourceToken, accounts[0], bancorNetwork.address, 1000);

                    let expectedReturn = await bancorNetwork.rateByPath(paths[sourceSymbol][targetSymbol], 1000);
                    let prevBalance = await getBalance(targetToken, targetSymbol, accounts[0]);
                    let res = await bancorNetwork.convertByPath(paths[sourceSymbol][targetSymbol], 1000, 1, utils.zeroAddress, utils.zeroAddress, 0, { value });
                    let postBalance = await getBalance(targetToken, targetSymbol, accounts[0]);

                    let transactionCost = 0;
                    if (targetSymbol == 'ETH')
                        transactionCost = await getTransactionCost(res);

                    assert(expectedReturn.equals(postBalance.minus(prevBalance.minus(transactionCost))), "expected return differs from actual return");
                });

                it(`should throw when attempting to convert from ${sourceSymbol} to ${targetSymbol} and the conversion return amount is lower than the given minimum`, async () => {
                    let pathTokens = pathsTokens[sourceSymbol][targetSymbol];
                    let sourceToken = pathTokens[0];
                    let value = 0;
                    if (sourceSymbol == 'ETH')
                        value = 1000;
                    else
                        await approve(sourceToken, accounts[0], bancorNetwork.address, 1000);

                    let expectedReturn = await bancorNetwork.rateByPath(paths[sourceSymbol][targetSymbol], 1000);
                    await utils.catchRevert(bancorNetwork.convertByPath(paths[sourceSymbol][targetSymbol], 1000, expectedReturn.plus(1), utils.zeroAddress, utils.zeroAddress, 0, { value }));
                });
            }
        }

        it('verifies that conversionPath returns the correct path', async () => {
            let conversionPath = await bancorNetwork.conversionPath.call(erc20Token2.address, ETH_RESERVE_ADDRESS);
            let expectedPath = paths['ERC2']['ETH'];

            assert(conversionPath.length > 0);
            assert.equal(conversionPath.length, expectedPath.length);
            for (let i = 0; i < conversionPath.length; i++)
                assert.equal(conversionPath[i], expectedPath[i]);
        });

        it('should throw when attempting to convert and passing an amount higher than the ETH amount sent with the request', async () => {
            let path = paths['ETH']['SMART4'];
            await utils.catchRevert(bancorNetwork.convertByPath(path, 100001, 1, utils.zeroAddress, utils.zeroAddress, 0, { from: accounts[1], value: 100000 }));
        });

        it('verifies that convert returns a valid amount when buying a liquid token', async () => {
            let path = paths['ETH']['SMART4'];
            let amount = await bancorNetwork.convert.call(path, 10000, 1, { from: accounts[1], value: 10000 });
            assert.isAbove(amount.toNumber(), 0, 'amount converted');
        });

        it('should throw when calling convertFor with ether token but without sending ether', async () => {
            let path = paths['ETH']['SMART4'];
            await utils.catchRevert(bancorNetwork.convertFor(path, 10000, 1, accounts[1]));
        });

        it('should throw when calling convertFor with ether amount different than the amount sent', async () => {
            let path = paths['ETH']['SMART4'];
            await utils.catchRevert(bancorNetwork.convertFor.call(path, 20000, 1, accounts[1], { value: 10000 }));
        });

        it('should throw when calling convertFor with too-short path', async () => {
            let invalidPath = [ETH_RESERVE_ADDRESS, smartToken4.address];
            await utils.catchRevert(bancorNetwork.convertFor(invalidPath, 10000, 1, accounts[1], { value: 10000 }));
        });

        it('should throw when calling convertFor with even-length path', async () => {
            let invalidPath = [ETH_RESERVE_ADDRESS, smartToken1.address, smartToken2.address, smartToken4.address];
            await utils.catchRevert(bancorNetwork.convertFor(invalidPath, 10000, 1, accounts[1], { value: 10000 }));
        });

        it('should throw when calling convert with ether token but without sending ether', async () => {
            let path = paths['ETH']['SMART4'];
            await utils.catchRevert(bancorNetwork.convert(path, 10000, 1, { from: accounts[1] }));
        });

        it('should throw when calling convert with ether amount different than the amount sent', async () => {
            let path = paths['ETH']['SMART4'];
            await utils.catchRevert(bancorNetwork.convert.call(path, 20000, 1, { from: accounts[1], value: 10000 }));
        });

        it('should throw when calling convert with too-short path', async () => {
            let invalidPath = [ETH_RESERVE_ADDRESS, smartToken4.address];
            await utils.catchRevert(bancorNetwork.convert(invalidPath, 10000, 1, { from: accounts[1], value: 10000 }));
        });

        it('should throw when calling convert with even-length path', async () => {
            let invalidPath = [ETH_RESERVE_ADDRESS, smartToken1.address, smartToken2.address, smartToken4.address];
            await utils.catchRevert(bancorNetwork.convert(invalidPath, 10000, 1, { from: accounts[1], value: 10000 }));
        });

        it('verifies that claimAndConvertFor transfers the converted amount correctly when converter from a new converter to an old one', async () => {
            let path = paths['SMART4']['ERC2'];
            await approve(smartToken4, accounts[0], bancorNetwork.address, 10000);
            let balanceBeforeTransfer = await erc20Token2.balanceOf.call(accounts[1]);
            await bancorNetwork.claimAndConvertFor(path, 10000, 1, accounts[1]);
            let balanceAfterTransfer = await erc20Token2.balanceOf.call(accounts[1]);
            assert.isAbove(balanceAfterTransfer.toNumber(), balanceBeforeTransfer.toNumber(), 'amount transfered');
        });

        it('verifies that claimAndConvertFor transfers the converted amount correctly when converter from an old converter to a new one', async () => {
            let path = paths['ERC2']['SMART4'];
            await approve(erc20Token2, accounts[0], bancorNetwork.address, 10000);
            let balanceBeforeTransfer = await smartToken4.balanceOf.call(accounts[1]);
            await bancorNetwork.claimAndConvertFor(path, 10000, 1, accounts[1]);
            let balanceAfterTransfer = await smartToken4.balanceOf.call(accounts[1]);
            assert.isAbove(balanceAfterTransfer.toNumber(), balanceBeforeTransfer.toNumber(), 'amount transfered');
        });

        it('should throw when calling claimAndConvertFor without approval', async () => {
            let path = paths['ERC1']['SMART4'];
            await utils.catchRevert(bancorNetwork.claimAndConvertFor(path, 10000, 1, accounts[1]));
        });

        it('verifies that claimAndConvert transfers the converted amount correctly', async () => {
            await approve(erc20Token1, accounts[0], bancorNetwork.address, 10000);
            let balanceBeforeTransfer = await erc20Token2.balanceOf.call(accounts[0]);
            let path = paths['ERC1']['ERC2'];
            await bancorNetwork.claimAndConvert(path, 10000, 1);
            let balanceAfterTransfer = await erc20Token2.balanceOf.call(accounts[0]);
            assert.isAbove(balanceAfterTransfer.toNumber(), balanceBeforeTransfer.toNumber(), 'amount transfered');
        });

        it('should throw when calling claimAndConvert without approval', async () => {
            let path = paths['ERC1']['SMART4'];
            await utils.catchRevert(bancorNetwork.claimAndConvert(path, 10000, 1));
        });

        it('should throw when attempting to call rateByPath on a path with fewer than 3 elements', async () => {
            let invalidPath = [ETH_RESERVE_ADDRESS, smartToken1.address];
            await utils.catchRevert(bancorNetwork.rateByPath.call(invalidPath, 1000));
        });

        it('should throw when attempting to call rateByPath on a path with an even number of elements', async () => {
            let invalidPath = [ETH_RESERVE_ADDRESS, smartToken1.address, smartToken2.address, smartToken3.address];
            await utils.catchRevert(bancorNetwork.rateByPath.call(invalidPath, 1000));
        });

        it('verifies that convertFor2 transfers the converted amount correctly', async () => {
            let balanceBeforeTransfer = await smartToken4.balanceOf.call(accounts[1]);
            let path = paths['ETH']['SMART4'];
            await bancorNetwork.convertFor2(path, 10000, 1, accounts[1], utils.zeroAddress, 0, { value: 10000 });
            let balanceAfterTransfer = await smartToken4.balanceOf.call(accounts[1]);
            assert.isAbove(balanceAfterTransfer.toNumber(), balanceBeforeTransfer.toNumber(), 'amount transfered');
        });

        it('verifies that convert2 transfers the converted amount correctly', async () => {
            let balanceBeforeTransfer = await smartToken4.balanceOf.call(accounts[1]);
            let path = paths['ETH']['SMART4'];
            await bancorNetwork.convert2(path, 10000, 1, utils.zeroAddress, 0, { from: accounts[1], value: 10000 });
            let balanceAfterTransfer = await smartToken4.balanceOf.call(accounts[1]);
            assert.isAbove(balanceAfterTransfer.toNumber(), balanceBeforeTransfer.toNumber(), 'amount transfered');
        });

        it('verifies that convertFor2 returns a valid amount when buying a liquid token', async () => {
            let path = paths['ETH']['SMART4'];
            let amount = await bancorNetwork.convertFor2.call(path, 10000, 1, accounts[1], utils.zeroAddress, 0, { value: 10000 });
            assert.isAbove(amount.toNumber(), 0, 'amount converted');
        });

        it('verifies that convert2 returns a valid amount when buying a liquid token', async () => {
            let path = paths['ETH']['SMART4'];
            let amount = await bancorNetwork.convert2.call(path, 10000, 1, utils.zeroAddress, 0, { from: accounts[1], value: 10000 });
            assert.isAbove(amount.toNumber(), 0, 'amount converted');
        });

        it('should throw when calling convertFor2 with ether token but without sending ether', async () => {
            let path = paths['ETH']['ERC2'];
            await utils.catchRevert(bancorNetwork.convertFor2(path, 10000, 1, accounts[1], utils.zeroAddress, 0));
        });

        it('should throw when calling convertFor2 with ether amount different than the amount sent', async () => {
            let path = paths['ETH']['ERC2'];
            await utils.catchRevert(bancorNetwork.convertFor2.call(path, 20000, 1, accounts[1], utils.zeroAddress, 0, { value: 10000 }));
        });

        it('should throw when calling convertFor2 with too-short path', async () => {
            let invalidPath = [ETH_RESERVE_ADDRESS, smartToken1.address];
            await utils.catchRevert(bancorNetwork.convertFor2(invalidPath, 10000, 1, accounts[1], utils.zeroAddress, 0, { value: 10000 }));
        });

        it('should throw when calling convertFor2 with even-length path', async () => {
            let invalidPath = [ETH_RESERVE_ADDRESS, smartToken1.address, smartToken2.address, smartToken3.address];
            await utils.catchRevert(bancorNetwork.convertFor2(invalidPath, 10000, 1, accounts[1], utils.zeroAddress, 0, { value: 10000 }));
        });

        it('should throw when calling convert2 with ether token but without sending ether', async () => {
            let path = paths['ETH']['BNT'];
            await utils.catchRevert(bancorNetwork.convert2(path, 10000, 1, utils.zeroAddress, 0, { from: accounts[1] }));
        });

        it('should throw when calling convert2 with ether amount different than the amount sent', async () => {
            let path = paths['ETH']['BNT'];
            await utils.catchRevert(bancorNetwork.convert2.call(path, 20000, 1, utils.zeroAddress, 0, { from: accounts[1], value: 10000 }));
        });

        it('should throw when calling convert2 with too-short path', async () => {
            let invalidPath = [ETH_RESERVE_ADDRESS, smartToken1.address];
            await utils.catchRevert(bancorNetwork.convert2(invalidPath, 10000, 1, utils.zeroAddress, 0, { from: accounts[1], value: 10000 }));
        });

        it('should throw when calling convert2 with even-length path', async () => {
            let invalidPath = [ETH_RESERVE_ADDRESS, smartToken1.address, smartToken2.address, smartToken3.address];
            await utils.catchRevert(bancorNetwork.convert2(invalidPath, 10000, 1, utils.zeroAddress, 0, { from: accounts[1], value: 10000 }));
        });

        it('verifies that claimAndConvertFor2 transfers the converted amount correctly', async () => {
            await approve(erc20Token1, accounts[0], bancorNetwork.address, 10000);
            let balanceBeforeTransfer = await smartToken4.balanceOf.call(accounts[1]);
            let path = paths['ERC1']['SMART4'];
            await bancorNetwork.claimAndConvertFor2(path, 10000, 1, accounts[1], utils.zeroAddress, 0);
            let balanceAfterTransfer = await smartToken4.balanceOf.call(accounts[1]);
            assert.isAbove(balanceAfterTransfer.toNumber(), balanceBeforeTransfer.toNumber(), 'amount transfered');
        });

        it('should throw when calling claimAndConvertFor2 without approval', async () => {
            let path = paths['ERC1']['SMART4'];
            await utils.catchRevert(bancorNetwork.claimAndConvertFor2(path, 10000, 1, accounts[1], utils.zeroAddress, 0));
        });

        it('verifies that claimAndConvert2 transfers the converted amount correctly', async () => {
            await approve(erc20Token1, accounts[0], bancorNetwork.address, 10000);
            let balanceBeforeTransfer = await smartToken4.balanceOf.call(accounts[0]);
            let path = paths['ERC1']['SMART4'];
            await bancorNetwork.claimAndConvert2(path, 10000, 1, utils.zeroAddress, 0);
            let balanceAfterTransfer = await smartToken4.balanceOf.call(accounts[0]);
            assert.isAbove(balanceAfterTransfer.toNumber(), balanceBeforeTransfer.toNumber(), 'amount transfered');
        });

        it('should throw when calling claimAndConvert2 without approval', async () => {
            let path = paths['ERC1']['SMART4'];
            await utils.catchRevert(bancorNetwork.claimAndConvert2(path, 10000, 1, utils.zeroAddress, 0));
        });

        it('should throw when attempting to convert and passing an amount higher than the ETH amount sent with the request', async () => {
            let path = paths['ETH']['SMART4'];
            await utils.catchRevert(bancorNetwork.convert2(path, 100001, 1, utils.zeroAddress, 0, { from: accounts[1], value: 100000 }));
        });

        it('verifies that convertFor2 transfers the affiliate fee correctly', async () => {
            let path = paths['ETH']['ERC1'];
            let balanceBeforeTransfer = await bntToken.balanceOf.call(accounts[2]);
            await bancorNetwork.convertFor2(path, 10000, 1, accounts[1], accounts[2], 10000, { value: 10000 });
            let balanceAfterTransfer = await bntToken.balanceOf.call(accounts[2]);
            assert.isAbove(balanceAfterTransfer.toNumber(), balanceBeforeTransfer.toNumber(), 'amount transfered');
        });

        it('verifies that convert2 transfers the affiliate fee correctly', async () => {
            let path = paths['ETH']['ERC1'];
            let balanceBeforeTransfer = await bntToken.balanceOf.call(accounts[2]);
            await bancorNetwork.convert2(path, 10000, 1, accounts[2], 10000, { from: accounts[1], value: 10000 });
            let balanceAfterTransfer = await bntToken.balanceOf.call(accounts[2]);
            assert.isAbove(balanceAfterTransfer.toNumber(), balanceBeforeTransfer.toNumber(), 'amount transfered');
        });

        it('verifies that claimAndConvert2 transfers the affiliate fee correctly', async () => {
            await approve(erc20Token2, accounts[0], bancorNetwork.address, 10000);
            let balanceBeforeTransfer = await bntToken.balanceOf.call(accounts[2]);
            let path = paths['ERC2']['ETH'];
            await bancorNetwork.claimAndConvert2(path, 10000, 1, accounts[2], 10000);
            let balanceAfterTransfer = await bntToken.balanceOf.call(accounts[2]);
            assert.isAbove(balanceAfterTransfer.toNumber(), balanceBeforeTransfer.toNumber(), 'amount transfered');
        });

        it('verifies that claimAndConvertFor2 transfers the affiliate fee correctly', async () => {
            await approve(erc20Token2, accounts[0], bancorNetwork.address, 10000);
            let balanceBeforeTransfer = await bntToken.balanceOf.call(accounts[2]);
            let path = paths['ERC2']['ETH'];
            await bancorNetwork.claimAndConvertFor2(path, 10000, 1, accounts[1], accounts[2], 10000);
            let balanceAfterTransfer = await bntToken.balanceOf.call(accounts[2]);
            assert.isAbove(balanceAfterTransfer.toNumber(), balanceBeforeTransfer.toNumber(), 'amount transfered');
        });
    });
});
