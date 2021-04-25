const { accounts, defaultSender, contract, web3 } = require('@openzeppelin/test-environment');
const { expectRevert, constants, BN, balance } = require('@openzeppelin/test-helpers');
const { expect } = require('../../chai-local');

const BancorFormula = require('./helpers/BancorFormula');

const { NATIVE_TOKEN_ADDRESS, registry } = require('./helpers/Constants');
const { ZERO_ADDRESS } = constants;

const BancorNetwork = contract.fromArtifact('BancorNetwork');
const ContractRegistry = contract.fromArtifact('ContractRegistry');
const ConverterRegistry = contract.fromArtifact('ConverterRegistry');
const ConverterFactory = contract.fromArtifact('ConverterFactory');
const ConverterRegistryData = contract.fromArtifact('ConverterRegistryData');
const ConversionPathFinder = contract.fromArtifact('ConversionPathFinder');
const TestStandardToken = contract.fromArtifact('TestStandardToken');
const TestNonStandardToken = contract.fromArtifact('TestNonStandardToken');
const ConverterHelper = require('./helpers/ConverterHelper');
const TestBancorNetwork = contract.fromArtifact('TestBancorNetwork');
const ConverterV27OrLowerWithoutFallback = contract.fromArtifact('ConverterV27OrLowerWithoutFallback');
const ConverterV27OrLowerWithFallback = contract.fromArtifact('ConverterV27OrLowerWithFallback');
const ConverterV28OrHigherWithoutFallback = contract.fromArtifact('ConverterV28OrHigherWithoutFallback');
const ConverterV28OrHigherWithFallback = contract.fromArtifact('ConverterV28OrHigherWithFallback');

const StandardPoolConverter = contract.fromArtifact('StandardPoolConverter');
const NetworkSettings = contract.fromArtifact('NetworkSettings');

const DSToken = contract.fromArtifact('DSToken');

/*
Token network structure:

        Anchor1     Anchor2
        /     \     /     \
      ETH       BNT      TKN1

        Anchor3      Anchor4
        /       \     /     \
    TKN2          BNT      TKN3
*/

