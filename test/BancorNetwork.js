const { expect } = require('chai');
const { ethers } = require('hardhat');
const { BigNumber } = require('ethers');

const ConverterHelper = require('./helpers/ConverterHelper');
const BancorFormula = require('./helpers/BancorFormula');

const { NATIVE_TOKEN_ADDRESS, ZERO_ADDRESS, registry } = require('./helpers/Constants');

const Contracts = require('../components/Contracts').default;

let network;
let converter1;
let converter2;
let converter3;
let converter4;
let bancorNetwork;
let converterRegistry;
let contractRegistry;

let tokens;
let pathTokens;

let sender;
let sender2;
let accounts;

const OLD_CONVERTER_VERSION = 9;
const MIN_RETURN = BigNumber.from(1);

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
            BNT: await Contracts.TestStandardToken.deploy('BNT', 'BNT', 10000000),
            TKN1: await Contracts.TestStandardToken.deploy('TKN1', 'TKN1', 1000000),
            TKN2: await Contracts.TestStandardToken.deploy('TKN2', 'TKN2', 2000000),
            TKN3: await Contracts.TestNonStandardToken.deploy('TKN3 (non-standard)', 'TKN3', 3000000),
            ANCR1: await Contracts.DSToken.deploy('Anchor1', 'ANCR1', 2),
            ANCR2: await Contracts.DSToken.deploy('Anchor2', 'ANCR2', 2),
            ANCR3: await Contracts.DSToken.deploy('Anchor3', 'ANCR3', 2),
            ANCR4: await Contracts.DSToken.deploy('Anchor4', 'ANCR4', 2)
        };

        await tokens.ANCR1.issue(sender.address, 1000000);
        await tokens.ANCR2.issue(sender.address, 2000000);
        await tokens.ANCR3.issue(sender.address, 3000000);
        await tokens.ANCR4.issue(sender.address, 2500000);

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
            return ethers.provider.getBalance(address);
        }

        if (typeof reserveToken === 'string') {
            const token = await Contracts.TestStandardToken.attach(reserveToken);
            return await token.balanceOf(address);
        }

        return reserveToken.balanceOf(address);
    };

    const getTransactionCost = async (txResult) => {
        const cumulativeGasUsed = (await txResult.wait()).cumulativeGasUsed;
        return BigNumber.from(txResult.gasPrice).mul(BigNumber.from(cumulativeGasUsed));
    };

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

    before(async () => {
        accounts = await ethers.getSigners();

        sender = accounts[0];
        sender2 = accounts[2];

        // The following contracts are unaffected by the underlying tests, this can be shared.
        contractRegistry = await Contracts.ContractRegistry.deploy();

        const converterFactory = await Contracts.ConverterFactory.deploy();
        await contractRegistry.registerAddress(registry.CONVERTER_FACTORY, converterFactory.address);

        const networkSettings = await Contracts.NetworkSettings.deploy(sender.address, 0);
        await contractRegistry.registerAddress(registry.NETWORK_SETTINGS, networkSettings.address);
    });

    describe('conversions', () => {
        beforeEach(async () => {
            network = await Contracts.TestBancorNetwork.deploy(0, 0);

            bancorNetwork = await Contracts.BancorNetwork.deploy(contractRegistry.address);
            await contractRegistry.registerAddress(registry.BANCOR_NETWORK, bancorNetwork.address);

            converterRegistry = await Contracts.ConverterRegistry.deploy(contractRegistry.address);
            const converterRegistryData = await Contracts.ConverterRegistryData.deploy(contractRegistry.address);
            await contractRegistry.registerAddress(registry.CONVERTER_REGISTRY, converterRegistry.address);
            await contractRegistry.registerAddress(registry.CONVERTER_REGISTRY_DATA, converterRegistryData.address);

            const pathFinder = await Contracts.ConversionPathFinder.deploy(contractRegistry.address);
            await contractRegistry.registerAddress(registry.CONVERSION_PATH_FINDER, pathFinder.address);

            // support old converters
            const bancorFormula = await BancorFormula.new();
            await bancorFormula.init();
            await contractRegistry.registerAddress(registry.BANCOR_FORMULA, bancorFormula.address);

            await initTokens();

            await contractRegistry.registerAddress(registry.BNT_TOKEN, tokens.BNT.address);

            converter1 = await Contracts.StandardPoolConverter.deploy(
                tokens.ANCR1.address,
                contractRegistry.address,
                0
            );
            await converter1.addReserve(tokens.BNT.address, 500000);
            await converter1.addReserve(NATIVE_TOKEN_ADDRESS, 500000);

            converter2 = await Contracts.StandardPoolConverter.deploy(
                tokens.ANCR2.address,
                contractRegistry.address,
                0
            );
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

            converter4 = await Contracts.StandardPoolConverter.deploy(
                tokens.ANCR4.address,
                contractRegistry.address,
                0
            );
            await converter4.addReserve(tokens.BNT.address, 500000);
            await converter4.addReserve(tokens.TKN3.address, 500000);

            await tokens.BNT.transfer(converter1.address, 40000);
            await tokens.BNT.transfer(converter2.address, 70000);
            await tokens.BNT.transfer(converter3.address, 110000);
            await tokens.BNT.transfer(converter4.address, 130000);

            await sender.sendTransaction({ to: converter1.address, value: 50000 });
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
            const converter = await Contracts.ConverterV27OrLowerWithoutFallback.deploy();
            expect(await network.isV28OrHigherConverterExternal(converter.address)).to.be.false;
        });

        it('verifies that isV28OrHigherConverter returns false for ConverterV27OrLowerWithFallback', async () => {
            const converter = await Contracts.ConverterV27OrLowerWithFallback.deploy();
            expect(await network.isV28OrHigherConverterExternal(converter.address)).to.be.false;
        });

        it('verifies that isV28OrHigherConverter returns true for ConverterV28OrHigherWithoutFallback', async () => {
            const converter = await Contracts.ConverterV28OrHigherWithoutFallback.deploy();
            expect(await network.isV28OrHigherConverterExternal(converter.address)).to.be.true;
        });

        it('verifies that isV28OrHigherConverter returns true for ConverterV28OrHigherWithFallback', async () => {
            const converter = await Contracts.ConverterV28OrHigherWithFallback.deploy();
            expect(await network.isV28OrHigherConverterExternal(converter.address)).to.be.true;
        });

        for (const sourceSymbol in PATHS) {
            for (const targetSymbol in PATHS[sourceSymbol]) {
                it(`verifies that converting from ${sourceSymbol} to ${targetSymbol} succeeds`, async () => {
                    const path = pathTokens[sourceSymbol][targetSymbol];
                    const sourceToken = path[0];
                    const targetToken = path[path.length - 1];

                    const amount = BigNumber.from(1000);
                    let value = 0;
                    if (sourceSymbol === 'ETH') {
                        value = amount;
                    } else {
                        await sourceToken.connect(sender).approve(bancorNetwork.address, amount);
                    }

                    const prevBalance = await getBalance(targetToken, sender);
                    const targetAmount = await bancorNetwork.callStatic.convertByPath2(
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

                    let transactionCost = BigNumber.from(0);
                    if (targetSymbol === 'ETH') {
                        transactionCost = await getTransactionCost(res);
                    }

                    expect(postBalance).to.equal(prevBalance.add(targetAmount).sub(transactionCost));
                });

                it(`verifies that converting from ${sourceSymbol} to ${targetSymbol} with a beneficiary succeeds`, async () => {
                    const path = pathTokens[sourceSymbol][targetSymbol];
                    const sourceToken = path[0];
                    const targetToken = path[path.length - 1];

                    const amount = BigNumber.from(1000);
                    let value = 0;
                    if (sourceSymbol === 'ETH') {
                        value = amount;
                    } else {
                        await sourceToken.connect(sender).approve(bancorNetwork.address, amount);
                    }

                    const beneficiary = accounts[2].address;
                    const prevBalance = await getBalance(targetToken, beneficiary);

                    const targetAmount = await bancorNetwork.callStatic.convertByPath2(
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
                    expect(postBalance).to.equal(prevBalance.add(targetAmount));
                });

                it(`verifies that converting from ${sourceSymbol} to ${targetSymbol} returns the same amount returned by rateByPath`, async () => {
                    const path = pathTokens[sourceSymbol][targetSymbol];
                    const sourceToken = path[0];
                    const targetToken = path[path.length - 1];

                    const amount = BigNumber.from(1000);
                    let value = 0;
                    if (sourceSymbol === 'ETH') {
                        value = amount;
                    } else {
                        await sourceToken.connect(sender).approve(bancorNetwork.address, amount);
                    }

                    const expectedReturn = await bancorNetwork.rateByPath(
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

                    let transactionCost = BigNumber.from(0);
                    if (targetSymbol === 'ETH') {
                        transactionCost = await getTransactionCost(res);
                    }

                    expect(expectedReturn).to.equal(postBalance.sub(prevBalance.sub(transactionCost)));
                });

                // eslint-disable-next-line max-len
                it(`should revert when attempting to convert from ${sourceSymbol} to ${targetSymbol} and the conversion return amount is lower than the given minimum`, async () => {
                    const path = pathTokens[sourceSymbol][targetSymbol];
                    const sourceToken = path[0];

                    const amount = BigNumber.from(1000);
                    let value = 0;
                    if (sourceSymbol === 'ETH') {
                        value = amount;
                    } else {
                        await sourceToken.connect(sender).approve(bancorNetwork.address, amount);
                    }

                    const expectedReturn = await bancorNetwork.rateByPath(
                        path.map((token) => token.address),
                        amount
                    );
                    await expect(
                        bancorNetwork.convertByPath2(
                            path.map((token) => token.address),
                            amount,
                            expectedReturn.add(BigNumber.from(1)),
                            ZERO_ADDRESS,
                            { value }
                        )
                    ).to.be.revertedWith('ERR_RETURN_TOO_LOW');
                });
            }
        }

        it('verifies that conversionPath returns the correct path', async () => {
            const conversionPath = await bancorNetwork.conversionPath(tokens.TKN2.address, NATIVE_TOKEN_ADDRESS);
            const expectedPath = pathTokens.TKN2.ETH.map((token) => token.address);

            expect(conversionPath).not.to.be.empty;
            expect(conversionPath).to.have.lengthOf(expectedPath.length);

            for (let i = 0; i < conversionPath.length; i++) {
                expect(conversionPath[i]).to.equal(expectedPath[i]);
            }
        });

        it('should revert when attempting to convert and passing an amount higher than the ETH amount sent with the request', async () => {
            const path = pathTokens.ETH.TKN3.map((token) => token.address);
            const value = BigNumber.from(10000);

            await expect(
                bancorNetwork
                    .connect(sender)
                    .convertByPath2(path, value.add(BigNumber.from(1)), MIN_RETURN, ZERO_ADDRESS, {
                        value
                    })
            ).to.be.revertedWith('ERR_ETH_AMOUNT_MISMATCH');
        });

        it('should revert when calling convertFor with ETH reserve but without sending ETH', async () => {
            const path = pathTokens.ETH.TKN3.map((token) => token.address);
            const value = BigNumber.from(10000);

            await expect(bancorNetwork.convertFor(path, value, MIN_RETURN, sender.address)).to.be.revertedWith(
                'ERR_INVALID_SOURCE_TOKEN'
            );
        });

        it('should revert when calling convertFor with ETH amount lower than the ETH amount sent with the request', async () => {
            const path = pathTokens.ETH.TKN3.map((token) => token.address);

            const value = BigNumber.from(10000);
            await expect(
                bancorNetwork.convertFor(path, value.sub(BigNumber.from(1)), MIN_RETURN, sender.address, {
                    value: value
                })
            ).to.be.revertedWith('ERR_ETH_AMOUNT_MISMATCH');
        });

        it('should revert when calling convertFor with too-short path', async () => {
            const invalidPath = [NATIVE_TOKEN_ADDRESS, tokens.ANCR4.address];
            const value = BigNumber.from(1000);

            await expect(
                bancorNetwork.convertFor(invalidPath, value, MIN_RETURN, sender2.address, { value })
            ).to.be.revertedWith('ERR_INVALID_PATH');
        });

        it('should revert when calling convertFor with even-length path', async () => {
            const invalidPath = [
                NATIVE_TOKEN_ADDRESS,
                tokens.ANCR1.address,
                tokens.ANCR2.address,
                tokens.ANCR4.address
            ];
            const value = BigNumber.from(1000);

            await expect(
                bancorNetwork.convertFor(invalidPath, value, MIN_RETURN, sender2.address, { value })
            ).to.be.revertedWith('ERR_INVALID_PATH');
        });

        it('should revert when calling convert with ETH reserve but without sending ETH', async () => {
            const path = pathTokens.ETH.TKN3.map((token) => token.address);
            const value = BigNumber.from(1000);

            await expect(bancorNetwork.connect(sender).convert(path, value, MIN_RETURN)).to.be.revertedWith(
                'ERR_INVALID_SOURCE_TOKEN'
            );
        });

        it('should revert when calling convert with ETH amount different than the amount sent', async () => {
            const path = pathTokens.ETH.TKN3.map((token) => token.address);
            const value = BigNumber.from(1000);

            await expect(
                bancorNetwork.connect(sender).convert(path, value.add(BigNumber.from(5)), MIN_RETURN, { value })
            ).to.be.revertedWith('ERR_ETH_AMOUNT_MISMATCH');
        });

        it('should revert when calling convert with too-short path', async () => {
            const invalidPath = [NATIVE_TOKEN_ADDRESS, tokens.ANCR4.address];
            const value = BigNumber.from(1000);

            await expect(
                bancorNetwork.connect(sender).convert(invalidPath, value, MIN_RETURN, { value })
            ).to.be.revertedWith('ERR_INVALID_PATH');
        });

        it('should revert when calling convert with even-length path', async () => {
            const invalidPath = [
                NATIVE_TOKEN_ADDRESS,
                tokens.ANCR1.address,
                tokens.ANCR2.address,
                tokens.ANCR4.address
            ];
            const value = BigNumber.from(1000);

            await expect(
                bancorNetwork.connect(sender).convert(invalidPath, value, MIN_RETURN, { value })
            ).to.be.revertedWith('ERR_INVALID_PATH');
        });

        // eslint-disable-next-line max-len
        it('verifies that claimAndConvertFor transfers the converted amount correctly when converter from a new converter to an old one', async () => {
            const value = BigNumber.from(1000);
            await tokens.TKN3.connect(sender).approve(bancorNetwork.address, value);

            const balanceBeforeTransfer = await tokens.TKN2.balanceOf(sender2.address);

            const path = pathTokens.TKN3.TKN2.map((token) => token.address);
            const targetAmount = await bancorNetwork.callStatic.claimAndConvertFor(
                path,
                value,
                MIN_RETURN,
                sender2.address
            );
            await bancorNetwork.claimAndConvertFor(path, value, MIN_RETURN, sender2.address);

            const balanceAfterTransfer = await tokens.TKN2.balanceOf(sender2.address);
            expect(balanceAfterTransfer).to.equal(balanceBeforeTransfer.add(targetAmount));
        });

        // eslint-disable-next-line max-len
        it('verifies that claimAndConvertFor transfers the converted amount correctly when converter from an old converter to a new one', async () => {
            const value = BigNumber.from(1000);
            await tokens.TKN2.connect(sender).approve(bancorNetwork.address, value);

            const balanceBeforeTransfer = await tokens.TKN3.balanceOf(sender2.address);

            const path = pathTokens.TKN2.TKN3.map((token) => token.address);
            const targetAmount = await bancorNetwork.callStatic.claimAndConvertFor(
                path,
                value,
                MIN_RETURN,
                sender2.address
            );
            await bancorNetwork.claimAndConvertFor(path, value, MIN_RETURN, sender2.address);

            const balanceAfterTransfer = await tokens.TKN3.balanceOf(sender2.address);
            expect(balanceAfterTransfer).to.equal(balanceBeforeTransfer.add(targetAmount));
        });

        it('should revert when calling claimAndConvertFor without approval', async () => {
            const path = pathTokens.TKN1.TKN3.map((token) => token.address);
            const value = BigNumber.from(1000);

            await expect(bancorNetwork.claimAndConvertFor(path, value, MIN_RETURN, sender2.address)).to.be.revertedWith(
                'ERC20: transfer amount exceeds allowance'
            );
        });

        it('verifies that claimAndConvert transfers the converted amount correctly', async () => {
            const value = BigNumber.from(1000);
            await tokens.TKN1.connect(sender).approve(bancorNetwork.address, value);

            const balanceBeforeTransfer = await tokens.TKN2.balanceOf(sender.address);

            const path = pathTokens.TKN1.TKN2.map((token) => token.address);
            const targetAmount = await bancorNetwork.callStatic.claimAndConvert(path, value, MIN_RETURN);
            await bancorNetwork.claimAndConvert(path, value, MIN_RETURN);

            const balanceAfterTransfer = await tokens.TKN2.balanceOf(sender.address);
            expect(balanceAfterTransfer).to.equal(balanceBeforeTransfer.add(targetAmount));
        });

        it('should revert when calling claimAndConvert without approval', async () => {
            const path = pathTokens.TKN1.TKN3.map((token) => token.address);
            const value = BigNumber.from(1000);

            await expect(bancorNetwork.claimAndConvert(path, value, MIN_RETURN)).to.be.revertedWith(
                'ERC20: transfer amount exceeds allowance'
            );
        });

        it('should revert when attempting to call rateByPath on a path with fewer than 3 elements', async () => {
            const invalidPath = [NATIVE_TOKEN_ADDRESS, tokens.ANCR1.address];
            const value = BigNumber.from(1000);

            await expect(bancorNetwork.rateByPath(invalidPath, value)).to.be.revertedWith('ERR_INVALID_PATH');
        });

        it('should revert when attempting to call rateByPath on a path with an even number of elements', async () => {
            const invalidPath = [
                NATIVE_TOKEN_ADDRESS,
                tokens.ANCR1.address,
                tokens.ANCR2.address,
                tokens.ANCR3.address
            ];
            const value = BigNumber.from(1000);

            await expect(bancorNetwork.rateByPath(invalidPath, value)).to.be.revertedWith('ERR_INVALID_PATH');
        });

        it('verifies that convertFor2 transfers the converted amount correctly', async () => {
            const balanceBeforeTransfer = await tokens.TKN3.balanceOf(sender2.address);

            const value = BigNumber.from(1000);
            const path = pathTokens.ETH.TKN3.map((token) => token.address);
            const targetAmount = await bancorNetwork.callStatic.convertFor2(
                path,
                value,
                MIN_RETURN,
                sender2.address,
                ZERO_ADDRESS,
                0,
                { value }
            );
            await bancorNetwork.convertFor2(path, value, MIN_RETURN, sender2.address, ZERO_ADDRESS, 0, {
                value: value
            });

            const balanceAfterTransfer = await tokens.TKN3.balanceOf(sender2.address);
            expect(balanceAfterTransfer).to.equal(balanceBeforeTransfer.add(targetAmount));
        });

        it('verifies that convert2 transfers the converted amount correctly', async () => {
            const balanceBeforeTransfer = await tokens.TKN3.balanceOf(sender2.address);

            const value = BigNumber.from(1000);
            const path = pathTokens.ETH.TKN3.map((token) => token.address);
            const targetAmount = await bancorNetwork
                .connect(sender2)
                .callStatic.convert2(path, value, MIN_RETURN, ZERO_ADDRESS, 0, {
                    value
                });

            await bancorNetwork.connect(sender2).convert2(path, value, MIN_RETURN, ZERO_ADDRESS, 0, { value });

            const balanceAfterTransfer = await tokens.TKN3.balanceOf(sender2.address);
            expect(balanceAfterTransfer).to.equal(balanceBeforeTransfer.add(targetAmount));
        });

        it('should revert when calling convertFor2 with ETH reserve but without sending ETH', async () => {
            const path = pathTokens.ETH.TKN2.map((token) => token.address);
            const value = BigNumber.from(1000);

            await expect(
                bancorNetwork.convertFor2(path, value, MIN_RETURN, sender2.address, ZERO_ADDRESS, 0)
            ).to.be.revertedWith('ERR_INVALID_SOURCE_TOKEN');
        });

        it('should revert when calling convertFor2 with ETH amount different than the amount sent', async () => {
            const path = pathTokens.ETH.TKN2.map((token) => token.address);
            const value = BigNumber.from(1000);

            await expect(
                bancorNetwork.convertFor2(
                    path,
                    value.add(BigNumber.from(1)),
                    MIN_RETURN,
                    sender2.address,
                    ZERO_ADDRESS,
                    0,
                    {
                        value
                    }
                )
            ).to.be.revertedWith('ERR_ETH_AMOUNT_MISMATCH');
        });

        it('should revert when calling convertFor2 with too-short path', async () => {
            const invalidPath = [NATIVE_TOKEN_ADDRESS, tokens.ANCR1.address];
            const value = BigNumber.from(1000);

            await expect(
                bancorNetwork.convertFor2(invalidPath, value, MIN_RETURN, sender2.address, ZERO_ADDRESS, 0, {
                    value: value
                })
            ).to.be.revertedWith('ERR_INVALID_PATH');
        });

        it('should revert when calling convertFor2 with even-length path', async () => {
            const invalidPath = [
                NATIVE_TOKEN_ADDRESS,
                tokens.ANCR1.address,
                tokens.ANCR2.address,
                tokens.ANCR3.address
            ];
            const value = BigNumber.from(1000);

            await expect(
                bancorNetwork.convertFor2(invalidPath, value, MIN_RETURN, sender2.address, ZERO_ADDRESS, 0, {
                    value: value
                })
            ).to.be.revertedWith('ERR_INVALID_PATH');
        });

        it('should revert when calling convert2 with ETH reserve but without sending ETH', async () => {
            const path = pathTokens.ETH.BNT.map((token) => token.address);
            const value = BigNumber.from(1000);

            await expect(
                bancorNetwork.connect(sender).convert2(path, value, MIN_RETURN, ZERO_ADDRESS, 0)
            ).to.be.revertedWith('ERR_INVALID_SOURCE_TOKEN');
        });

        it('should revert when calling convert2 with ETH amount different than the amount sent', async () => {
            const path = pathTokens.ETH.BNT.map((token) => token.address);
            const value = BigNumber.from(1000);

            await expect(
                bancorNetwork
                    .connect(sender)
                    .convert2(path, value.add(BigNumber.from(2)), MIN_RETURN, ZERO_ADDRESS, 0, {
                        value
                    })
            ).to.be.revertedWith('ERR_ETH_AMOUNT_MISMATCH');
        });

        it('should revert when calling convert2 with too-short path', async () => {
            const invalidPath = [NATIVE_TOKEN_ADDRESS, tokens.ANCR1.address];
            const value = BigNumber.from(1000);

            await expect(
                bancorNetwork.connect(sender).convert2(invalidPath, value, MIN_RETURN, ZERO_ADDRESS, 0, {
                    value: value
                })
            ).to.be.revertedWith('ERR_INVALID_PATH');
        });

        it('should revert when calling convert2 with even-length path', async () => {
            const invalidPath = [
                NATIVE_TOKEN_ADDRESS,
                tokens.ANCR1.address,
                tokens.ANCR2.address,
                tokens.ANCR3.address
            ];
            const value = BigNumber.from(1000);

            await expect(
                bancorNetwork.connect(sender).convert2(invalidPath, value, MIN_RETURN, ZERO_ADDRESS, 0, {
                    value: value
                })
            ).to.be.revertedWith('ERR_INVALID_PATH');
        });

        it('verifies that claimAndConvertFor2 transfers the converted amount correctly', async () => {
            const value = BigNumber.from(1000);
            await tokens.TKN1.connect(sender).approve(bancorNetwork.address, value);

            const balanceBeforeTransfer = await tokens.TKN3.balanceOf(sender2.address);

            const path = pathTokens.TKN1.TKN3.map((token) => token.address);
            const targetAmount = await bancorNetwork.callStatic.claimAndConvertFor2(
                path,
                value,
                MIN_RETURN,
                sender2.address,
                ZERO_ADDRESS,
                0
            );
            await bancorNetwork.claimAndConvertFor2(path, value, MIN_RETURN, sender2.address, ZERO_ADDRESS, 0);

            const balanceAfterTransfer = await tokens.TKN3.balanceOf(sender2.address);
            expect(balanceAfterTransfer).to.equal(balanceBeforeTransfer.add(targetAmount));
        });

        it('should revert when calling claimAndConvertFor2 without approval', async () => {
            const path = pathTokens.TKN1.TKN3.map((token) => token.address);
            const value = BigNumber.from(1000);
            await expect(
                bancorNetwork.claimAndConvertFor2(path, value, MIN_RETURN, sender2.address, ZERO_ADDRESS, 0)
            ).to.be.revertedWith('ERC20: transfer amount exceeds allowance');
        });

        it('verifies that claimAndConvert2 transfers the converted amount correctly', async () => {
            const value = BigNumber.from(1000);
            await tokens.TKN1.connect(sender).approve(bancorNetwork.address, value);

            const balanceBeforeTransfer = await tokens.TKN3.balanceOf(sender.address);

            const path = pathTokens.TKN1.TKN3.map((token) => token.address);
            const targetAmount = await bancorNetwork.callStatic.claimAndConvert2(
                path,
                value,
                MIN_RETURN,
                ZERO_ADDRESS,
                0
            );
            await bancorNetwork.claimAndConvert2(path, value, MIN_RETURN, ZERO_ADDRESS, 0);

            const balanceAfterTransfer = await tokens.TKN3.balanceOf(sender.address);
            expect(balanceAfterTransfer).to.equal(balanceBeforeTransfer.add(targetAmount));
        });

        it('should revert when calling claimAndConvert2 without approval', async () => {
            const path = pathTokens.TKN1.TKN3.map((token) => token.address);
            const value = BigNumber.from(1000);

            await expect(bancorNetwork.claimAndConvert2(path, value, MIN_RETURN, ZERO_ADDRESS, 0)).to.be.revertedWith(
                'ERC20: transfer amount exceeds allowance'
            );
        });

        it('should revert when attempting to convert and passing an amount higher than the ETH amount sent with the request', async () => {
            const path = pathTokens.ETH.TKN3.map((token) => token.address);
            const value = BigNumber.from(1000);

            await expect(
                bancorNetwork
                    .connect(sender2)
                    .convert2(path, value.add(BigNumber.from(10)), MIN_RETURN, ZERO_ADDRESS, 0, {
                        value
                    })
            ).to.be.revertedWith('ERR_ETH_AMOUNT_MISMATCH');
        });
    });
});