describe('BancorNetwork', () => {
    const initTokens = async () => {
        tokens = {
            ETH: { address: NATIVE_TOKEN_ADDRESS },
            BNT: await TestStandardToken.new('BNT', 'BNT', 2, 10000000),
            TKN1: await TestStandardToken.new('TKN1', 'TKN1', 2, 1000000),
            TKN2: await TestNonStandardToken.new('TKN2', 'TKN2', 2, 2000000),
            TKN3: await TestStandardToken.new('TKN3', 'TKN3', 2, 3000000),
            ANCR1: await DSToken.new('Anchor1', 'ANCR1', 2),
            ANCR2: await DSToken.new('Anchor2', 'ANCR2', 2),
            ANCR3: await DSToken.new('Anchor3', 'ANCR3', 2),
            ANCR4: await DSToken.new('Anchor4', 'ANCR4', 2)
        };

        await tokens.ANCR1.issue(sender, 1000000);
        await tokens.ANCR2.issue(sender, 2000000);
        await tokens.ANCR3.issue(sender, 3000000);
        await tokens.ANCR4.issue(sender, 2500000);

        pathTokens = {};

        for (const [start, data] of Object.entries(PATHS)) {
            pathTokens[start] = {};

            for (const [end, pathSymbols] of Object.entries(data)) {
                pathTokens[start][end] = pathSymbols.map((symbol) => tokens[symbol]);
            }
        }
    };

    const getBalance = async (reserveToken, account) => {
        const reserveTokenAddress = reserveToken.address || reserveToken;
        const address = account.address || account;

        if (reserveTokenAddress === NATIVE_TOKEN_ADDRESS) {
            return balance.current(address);
        }

        if (typeof reserveToken === 'string') {
            const token = await TestStandardToken.at(reserveToken);
            return await token.balanceOf.call(address);
        }

        return await reserveToken.balanceOf.call(address);
    };

    const getTransactionCost = async (txResult) => {
        const transaction = await web3.eth.getTransaction(txResult.tx);
        return new BN(transaction.gasPrice).mul(new BN(txResult.receipt.cumulativeGasUsed));
    };

    let network;
    let converter1;
    let converter2;
    let converter3;
    let converter4;
    let bancorNetwork;
    let contractRegistry;

    const PATHS = {
        ETH: {
            BNT: ['ETH', 'ANCR1', 'BNT'],
            TKN1: ['ETH', 'ANCR1', 'BNT', 'ANCR2', 'TKN1'],
            TKN2: ['ETH', 'ANCR1', 'BNT', 'ANCR3', 'TKN2'],
            TKN3: ['ETH', 'ANCR1', 'BNT', 'ANCR4', 'TKN3']
        },
        BNT: {
            ETH: ['BNT', 'ANCR1', 'ETH'],
            TKN1: ['BNT', 'ANCR2', 'TKN1'],
            TKN2: ['BNT', 'ANCR3', 'TKN2'],
            TKN3: ['BNT', 'ANCR4', 'TKN3']
        },
        TKN1: {
            ETH: ['TKN1', 'ANCR2', 'BNT', 'ANCR1', 'ETH'],
            BNT: ['TKN1', 'ANCR2', 'BNT'],
            TKN2: ['TKN1', 'ANCR2', 'BNT', 'ANCR3', 'TKN2'],
            TKN3: ['TKN1', 'ANCR2', 'BNT', 'ANCR4', 'TKN3']
        },
        TKN2: {
            ETH: ['TKN2', 'ANCR3', 'BNT', 'ANCR1', 'ETH'],
            BNT: ['TKN2', 'ANCR3', 'BNT'],
            TKN1: ['TKN2', 'ANCR3', 'BNT', 'ANCR2', 'TKN1'],
            TKN3: ['TKN2', 'ANCR3', 'BNT', 'ANCR4', 'TKN3']
        },
        TKN3: {
            ETH: ['TKN3', 'ANCR4', 'BNT', 'ANCR1', 'ETH'],
            BNT: ['TKN3', 'ANCR4', 'BNT'],
            TKN1: ['TKN3', 'ANCR4', 'BNT', 'ANCR2', 'TKN1'],
            TKN2: ['TKN3', 'ANCR4', 'BNT', 'ANCR3', 'TKN2']
        }
    };

    let tokens;
    let pathTokens;

    const sender = defaultSender;
    const sender2 = accounts[2];

    const OLD_CONVERTER_VERSION = 9;
    const MIN_RETURN = new BN(1);

    before(async () => {
        // The following contracts are unaffected by the underlying tests, this can be shared.
        contractRegistry = await ContractRegistry.new();

        const converterFactory = await ConverterFactory.new();
        await contractRegistry.registerAddress(registry.CONVERTER_FACTORY, converterFactory.address);

        const networkSettings = await NetworkSettings.new(defaultSender, 0);
        await contractRegistry.registerAddress(registry.NETWORK_SETTINGS, networkSettings.address);
    });

    describe('conversions', () => {
        beforeEach(async () => {
            network = await TestBancorNetwork.new(0, 0);

            bancorNetwork = await BancorNetwork.new(contractRegistry.address);
            await contractRegistry.registerAddress(registry.BANCOR_NETWORK, bancorNetwork.address);

            const converterRegistry = await ConverterRegistry.new(contractRegistry.address);
            const converterRegistryData = await ConverterRegistryData.new(contractRegistry.address);
            await contractRegistry.registerAddress(registry.CONVERTER_REGISTRY, converterRegistry.address);
            await contractRegistry.registerAddress(registry.CONVERTER_REGISTRY_DATA, converterRegistryData.address);

            const pathFinder = await ConversionPathFinder.new(contractRegistry.address);
            await contractRegistry.registerAddress(registry.CONVERSION_PATH_FINDER, pathFinder.address);

            // support old converters
            const bancorFormula = await BancorFormula.new();
            await bancorFormula.init();
            await contractRegistry.registerAddress(web3.utils.asciiToHex('BancorFormula'), bancorFormula.address);

            await initTokens();

            await contractRegistry.registerAddress(registry.BNT_TOKEN, tokens.BNT.address);

            converter1 = await StandardPoolConverter.new(tokens.ANCR1.address, contractRegistry.address, 0);
            await converter1.addReserve(tokens.BNT.address, 500000);
            await converter1.addReserve(NATIVE_TOKEN_ADDRESS, 500000);

            converter2 = await StandardPoolConverter.new(tokens.ANCR2.address, contractRegistry.address, 0);
            await converter2.addReserve(tokens.BNT.address, 500000);
            await converter2.addReserve(tokens.TKN1.address, 500000);

            converter3 = await ConverterHelper.new(
                1,
                OLD_CONVERTER_VERSION,
                tokens.ANCR3.address,
                contractRegistry.address,
                0,
                tokens.BNT.address,
                350000
            );
            await converter3.addConnector(tokens.TKN2.address, 100000, false);

            converter4 = await StandardPoolConverter.new(tokens.ANCR4.address, contractRegistry.address, 0);
            await converter4.addReserve(tokens.BNT.address, 500000);
            await converter4.addReserve(tokens.TKN3.address, 500000);

            await tokens.BNT.transfer(converter1.address, 40000);
            await tokens.BNT.transfer(converter2.address, 70000);
            await tokens.BNT.transfer(converter3.address, 110000);
            await tokens.BNT.transfer(converter4.address, 130000);

            await web3.eth.sendTransaction({ from: sender, to: converter1.address, value: 50000 });
            await tokens.TKN1.transfer(converter2.address, 25000);
            await tokens.TKN2.transfer(converter3.address, 30000);
            await tokens.TKN3.transfer(converter4.address, 35000);

            await tokens.ANCR1.transferOwnership(converter1.address);
            await converter1.acceptTokenOwnership();

            await tokens.ANCR2.transferOwnership(converter2.address);
            await converter2.acceptTokenOwnership();

            await tokens.ANCR3.transferOwnership(converter3.address);
            await converter3.acceptTokenOwnership();

            await tokens.ANCR4.transferOwnership(converter4.address);
            await converter4.acceptTokenOwnership();

            await pathFinder.setAnchorToken(tokens.BNT.address);

            await converterRegistry.addConverter(converter1.address);
            await converterRegistry.addConverter(converter2.address);
            await converterRegistry.addConverter(converter3.address);
            await converterRegistry.addConverter(converter4.address);
        });

        it('verifies that isV28OrHigherConverter returns false for ConverterV27OrLowerWithoutFallback', async () => {
            const converter = await ConverterV27OrLowerWithoutFallback.new();
            expect(await network.isV28OrHigherConverterExternal.call(converter.address)).to.be.false();
        });

        it('verifies that isV28OrHigherConverter returns false for ConverterV27OrLowerWithFallback', async () => {
            const converter = await ConverterV27OrLowerWithFallback.new();
            expect(await network.isV28OrHigherConverterExternal.call(converter.address)).to.be.false();
        });

        it('verifies that isV28OrHigherConverter returns true for ConverterV28OrHigherWithoutFallback', async () => {
            const converter = await ConverterV28OrHigherWithoutFallback.new();
            expect(await network.isV28OrHigherConverterExternal.call(converter.address)).to.be.true();
        });

        it('verifies that isV28OrHigherConverter returns true for ConverterV28OrHigherWithFallback', async () => {
            const converter = await ConverterV28OrHigherWithFallback.new();
            expect(await network.isV28OrHigherConverterExternal.call(converter.address)).to.be.true();
        });

        for (const sourceSymbol in PATHS) {
            for (const targetSymbol in PATHS[sourceSymbol]) {
                it(`verifies that converting from ${sourceSymbol} to ${targetSymbol} succeeds`, async () => {
                    const path = pathTokens[sourceSymbol][targetSymbol];
                    const sourceToken = path[0];
                    const targetToken = path[path.length - 1];

                    const amount = new BN(1000);
                    let value = 0;
                    if (sourceSymbol === 'ETH') {
                        value = amount;
                    } else {
                        await sourceToken.approve(bancorNetwork.address, amount, { from: sender });
                    }

                    const prevBalance = await getBalance(targetToken, sender);
                    const returnAmount = await bancorNetwork.convertByPath2.call(
                        path.map((token) => token.address),
                        amount,
                        MIN_RETURN,
                        ZERO_ADDRESS,
                        { value }
                    );
                    const res = await bancorNetwork.convertByPath2(
                        path.map((token) => token.address),
                        amount,
                        MIN_RETURN,
                        ZERO_ADDRESS,
                        { value }
                    );
                    const postBalance = await getBalance(targetToken, sender);

                    let transactionCost = new BN(0);
                    if (targetSymbol === 'ETH') {
                        transactionCost = await getTransactionCost(res);
                    }

                    expect(postBalance).to.be.bignumber.equal(prevBalance.add(returnAmount).sub(transactionCost));
                });

                it(`verifies that converting from ${sourceSymbol} to ${targetSymbol} with a beneficiary succeeds`, async () => {
                    const path = pathTokens[sourceSymbol][targetSymbol];
                    const sourceToken = path[0];
                    const targetToken = path[path.length - 1];

                    const amount = new BN(1000);
                    let value = 0;
                    if (sourceSymbol === 'ETH') {
                        value = amount;
                    } else {
                        await sourceToken.approve(bancorNetwork.address, amount, { from: sender });
                    }

                    const beneficiary = accounts[2];
                    const prevBalance = await getBalance(targetToken, beneficiary);

                    const returnAmount = await bancorNetwork.convertByPath2.call(
                        path.map((token) => token.address),
                        amount,
                        MIN_RETURN,
                        beneficiary,
                        { value }
                    );
                    await bancorNetwork.convertByPath2(
                        path.map((token) => token.address),
                        amount,
                        MIN_RETURN,
                        beneficiary,
                        { value }
                    );

                    const postBalance = await getBalance(targetToken, beneficiary);
                    expect(postBalance).to.be.bignumber.equal(prevBalance.add(returnAmount));
                });

                it(`verifies that converting from ${sourceSymbol} to ${targetSymbol} returns the same amount returned by rateByPath`, async () => {
                    const path = pathTokens[sourceSymbol][targetSymbol];
                    const sourceToken = path[0];
                    const targetToken = path[path.length - 1];

                    const amount = new BN(1000);
                    let value = 0;
                    if (sourceSymbol === 'ETH') {
                        value = amount;
                    } else {
                        await sourceToken.approve(bancorNetwork.address, amount, { from: sender });
                    }

                    const expectedReturn = await bancorNetwork.rateByPath.call(
                        path.map((token) => token.address),
                        amount
                    );
                    const prevBalance = await getBalance(targetToken, sender);
                    const res = await bancorNetwork.convertByPath2(
                        path.map((token) => token.address),
                        amount,
                        MIN_RETURN,
                        ZERO_ADDRESS,
                        { value }
                    );
                    const postBalance = await getBalance(targetToken, sender);

                    let transactionCost = new BN(0);
                    if (targetSymbol === 'ETH') {
                        transactionCost = await getTransactionCost(res);
                    }

                    expect(expectedReturn).to.be.bignumber.equal(postBalance.sub(prevBalance.sub(transactionCost)));
                });

                // eslint-disable-next-line max-len
                it(`should revert when attempting to convert from ${sourceSymbol} to ${targetSymbol} and the conversion return amount is lower than the given minimum`, async () => {
                    const path = pathTokens[sourceSymbol][targetSymbol];
                    const sourceToken = path[0];

                    const amount = new BN(1000);
                    let value = 0;
                    if (sourceSymbol === 'ETH') {
                        value = amount;
                    } else {
                        await sourceToken.approve(bancorNetwork.address, amount, { from: sender });
                    }

                    const expectedReturn = await bancorNetwork.rateByPath.call(
                        path.map((token) => token.address),
                        amount
                    );
                    await expectRevert(
                        bancorNetwork.convertByPath2(
                            path.map((token) => token.address),
                            amount,
                            expectedReturn.add(new BN(1)),
                            ZERO_ADDRESS,
                            { value }
                        ),
                        'ERR_RETURN_TOO_LOW'
                    );
                });
            }
        }

        it('verifies that conversionPath returns the correct path', async () => {
            const conversionPath = await bancorNetwork.conversionPath.call(tokens.TKN2.address, NATIVE_TOKEN_ADDRESS);
            const expectedPath = pathTokens.TKN2.ETH.map((token) => token.address);

            expect(conversionPath).not.to.be.empty();
            expect(conversionPath).to.have.lengthOf(expectedPath.length);

            for (let i = 0; i < conversionPath.length; i++) {
                expect(conversionPath[i]).to.eql(expectedPath[i]);
            }
        });

        it('should revert when attempting to convert and passing an amount higher than the ETH amount sent with the request', async () => {
            const path = pathTokens.ETH.TKN3.map((token) => token.address);
            const value = new BN(10000);

            await expectRevert(
                bancorNetwork.convertByPath2(path, value.add(new BN(1)), MIN_RETURN, ZERO_ADDRESS, {
                    from: sender,
                    value
                }),
                'ERR_ETH_AMOUNT_MISMATCH'
            );
        });

        it('should revert when calling convertFor with ETH reserve but without sending ether', async () => {
            const path = pathTokens.ETH.TKN3.map((token) => token.address);
            const value = new BN(10000);

            await expectRevert.unspecified(bancorNetwork.convertFor(path, value, MIN_RETURN, sender));
        });

        it('should revert when calling convertFor with ether amount lower than the ETH amount sent with the request', async () => {
            const path = pathTokens.ETH.TKN3.map((token) => token.address);

            const value = new BN(10000);
            await expectRevert(
                bancorNetwork.convertFor.call(path, value.sub(new BN(1)), MIN_RETURN, sender, { value }),
                'ERR_ETH_AMOUNT_MISMATCH'
            );
        });

        it('should revert when calling convertFor with too-short path', async () => {
            const invalidPath = [NATIVE_TOKEN_ADDRESS, tokens.ANCR4.address];
            const value = new BN(1000);

            await expectRevert(
                bancorNetwork.convertFor(invalidPath, value, MIN_RETURN, sender2, { value }),
                'ERR_INVALID_PATH'
            );
        });

        it('should revert when calling convertFor with even-length path', async () => {
            const invalidPath = [
                NATIVE_TOKEN_ADDRESS,
                tokens.ANCR1.address,
                tokens.ANCR2.address,
                tokens.ANCR4.address
            ];
            const value = new BN(1000);

            await expectRevert(
                bancorNetwork.convertFor(invalidPath, value, MIN_RETURN, sender2, { value }),
                'ERR_INVALID_PATH'
            );
        });

        it('should revert when calling convert with ETH reserve but without sending ether', async () => {
            const path = pathTokens.ETH.TKN3.map((token) => token.address);
            const value = new BN(1000);

            await expectRevert.unspecified(bancorNetwork.convert(path, value, MIN_RETURN, { from: sender }));
        });

        it('should revert when calling convert with ether amount different than the amount sent', async () => {
            const path = pathTokens.ETH.TKN3.map((token) => token.address);
            const value = new BN(1000);

            await expectRevert(
                bancorNetwork.convert.call(path, value.add(new BN(5)), MIN_RETURN, { from: sender, value }),
                'ERR_ETH_AMOUNT_MISMATCH'
            );
        });

        it('should revert when calling convert with too-short path', async () => {
            const invalidPath = [NATIVE_TOKEN_ADDRESS, tokens.ANCR4.address];
            const value = new BN(1000);

            await expectRevert(
                bancorNetwork.convert(invalidPath, value, MIN_RETURN, { from: sender, value }),
                'ERR_INVALID_PATH'
            );
        });

        it('should revert when calling convert with even-length path', async () => {
            const invalidPath = [
                NATIVE_TOKEN_ADDRESS,
                tokens.ANCR1.address,
                tokens.ANCR2.address,
                tokens.ANCR4.address
            ];
            const value = new BN(1000);

            await expectRevert(
                bancorNetwork.convert(invalidPath, value, MIN_RETURN, { from: sender, value }),
                'ERR_INVALID_PATH'
            );
        });

        // eslint-disable-next-line max-len
        it('verifies that claimAndConvertFor transfers the converted amount correctly when converter from a new converter to an old one', async () => {
            const value = new BN(1000);
            await tokens.TKN3.approve(bancorNetwork.address, value, { from: sender });

            const balanceBeforeTransfer = await tokens.TKN2.balanceOf.call(sender2);

            const path = pathTokens.TKN3.TKN2.map((token) => token.address);
            const returnAmount = await bancorNetwork.claimAndConvertFor.call(path, value, MIN_RETURN, sender2);
            await bancorNetwork.claimAndConvertFor(path, value, MIN_RETURN, sender2);

            const balanceAfterTransfer = await tokens.TKN2.balanceOf.call(sender2);
            expect(balanceAfterTransfer).to.be.bignumber.equal(balanceBeforeTransfer.add(returnAmount));
        });

        // eslint-disable-next-line max-len
        it('verifies that claimAndConvertFor transfers the converted amount correctly when converter from an old converter to a new one', async () => {
            const value = new BN(1000);
            await tokens.TKN2.approve(bancorNetwork.address, value, { from: sender });

            const balanceBeforeTransfer = await tokens.TKN3.balanceOf.call(sender2);

            const path = pathTokens.TKN2.TKN3.map((token) => token.address);
            const returnAmount = await bancorNetwork.claimAndConvertFor.call(path, value, MIN_RETURN, sender2);
            await bancorNetwork.claimAndConvertFor(path, value, MIN_RETURN, sender2);

            const balanceAfterTransfer = await tokens.TKN3.balanceOf.call(sender2);
            expect(balanceAfterTransfer).to.be.bignumber.equal(balanceBeforeTransfer.add(returnAmount));
        });

        it('should revert when calling claimAndConvertFor without approval', async () => {
            const path = pathTokens.TKN1.TKN3.map((token) => token.address);
            const value = new BN(1000);

            await expectRevert.unspecified(bancorNetwork.claimAndConvertFor(path, value, MIN_RETURN, sender2));
        });

        it('verifies that claimAndConvert transfers the converted amount correctly', async () => {
            const value = new BN(1000);
            await tokens.TKN1.approve(bancorNetwork.address, value, { from: sender });

            const balanceBeforeTransfer = await tokens.TKN2.balanceOf.call(sender);

            const path = pathTokens.TKN1.TKN2.map((token) => token.address);
            const returnAmount = await bancorNetwork.claimAndConvert.call(path, value, MIN_RETURN);
            await bancorNetwork.claimAndConvert(path, value, MIN_RETURN);

            const balanceAfterTransfer = await tokens.TKN2.balanceOf.call(sender);
            expect(balanceAfterTransfer).to.be.bignumber.equal(balanceBeforeTransfer.add(returnAmount));
        });

        it('should revert when calling claimAndConvert without approval', async () => {
            const path = pathTokens.TKN1.TKN3.map((token) => token.address);
            const value = new BN(1000);

            await expectRevert.unspecified(bancorNetwork.claimAndConvert(path, value, MIN_RETURN));
        });

        it('should revert when attempting to call rateByPath on a path with fewer than 3 elements', async () => {
            const invalidPath = [NATIVE_TOKEN_ADDRESS, tokens.ANCR1.address];
            const value = new BN(1000);

            await expectRevert(bancorNetwork.rateByPath.call(invalidPath, value), 'ERR_INVALID_PATH');
        });

        it('should revert when attempting to call rateByPath on a path with an even number of elements', async () => {
            const invalidPath = [
                NATIVE_TOKEN_ADDRESS,
                tokens.ANCR1.address,
                tokens.ANCR2.address,
                tokens.ANCR3.address
            ];
            const value = new BN(1000);

            await expectRevert(bancorNetwork.rateByPath.call(invalidPath, value), 'ERR_INVALID_PATH');
        });

        it('verifies that convertFor2 transfers the converted amount correctly', async () => {
            const balanceBeforeTransfer = await tokens.TKN3.balanceOf.call(sender2);

            const value = new BN(1000);
            const path = pathTokens.ETH.TKN3.map((token) => token.address);
            const returnAmount = await bancorNetwork.convertFor2.call(
                path,
                value,
                MIN_RETURN,
                sender2,
                ZERO_ADDRESS,
                0,
                { value }
            );
            await bancorNetwork.convertFor2(path, value, MIN_RETURN, sender2, ZERO_ADDRESS, 0, { value });

            const balanceAfterTransfer = await tokens.TKN3.balanceOf.call(sender2);
            expect(balanceAfterTransfer).to.be.bignumber.equal(balanceBeforeTransfer.add(returnAmount));
        });

        it('verifies that convert2 transfers the converted amount correctly', async () => {
            const balanceBeforeTransfer = await tokens.TKN3.balanceOf.call(sender2);

            const value = new BN(1000);
            const path = pathTokens.ETH.TKN3.map((token) => token.address);
            const returnAmount = await bancorNetwork.convert2.call(path, value, MIN_RETURN, ZERO_ADDRESS, 0, {
                from: sender2,
                value
            });
            await bancorNetwork.convert2(path, value, MIN_RETURN, ZERO_ADDRESS, 0, { from: sender2, value });

            const balanceAfterTransfer = await tokens.TKN3.balanceOf.call(sender2);
            expect(balanceAfterTransfer).to.be.bignumber.equal(balanceBeforeTransfer.add(returnAmount));
        });

        it('should revert when calling convertFor2 with ETH reserve but without sending ether', async () => {
            const path = pathTokens.ETH.TKN2.map((token) => token.address);
            const value = new BN(1000);

            await expectRevert.unspecified(
                bancorNetwork.convertFor2(path, value, MIN_RETURN, sender2, ZERO_ADDRESS, 0)
            );
        });

        it('should revert when calling convertFor2 with ether amount different than the amount sent', async () => {
            const path = pathTokens.ETH.TKN2.map((token) => token.address);
            const value = new BN(1000);

            await expectRevert(
                bancorNetwork.convertFor2.call(path, value.add(new BN(1)), MIN_RETURN, sender2, ZERO_ADDRESS, 0, {
                    value
                }),
                'ERR_ETH_AMOUNT_MISMATCH'
            );
        });

        it('should revert when calling convertFor2 with too-short path', async () => {
            const invalidPath = [NATIVE_TOKEN_ADDRESS, tokens.ANCR1.address];
            const value = new BN(1000);

            await expectRevert(
                bancorNetwork.convertFor2(invalidPath, value, MIN_RETURN, sender2, ZERO_ADDRESS, 0, { value }),
                'ERR_INVALID_PATH'
            );
        });

        it('should revert when calling convertFor2 with even-length path', async () => {
            const invalidPath = [
                NATIVE_TOKEN_ADDRESS,
                tokens.ANCR1.address,
                tokens.ANCR2.address,
                tokens.ANCR3.address
            ];
            const value = new BN(1000);

            await expectRevert(
                bancorNetwork.convertFor2(invalidPath, value, MIN_RETURN, sender2, ZERO_ADDRESS, 0, { value }),
                'ERR_INVALID_PATH'
            );
        });

        it('should revert when calling convert2 with ETH reserve but without sending ether', async () => {
            const path = pathTokens.ETH.BNT.map((token) => token.address);
            const value = new BN(1000);

            await expectRevert.unspecified(
                bancorNetwork.convert2(path, value, MIN_RETURN, ZERO_ADDRESS, 0, { from: sender })
            );
        });

        it('should revert when calling convert2 with ether amount different than the amount sent', async () => {
            const path = pathTokens.ETH.BNT.map((token) => token.address);
            const value = new BN(1000);

            await expectRevert(
                bancorNetwork.convert2.call(path, value.add(new BN(2)), MIN_RETURN, ZERO_ADDRESS, 0, {
                    from: sender,
                    value
                }),
                'ERR_ETH_AMOUNT_MISMATCH'
            );
        });

        it('should revert when calling convert2 with too-short path', async () => {
            const invalidPath = [NATIVE_TOKEN_ADDRESS, tokens.ANCR1.address];
            const value = new BN(1000);

            await expectRevert(
                bancorNetwork.convert2(invalidPath, value, MIN_RETURN, ZERO_ADDRESS, 0, { from: sender, value }),
                'ERR_INVALID_PATH'
            );
        });

        it('should revert when calling convert2 with even-length path', async () => {
            const invalidPath = [
                NATIVE_TOKEN_ADDRESS,
                tokens.ANCR1.address,
                tokens.ANCR2.address,
                tokens.ANCR3.address
            ];
            const value = new BN(1000);

            await expectRevert(
                bancorNetwork.convert2(invalidPath, value, MIN_RETURN, ZERO_ADDRESS, 0, { from: sender, value }),
                'ERR_INVALID_PATH'
            );
        });

        it('verifies that claimAndConvertFor2 transfers the converted amount correctly', async () => {
            const value = new BN(1000);
            await tokens.TKN1.approve(bancorNetwork.address, value, { from: sender });

            const balanceBeforeTransfer = await tokens.TKN3.balanceOf.call(sender2);

            const path = pathTokens.TKN1.TKN3.map((token) => token.address);
            const returnAmount = await bancorNetwork.claimAndConvertFor2.call(
                path,
                value,
                MIN_RETURN,
                sender2,
                ZERO_ADDRESS,
                0
            );
            await bancorNetwork.claimAndConvertFor2(path, value, MIN_RETURN, sender2, ZERO_ADDRESS, 0);

            const balanceAfterTransfer = await tokens.TKN3.balanceOf.call(sender2);
            expect(balanceAfterTransfer).to.be.bignumber.equal(balanceBeforeTransfer.add(returnAmount));
        });

        it('should revert when calling claimAndConvertFor2 without approval', async () => {
            const path = pathTokens.TKN1.TKN3.map((token) => token.address);
            const value = new BN(1000);
            await expectRevert.unspecified(
                bancorNetwork.claimAndConvertFor2(path, value, MIN_RETURN, sender2, ZERO_ADDRESS, 0)
            );
        });

        it('verifies that claimAndConvert2 transfers the converted amount correctly', async () => {
            const value = new BN(1000);
            await tokens.TKN1.approve(bancorNetwork.address, value, { from: sender });

            const balanceBeforeTransfer = await tokens.TKN3.balanceOf.call(sender);

            const path = pathTokens.TKN1.TKN3.map((token) => token.address);
            const returnAmount = await bancorNetwork.claimAndConvert2.call(path, value, MIN_RETURN, ZERO_ADDRESS, 0);
            await bancorNetwork.claimAndConvert2(path, value, MIN_RETURN, ZERO_ADDRESS, 0);

            const balanceAfterTransfer = await tokens.TKN3.balanceOf.call(sender);
            expect(balanceAfterTransfer).to.be.bignumber.equal(balanceBeforeTransfer.add(returnAmount));
        });

        it('should revert when calling claimAndConvert2 without approval', async () => {
            const path = pathTokens.TKN1.TKN3.map((token) => token.address);
            const value = new BN(1000);

            await expectRevert.unspecified(bancorNetwork.claimAndConvert2(path, value, MIN_RETURN, ZERO_ADDRESS, 0));
        });

        it('should revert when attempting to convert and passing an amount higher than the ETH amount sent with the request', async () => {
            const path = pathTokens.ETH.TKN3.map((token) => token.address);
            const value = new BN(1000);

            await expectRevert(
                bancorNetwork.convert2(path, value.add(new BN(10)), MIN_RETURN, ZERO_ADDRESS, 0, {
                    from: sender2,
                    value
                }),
                'ERR_ETH_AMOUNT_MISMATCH'
            );
        });
    });
});
