const { accounts, defaultSender, contract, web3 } = require('@openzeppelin/test-environment');
const { expectRevert, constants, BN, balance } = require('@openzeppelin/test-helpers');
const { expect } = require('../../chai-local');

const { ETH_RESERVE_ADDRESS, registry } = require('./helpers/Constants');
const { ZERO_ADDRESS } = constants;

const BancorNetwork = contract.fromArtifact('BancorNetwork');
const BancorFormula = contract.fromArtifact('BancorFormula');
const ContractRegistry = contract.fromArtifact('ContractRegistry');
const ConverterRegistry = contract.fromArtifact('ConverterRegistry');
const ConverterFactory = contract.fromArtifact('ConverterFactory');
const ConverterRegistryData = contract.fromArtifact('ConverterRegistryData');
const ConversionPathFinder = contract.fromArtifact('ConversionPathFinder');
const EtherToken = contract.fromArtifact('EtherToken');
const ERC20Token = contract.fromArtifact('ERC20Token');
const TestNonStandardToken = contract.fromArtifact('TestNonStandardToken');
const ConverterHelper = require('./helpers/Converter');
const TestBancorNetwork = contract.fromArtifact('TestBancorNetwork');

const LiquidTokenConverter = contract.fromArtifact('LiquidTokenConverter');
const LiquidityPoolV1Converter = contract.fromArtifact('LiquidityPoolV1Converter');

const DSToken = contract.fromArtifact('DSToken');

/*
Token network structure:

        Anchor1     Anchor2
        /     \     /     \
      ETH       BNT    ERC20Token1

        Anchor3      Anchor4
        /       \     /
    ERC20Token2   BNT
*/

describe('BancorNetwork', () => {
    const initPaths = (tokens) => {
        const bntToken = tokens[0];
        const erc20Token1 = tokens[1];
        const erc20Token2 = tokens[2];
        const anchor1 = tokens[3];
        const anchor2 = tokens[4];
        const anchor3 = tokens[5];
        const anchor4 = tokens[6];

        pathsTokens = {
            ETH: {
                BNT: ['', anchor1, bntToken],
                ERC1: ['', anchor1, bntToken, anchor2, erc20Token1],
                ERC2: ['', anchor1, bntToken, anchor3, erc20Token2],
                ANCR4: ['', anchor1, bntToken, anchor4, anchor4]
            },
            BNT: {
                ETH: [bntToken, anchor1, ''],
                ERC1: [bntToken, anchor2, erc20Token1],
                ERC2: [bntToken, anchor3, erc20Token2],
                ANCR4: [bntToken, anchor4, anchor4]
            },
            ERC1: {
                ETH: [erc20Token1, anchor2, bntToken, anchor1, ''],
                BNT: [erc20Token1, anchor2, bntToken],
                ERC2: [erc20Token1, anchor2, bntToken, anchor3, erc20Token2],
                ANCR4: [erc20Token1, anchor2, bntToken, anchor4, anchor4]
            },
            ERC2: {
                ETH: [erc20Token2, anchor3, bntToken, anchor1, ''],
                BNT: [erc20Token2, anchor3, bntToken],
                ERC1: [erc20Token2, anchor3, bntToken, anchor2, erc20Token1],
                ANCR4: [erc20Token2, anchor3, bntToken, anchor4, anchor4]
            },
            ANCR4: {
                ETH: [anchor4, anchor4, bntToken, anchor1, ''],
                BNT: [anchor4, anchor4, bntToken],
                ERC1: [anchor4, anchor4, bntToken, anchor2, erc20Token1],
                ERC2: [anchor4, anchor4, bntToken, anchor3, erc20Token2]
            }
        };

        if (tokens.length <= 0) {
            return;
        }

        paths = {};
        for (const sourceSymbol in pathsTokens) {
            paths[sourceSymbol] = {};

            for (const targetSymbol in pathsTokens[sourceSymbol]) {
                paths[sourceSymbol][targetSymbol] = [];
                const path = paths[sourceSymbol][targetSymbol];

                const pathTokens = pathsTokens[sourceSymbol][targetSymbol];
                for (let i = 0; i < pathTokens.length; i++) {
                    if (pathTokens[i] === '') {
                        path[i] = ETH_RESERVE_ADDRESS;
                    } else {
                        path[i] = pathTokens[i].address;
                    }
                }
            }
        }
    };

    const getBalance = async (token, address, account) => {
        if (address === ETH_RESERVE_ADDRESS) {
            return balance.current(account);
        }

        return token.balanceOf.call(account);
    };

    const getTransactionCost = async (txResult) => {
        const transaction = await web3.eth.getTransaction(txResult.tx);
        return new BN(transaction.gasPrice).mul(new BN(txResult.receipt.cumulativeGasUsed));
    };

    let bntToken;
    let erc20Token1;
    let erc20Token2;
    let anchor1;
    let anchor2;
    let anchor3;
    let anchor4;
    let converter1;
    let converter2;
    let converter3;
    let converter4;
    let bancorNetwork;
    let contractRegistry;
    let pathsTokens;
    let paths;
    const sender = defaultSender;
    const nonOwner = accounts[1];
    const sender2 = accounts[2];
    const affiliate = accounts[5];

    const OLD_CONVERTER_VERSION = 9;
    const MIN_RETURN = new BN(1);
    const AFFILIATE_FEE = new BN(10000);

    before(async () => {
        // The following contracts are unaffected by the underlying tests, this can be shared.
        contractRegistry = await ContractRegistry.new();

        const bancorFormula = await BancorFormula.new();
        await bancorFormula.init();
        await contractRegistry.registerAddress(registry.BANCOR_FORMULA, bancorFormula.address);

        const converterFactory = await ConverterFactory.new();
        await contractRegistry.registerAddress(registry.CONVERTER_FACTORY, converterFactory.address);
    });

    describe('Settings', () => {
        beforeEach(async () => {
            bancorNetwork = await BancorNetwork.new(contractRegistry.address);
        });

        it('verifies valid ether token registration', async () => {
            const etherToken = await EtherToken.new('Token0', 'TKN0');
            const value = new BN(1000);
            await etherToken.deposit({ value });

            const bancorNetwork1 = await BancorNetwork.new(contractRegistry.address);
            await bancorNetwork1.registerEtherToken(etherToken.address, true);

            const validEtherToken = await bancorNetwork1.etherTokens.call(etherToken.address);
            expect(validEtherToken).to.be.true();
        });

        it('should revert when attempting register ether token with invalid address', async () => {
            const bancorNetwork1 = await BancorNetwork.new(contractRegistry.address);
            await expectRevert(bancorNetwork1.registerEtherToken(ZERO_ADDRESS, true), 'ERR_INVALID_ADDRESS');
        });

        it('should revert when non owner attempting register ether token', async () => {
            const etherToken = await EtherToken.new('Token0', 'TKN0');
            const value = new BN(1000);
            await etherToken.deposit({ value });
            const bancorNetwork1 = await BancorNetwork.new(contractRegistry.address);
            await expectRevert(
                bancorNetwork1.registerEtherToken(etherToken.address, true, { from: nonOwner }),
                'ERR_ACCESS_DENIED'
            );
        });

        it('verifies valid ether token unregistration', async () => {
            const etherToken = await EtherToken.new('Token0', 'TKN0');
            const value = new BN(1000);
            await etherToken.deposit({ value });
            const bancorNetwork1 = await BancorNetwork.new(contractRegistry.address);
            await bancorNetwork1.registerEtherToken(etherToken.address, true);
            const validEtherToken = await bancorNetwork1.etherTokens.call(etherToken.address);
            expect(validEtherToken).to.be.true();

            await bancorNetwork1.registerEtherToken(etherToken.address, false);
            const validEtherToken2 = await bancorNetwork1.etherTokens.call(etherToken.address);
            expect(validEtherToken2).to.be.false();
        });

        it('should revert when non owner attempting to unregister ether token', async () => {
            const etherToken = await EtherToken.new('Token0', 'TKN0');
            const value = new BN(1000);
            await etherToken.deposit({ value });
            const bancorNetwork1 = await BancorNetwork.new(contractRegistry.address);
            await bancorNetwork1.registerEtherToken(etherToken.address, true);
            const validEtherToken = await bancorNetwork1.etherTokens.call(etherToken.address);
            expect(validEtherToken).to.be.true();

            await expectRevert(
                bancorNetwork1.registerEtherToken(etherToken.address, false, { from: nonOwner }),
                'ERR_ACCESS_DENIED'
            );
        });

        it('verifies that setMaxAffiliateFee can set the maximum affiliate-fee', async () => {
            const oldMaxAffiliateFee = await bancorNetwork.maxAffiliateFee.call();

            const maxAffiliateFee = oldMaxAffiliateFee.add(new BN(1));
            await bancorNetwork.setMaxAffiliateFee(maxAffiliateFee);

            const newMaxAffiliateFee = await bancorNetwork.maxAffiliateFee.call();
            expect(newMaxAffiliateFee).to.be.bignumber.equal(maxAffiliateFee);
        });

        it('should revert when calling setMaxAffiliateFee with a non-owner', async () => {
            await expectRevert(
                bancorNetwork.setMaxAffiliateFee(new BN(1000000), { from: nonOwner }),
                'ERR_ACCESS_DENIED'
            );
        });

        it('should revert when calling setMaxAffiliateFee with an illegal value', async () => {
            await expectRevert(
                bancorNetwork.setMaxAffiliateFee(new BN(1000001), { from: sender }),
                'ERR_INVALID_AFFILIATE_FEE'
            );
        });
    });

    describe('Conversions', () => {
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

            bntToken = await ERC20Token.new('BNT', 'BNT', 2, 10000000);
            erc20Token1 = await ERC20Token.new('ERC20Token', 'ERC1', 2, 1000000);
            erc20Token2 = await TestNonStandardToken.new('ERC20Token', 'ERC2', 2, 2000000);

            anchor1 = await DSToken.new('Anchor1', 'ANCR1', 2);
            await anchor1.issue(sender, 1000000);

            anchor2 = await DSToken.new('Anchor2', 'ANCR2', 2);
            await anchor2.issue(sender, 2000000);

            anchor3 = await DSToken.new('Anchor3', 'ANCR3', 2);
            await anchor3.issue(sender, 3000000);

            anchor4 = await DSToken.new('Anchor4', 'ANCR4', 2);
            await anchor4.issue(sender, 2500000);

            await contractRegistry.registerAddress(registry.BNT_TOKEN, bntToken.address);

            converter1 = await LiquidityPoolV1Converter.new(anchor1.address, contractRegistry.address, 0);
            await converter1.addReserve(bntToken.address, 500000);
            await converter1.addReserve(ETH_RESERVE_ADDRESS, 500000);

            converter2 = await LiquidityPoolV1Converter.new(anchor2.address, contractRegistry.address, 0);
            await converter2.addReserve(bntToken.address, 300000);
            await converter2.addReserve(erc20Token1.address, 150000);

            converter3 = await ConverterHelper.new(
                1,
                anchor3.address,
                contractRegistry.address,
                0,
                bntToken.address,
                350000,
                OLD_CONVERTER_VERSION
            );
            await converter3.addConnector(erc20Token2.address, 100000, false);

            converter4 = await LiquidTokenConverter.new(anchor4.address, contractRegistry.address, 0);
            await converter4.addReserve(bntToken.address, 220000);

            await bntToken.transfer(converter1.address, 40000);
            await bntToken.transfer(converter2.address, 70000);
            await bntToken.transfer(converter3.address, 110000);
            await bntToken.transfer(converter4.address, 130000);

            await web3.eth.sendTransaction({ from: sender, to: converter1.address, value: 50000 });
            await erc20Token1.transfer(converter2.address, 25000);
            await erc20Token2.transfer(converter3.address, 30000);

            await anchor1.transferOwnership(converter1.address);
            await converter1.acceptTokenOwnership();

            await anchor2.transferOwnership(converter2.address);
            await converter2.acceptTokenOwnership();

            await anchor3.transferOwnership(converter3.address);
            await converter3.acceptTokenOwnership();

            await anchor4.transferOwnership(converter4.address);
            await converter4.acceptTokenOwnership();

            await pathFinder.setAnchorToken(bntToken.address);

            await converterRegistry.addConverter(converter1.address);
            await converterRegistry.addConverter(converter2.address);
            await converterRegistry.addConverter(converter3.address);
            await converterRegistry.addConverter(converter4.address);

            initPaths([bntToken, erc20Token1, erc20Token2, anchor1, anchor2, anchor3, anchor4]);
        });

        for (const sourceSymbol in pathsTokens) {
            for (const targetSymbol in pathsTokens[sourceSymbol]) {
                it(`verifies that converting from ${sourceSymbol} to ${targetSymbol} succeeds`, async () => {
                    const pathTokens = pathsTokens[sourceSymbol][targetSymbol];
                    const sourceToken = pathTokens[0];
                    const targetToken = pathTokens[pathTokens.length - 1];

                    const amount = new BN(1000);
                    let value = 0;
                    if (sourceSymbol === 'ETH') {
                        value = amount;
                    } else {
                        await sourceToken.approve(bancorNetwork.address, amount, { from: sender });
                    }

                    const prevBalance = await getBalance(targetToken, targetSymbol, sender);
                    const returnAmount = await bancorNetwork.convertByPath.call(
                        paths[sourceSymbol][targetSymbol],
                        amount,
                        MIN_RETURN,
                        ZERO_ADDRESS,
                        ZERO_ADDRESS,
                        0,
                        { value }
                    );
                    const res = await bancorNetwork.convertByPath(
                        paths[sourceSymbol][targetSymbol],
                        amount,
                        MIN_RETURN,
                        ZERO_ADDRESS,
                        ZERO_ADDRESS,
                        0,
                        { value }
                    );
                    const postBalance = await getBalance(targetToken, targetSymbol, sender);

                    let transactionCost = new BN(0);
                    if (targetSymbol === 'ETH') {
                        transactionCost = await getTransactionCost(res);
                    }

                    expect(postBalance).to.be.bignumber.equal(prevBalance.add(returnAmount).sub(transactionCost));
                });

                it(`verifies that converting from ${sourceSymbol} to ${targetSymbol} with a beneficiary succeeds`, async () => {
                    const pathTokens = pathsTokens[sourceSymbol][targetSymbol];
                    const sourceToken = pathTokens[0];
                    const targetToken = pathTokens[pathTokens.length - 1];

                    const amount = new BN(1000);
                    let value = 0;
                    if (sourceSymbol === 'ETH') {
                        value = amount;
                    } else {
                        await sourceToken.approve(bancorNetwork.address, amount, { from: sender });
                    }

                    const beneficiary = accounts[2];
                    const prevBalance = await getBalance(targetToken, targetSymbol, beneficiary);
                    const returnAmount = await bancorNetwork.convertByPath.call(
                        paths[sourceSymbol][targetSymbol],
                        amount,
                        MIN_RETURN,
                        beneficiary,
                        ZERO_ADDRESS,
                        0,
                        { value }
                    );
                    const res = await bancorNetwork.convertByPath(
                        paths[sourceSymbol][targetSymbol],
                        amount,
                        MIN_RETURN,
                        beneficiary,
                        ZERO_ADDRESS,
                        0,
                        { value }
                    );
                    const postBalance = await getBalance(targetToken, targetSymbol, beneficiary);

                    let transactionCost = new BN(0);
                    if (targetSymbol === 'ETH') {
                        transactionCost = await getTransactionCost(res);
                    }

                    expect(postBalance).to.be.bignumber.equal(prevBalance.add(returnAmount).sub(transactionCost));
                });

                it(`verifies that converting from ${sourceSymbol} to ${targetSymbol} with an affiliate fee succeeds`, async () => {
                    const pathTokens = pathsTokens[sourceSymbol][targetSymbol];
                    const sourceToken = pathTokens[0];

                    const amount = new BN(1000);
                    let value = 0;
                    if (sourceSymbol === 'ETH') {
                        value = amount;
                    } else {
                        await sourceToken.approve(bancorNetwork.address, amount, { from: sender });
                    }

                    const affiliate = accounts[2];
                    const prevBalance = await getBalance(bntToken, 'BNT', affiliate);
                    await bancorNetwork.convertByPath(
                        paths[sourceSymbol][targetSymbol],
                        amount,
                        MIN_RETURN,
                        ZERO_ADDRESS,
                        affiliate,
                        AFFILIATE_FEE,
                        { value }
                    );
                    const postBalance = await getBalance(bntToken, 'BNT', affiliate);

                    // Affiliate fee is only taken when converting to BNT, so BNT must exist and not be the first token
                    // in the path.
                    if (pathTokens.indexOf(bntToken) > 0) {
                        expect(postBalance).to.be.bignumber.gt(prevBalance);
                    } else {
                        expect(postBalance).to.be.bignumber.equal(prevBalance);
                    }
                });

                it(`verifies that converting from ${sourceSymbol} to ${targetSymbol} returns the same amount returned by rateByPath`, async () => {
                    const pathTokens = pathsTokens[sourceSymbol][targetSymbol];
                    const sourceToken = pathTokens[0];
                    const targetToken = pathTokens[pathTokens.length - 1];

                    const amount = new BN(1000);
                    let value = 0;
                    if (sourceSymbol === 'ETH') {
                        value = amount;
                    } else {
                        await sourceToken.approve(bancorNetwork.address, amount, { from: sender });
                    }

                    const expectedReturn = await bancorNetwork.rateByPath.call(
                        paths[sourceSymbol][targetSymbol],
                        amount
                    );
                    const prevBalance = await getBalance(targetToken, targetSymbol, sender);
                    const res = await bancorNetwork.convertByPath(
                        paths[sourceSymbol][targetSymbol],
                        amount,
                        MIN_RETURN,
                        ZERO_ADDRESS,
                        ZERO_ADDRESS,
                        0,
                        { value }
                    );
                    const postBalance = await getBalance(targetToken, targetSymbol, sender);

                    let transactionCost = new BN(0);
                    if (targetSymbol === 'ETH') {
                        transactionCost = await getTransactionCost(res);
                    }

                    expect(expectedReturn).to.be.bignumber.equal(postBalance.sub(prevBalance.sub(transactionCost)));
                });

                // eslint-disable-next-line max-len
                it(`should revert when attempting to convert from ${sourceSymbol} to ${targetSymbol} and the conversion return amount is lower than the given minimum`, async () => {
                    const pathTokens = pathsTokens[sourceSymbol][targetSymbol];
                    const sourceToken = pathTokens[0];

                    const amount = new BN(1000);
                    let value = 0;
                    if (sourceSymbol === 'ETH') {
                        value = amount;
                    } else {
                        await sourceToken.approve(bancorNetwork.address, amount, { from: sender });
                    }

                    const expectedReturn = await bancorNetwork.rateByPath.call(
                        paths[sourceSymbol][targetSymbol],
                        amount
                    );
                    await expectRevert(
                        bancorNetwork.convertByPath(
                            paths[sourceSymbol][targetSymbol],
                            amount,
                            expectedReturn.add(new BN(1)),
                            ZERO_ADDRESS,
                            ZERO_ADDRESS,
                            0,
                            { value }
                        ),
                        'ERR_RETURN_TOO_LOW'
                    );
                });
            }
        }

        it('verifies that conversionPath returns the correct path', async () => {
            const conversionPath = await bancorNetwork.conversionPath.call(erc20Token2.address, ETH_RESERVE_ADDRESS);
            const expectedPath = paths.ERC2.ETH;

            expect(conversionPath).not.to.be.empty();
            expect(conversionPath).to.have.lengthOf(expectedPath.length);

            for (let i = 0; i < conversionPath.length; i++) {
                expect(conversionPath[i]).to.eql(expectedPath[i]);
            }
        });

        it('should revert when attempting to convert and passing an amount higher than the ETH amount sent with the request', async () => {
            const path = paths.ETH.ANCR4;
            const value = new BN(10000);

            await expectRevert(
                bancorNetwork.convertByPath(path, value.add(new BN(1)), MIN_RETURN, ZERO_ADDRESS, ZERO_ADDRESS, 0, {
                    from: sender,
                    value
                }),
                'ERR_ETH_AMOUNT_MISMATCH'
            );
        });

        it('should revert when attempting to convert without an affiliate account, but with an affiliate fee', async () => {
            const path = paths.ETH.ANCR4;
            const value = new BN(100);

            await expectRevert(
                bancorNetwork.convertByPath(path, value, MIN_RETURN, ZERO_ADDRESS, ZERO_ADDRESS, AFFILIATE_FEE, {
                    from: sender,
                    value
                }),
                'ERR_INVALID_AFFILIATE_FEE'
            );
        });

        it('should revert when attempting to convert with a 0 affiliate fee', async () => {
            const path = paths.ETH.ANCR4;
            const value = new BN(100);

            await expectRevert(
                bancorNetwork.convertByPath(path, value, MIN_RETURN, ZERO_ADDRESS, affiliate, 0, {
                    from: sender,
                    value
                }),
                'ERR_INVALID_AFFILIATE_FEE'
            );
        });

        it('verifies that convert returns a valid amount when buying a liquid token', async () => {
            const path = paths.ETH.ANCR4;
            const value = new BN(10000);

            const amount = await bancorNetwork.convert.call(path, value, MIN_RETURN, { from: sender, value });
            expect(amount).to.be.bignumber.equal(new BN(27654));
        });

        it('should revert when calling convertFor with ether token but without sending ether', async () => {
            const path = paths.ETH.ANCR4;
            const value = new BN(10000);

            await expectRevert.unspecified(bancorNetwork.convertFor(path, value, MIN_RETURN, sender));
        });

        it('should revert when calling convertFor with ether amount lower than the ETH amount sent with the request', async () => {
            const path = paths.ETH.ANCR4;

            const value = new BN(10000);
            await expectRevert(
                bancorNetwork.convertFor.call(path, value.sub(new BN(1)), MIN_RETURN, sender, { value }),
                'ERR_ETH_AMOUNT_MISMATCH'
            );
        });

        it('should revert when calling convertFor with too-short path', async () => {
            const invalidPath = [ETH_RESERVE_ADDRESS, anchor4.address];
            const value = new BN(1000);

            await expectRevert(
                bancorNetwork.convertFor(invalidPath, value, MIN_RETURN, sender2, { value }),
                'ERR_INVALID_PATH'
            );
        });

        it('should revert when calling convertFor with even-length path', async () => {
            const invalidPath = [ETH_RESERVE_ADDRESS, anchor1.address, anchor2.address, anchor4.address];
            const value = new BN(1000);

            await expectRevert(
                bancorNetwork.convertFor(invalidPath, value, MIN_RETURN, sender2, { value }),
                'ERR_INVALID_PATH'
            );
        });

        it('should revert when calling convert with ether token but without sending ether', async () => {
            const path = paths.ETH.ANCR4;
            const value = new BN(1000);

            await expectRevert.unspecified(bancorNetwork.convert(path, value, MIN_RETURN, { from: sender }));
        });

        it('should revert when calling convert with ether amount different than the amount sent', async () => {
            const path = paths.ETH.ANCR4;
            const value = new BN(1000);

            await expectRevert(
                bancorNetwork.convert.call(path, value.add(new BN(5)), MIN_RETURN, { from: sender, value }),
                'ERR_ETH_AMOUNT_MISMATCH'
            );
        });

        it('should revert when calling convert with too-short path', async () => {
            const invalidPath = [ETH_RESERVE_ADDRESS, anchor4.address];
            const value = new BN(1000);

            await expectRevert(
                bancorNetwork.convert(invalidPath, value, MIN_RETURN, { from: sender, value }),
                'ERR_INVALID_PATH'
            );
        });

        it('should revert when calling convert with even-length path', async () => {
            const invalidPath = [ETH_RESERVE_ADDRESS, anchor1.address, anchor2.address, anchor4.address];
            const value = new BN(1000);

            await expectRevert(
                bancorNetwork.convert(invalidPath, value, MIN_RETURN, { from: sender, value }),
                'ERR_INVALID_PATH'
            );
        });

        // eslint-disable-next-line max-len
        it('verifies that claimAndConvertFor transfers the converted amount correctly when converter from a new converter to an old one', async () => {
            const value = new BN(1000);
            await anchor4.approve(bancorNetwork.address, value, { from: sender });

            const balanceBeforeTransfer = await erc20Token2.balanceOf.call(sender2);

            const path = paths.ANCR4.ERC2;
            const returnAmount = await bancorNetwork.claimAndConvertFor.call(path, value, MIN_RETURN, sender2);
            await bancorNetwork.claimAndConvertFor(path, value, MIN_RETURN, sender2);

            const balanceAfterTransfer = await erc20Token2.balanceOf.call(sender2);
            expect(balanceAfterTransfer).to.be.bignumber.equal(balanceBeforeTransfer.add(returnAmount));
        });

        // eslint-disable-next-line max-len
        it('verifies that claimAndConvertFor transfers the converted amount correctly when converter from an old converter to a new one', async () => {
            const value = new BN(1000);
            await erc20Token2.approve(bancorNetwork.address, value, { from: sender });

            const balanceBeforeTransfer = await anchor4.balanceOf.call(sender2);

            const path = paths.ERC2.ANCR4;
            const returnAmount = await bancorNetwork.claimAndConvertFor.call(path, value, MIN_RETURN, sender2);
            await bancorNetwork.claimAndConvertFor(path, value, MIN_RETURN, sender2);

            const balanceAfterTransfer = await anchor4.balanceOf.call(sender2);
            expect(balanceAfterTransfer).to.be.bignumber.equal(balanceBeforeTransfer.add(returnAmount));
        });

        it('should revert when calling claimAndConvertFor without approval', async () => {
            const path = paths.ERC1.ANCR4;
            const value = new BN(1000);

            await expectRevert.unspecified(bancorNetwork.claimAndConvertFor(path, value, MIN_RETURN, sender2));
        });

        it('verifies that claimAndConvert transfers the converted amount correctly', async () => {
            const value = new BN(1000);
            await erc20Token1.approve(bancorNetwork.address, value, { from: sender });

            const balanceBeforeTransfer = await erc20Token2.balanceOf.call(sender);

            const path = paths.ERC1.ERC2;
            const returnAmount = await bancorNetwork.claimAndConvert.call(path, value, MIN_RETURN);
            await bancorNetwork.claimAndConvert(path, value, MIN_RETURN);

            const balanceAfterTransfer = await erc20Token2.balanceOf.call(sender);
            expect(balanceAfterTransfer).to.be.bignumber.equal(balanceBeforeTransfer.add(returnAmount));
        });

        it('should revert when calling claimAndConvert without approval', async () => {
            const path = paths.ERC1.ANCR4;
            const value = new BN(1000);

            await expectRevert.unspecified(bancorNetwork.claimAndConvert(path, value, MIN_RETURN));
        });

        it('should revert when attempting to call rateByPath on a path with fewer than 3 elements', async () => {
            const invalidPath = [ETH_RESERVE_ADDRESS, anchor1.address];
            const value = new BN(1000);

            await expectRevert(bancorNetwork.rateByPath.call(invalidPath, value), 'ERR_INVALID_PATH');
        });

        it('should revert when attempting to call rateByPath on a path with an even number of elements', async () => {
            const invalidPath = [ETH_RESERVE_ADDRESS, anchor1.address, anchor2.address, anchor3.address];
            const value = new BN(1000);

            await expectRevert(bancorNetwork.rateByPath.call(invalidPath, value), 'ERR_INVALID_PATH');
        });

        it('verifies that convertFor2 transfers the converted amount correctly', async () => {
            const balanceBeforeTransfer = await anchor4.balanceOf.call(sender2);

            const value = new BN(1000);
            const path = paths.ETH.ANCR4;
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

            const balanceAfterTransfer = await anchor4.balanceOf.call(sender2);
            expect(balanceAfterTransfer).to.be.bignumber.equal(balanceBeforeTransfer.add(returnAmount));
        });

        it('verifies that convert2 transfers the converted amount correctly', async () => {
            const balanceBeforeTransfer = await anchor4.balanceOf.call(sender2);

            const value = new BN(1000);
            const path = paths.ETH.ANCR4;
            const returnAmount = await bancorNetwork.convert2.call(path, value, MIN_RETURN, ZERO_ADDRESS, 0, {
                from: sender2,
                value
            });
            await bancorNetwork.convert2(path, value, MIN_RETURN, ZERO_ADDRESS, 0, { from: sender2, value });

            const balanceAfterTransfer = await anchor4.balanceOf.call(sender2);
            expect(balanceAfterTransfer).to.be.bignumber.equal(balanceBeforeTransfer.add(returnAmount));
        });

        it('should revert when calling convertFor2 with ether token but without sending ether', async () => {
            const path = paths.ETH.ERC2;
            const value = new BN(1000);

            await expectRevert.unspecified(
                bancorNetwork.convertFor2(path, value, MIN_RETURN, sender2, ZERO_ADDRESS, 0)
            );
        });

        it('should revert when calling convertFor2 with ether amount different than the amount sent', async () => {
            const path = paths.ETH.ERC2;
            const value = new BN(1000);

            await expectRevert(
                bancorNetwork.convertFor2.call(path, value.add(new BN(1)), MIN_RETURN, sender2, ZERO_ADDRESS, 0, {
                    value
                }),
                'ERR_ETH_AMOUNT_MISMATCH'
            );
        });

        it('should revert when calling convertFor2 with too-short path', async () => {
            const invalidPath = [ETH_RESERVE_ADDRESS, anchor1.address];
            const value = new BN(1000);

            await expectRevert(
                bancorNetwork.convertFor2(invalidPath, value, MIN_RETURN, sender2, ZERO_ADDRESS, 0, { value }),
                'ERR_INVALID_PATH'
            );
        });

        it('should revert when calling convertFor2 with even-length path', async () => {
            const invalidPath = [ETH_RESERVE_ADDRESS, anchor1.address, anchor2.address, anchor3.address];
            const value = new BN(1000);

            await expectRevert(
                bancorNetwork.convertFor2(invalidPath, value, MIN_RETURN, sender2, ZERO_ADDRESS, 0, { value }),
                'ERR_INVALID_PATH'
            );
        });

        it('should revert when calling convert2 with ether token but without sending ether', async () => {
            const path = paths.ETH.BNT;
            const value = new BN(1000);

            await expectRevert.unspecified(
                bancorNetwork.convert2(path, value, MIN_RETURN, ZERO_ADDRESS, 0, { from: sender })
            );
        });

        it('should revert when calling convert2 with ether amount different than the amount sent', async () => {
            const path = paths.ETH.BNT;
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
            const invalidPath = [ETH_RESERVE_ADDRESS, anchor1.address];
            const value = new BN(1000);

            await expectRevert(
                bancorNetwork.convert2(invalidPath, value, MIN_RETURN, ZERO_ADDRESS, 0, { from: sender, value }),
                'ERR_INVALID_PATH'
            );
        });

        it('should revert when calling convert2 with even-length path', async () => {
            const invalidPath = [ETH_RESERVE_ADDRESS, anchor1.address, anchor2.address, anchor3.address];
            const value = new BN(1000);

            await expectRevert(
                bancorNetwork.convert2(invalidPath, value, MIN_RETURN, ZERO_ADDRESS, 0, { from: sender, value }),
                'ERR_INVALID_PATH'
            );
        });

        it('verifies that claimAndConvertFor2 transfers the converted amount correctly', async () => {
            const value = new BN(1000);
            await erc20Token1.approve(bancorNetwork.address, value, { from: sender });

            const balanceBeforeTransfer = await anchor4.balanceOf.call(sender2);

            const path = paths.ERC1.ANCR4;
            const returnAmount = await bancorNetwork.claimAndConvertFor2.call(
                path,
                value,
                MIN_RETURN,
                sender2,
                ZERO_ADDRESS,
                0
            );
            await bancorNetwork.claimAndConvertFor2(path, value, MIN_RETURN, sender2, ZERO_ADDRESS, 0);

            const balanceAfterTransfer = await anchor4.balanceOf.call(sender2);
            expect(balanceAfterTransfer).to.be.bignumber.equal(balanceBeforeTransfer.add(returnAmount));
        });

        it('should revert when calling claimAndConvertFor2 without approval', async () => {
            const path = paths.ERC1.ANCR4;
            const value = new BN(1000);
            await expectRevert.unspecified(
                bancorNetwork.claimAndConvertFor2(path, value, MIN_RETURN, sender2, ZERO_ADDRESS, 0)
            );
        });

        it('verifies that claimAndConvert2 transfers the converted amount correctly', async () => {
            const value = new BN(1000);
            await erc20Token1.approve(bancorNetwork.address, value, { from: sender });

            const balanceBeforeTransfer = await anchor4.balanceOf.call(sender);

            const path = paths.ERC1.ANCR4;
            const returnAmount = await bancorNetwork.claimAndConvert2.call(path, value, MIN_RETURN, ZERO_ADDRESS, 0);
            await bancorNetwork.claimAndConvert2(path, value, MIN_RETURN, ZERO_ADDRESS, 0);

            const balanceAfterTransfer = await anchor4.balanceOf.call(sender);
            expect(balanceAfterTransfer).to.be.bignumber.equal(balanceBeforeTransfer.add(returnAmount));
        });

        it('should revert when calling claimAndConvert2 without approval', async () => {
            const path = paths.ERC1.ANCR4;
            const value = new BN(1000);

            await expectRevert.unspecified(bancorNetwork.claimAndConvert2(path, value, MIN_RETURN, ZERO_ADDRESS, 0));
        });

        it('should revert when attempting to convert and passing an amount higher than the ETH amount sent with the request', async () => {
            const path = paths.ETH.ANCR4;
            const value = new BN(1000);

            await expectRevert(
                bancorNetwork.convert2(path, value.add(new BN(10)), MIN_RETURN, ZERO_ADDRESS, 0, {
                    from: sender2,
                    value
                }),
                'ERR_ETH_AMOUNT_MISMATCH'
            );
        });

        it('verifies that convertFor2 transfers the affiliate fee correctly', async () => {
            const value = new BN(10000);
            const path = paths.ETH.ERC1;

            const balanceBeforeTransfer = await bntToken.balanceOf.call(affiliate);

            await bancorNetwork.convertFor2(path, value, MIN_RETURN, sender2, affiliate, AFFILIATE_FEE, { value });

            const balanceAfterTransfer = await bntToken.balanceOf.call(affiliate);
            expect(balanceAfterTransfer).to.be.bignumber.gt(balanceBeforeTransfer);
        });

        it('verifies that convert2 transfers the affiliate fee correctly', async () => {
            const value = new BN(10000);
            const path = paths.ETH.ERC1;

            const balanceBeforeTransfer = await bntToken.balanceOf.call(affiliate);

            await bancorNetwork.convert2(path, value, MIN_RETURN, affiliate, AFFILIATE_FEE, {
                from: sender,
                value
            });

            const balanceAfterTransfer = await bntToken.balanceOf.call(affiliate);
            expect(balanceAfterTransfer).to.be.bignumber.gt(balanceBeforeTransfer);
        });

        it('verifies that claimAndConvert2 transfers the affiliate fee correctly', async () => {
            const value = new BN(10000);
            await erc20Token2.approve(bancorNetwork.address, value, { from: sender });

            const balanceBeforeTransfer = await bntToken.balanceOf.call(affiliate);

            const path = paths.ERC2.ETH;
            await bancorNetwork.claimAndConvert2(path, value, MIN_RETURN, affiliate, AFFILIATE_FEE);

            const balanceAfterTransfer = await bntToken.balanceOf.call(affiliate);
            expect(balanceAfterTransfer).to.be.bignumber.gt(balanceBeforeTransfer);
        });

        it('verifies that claimAndConvertFor2 transfers the affiliate fee correctly', async () => {
            const value = new BN(10000);
            await erc20Token2.approve(bancorNetwork.address, value, { from: sender });

            const balanceBeforeTransfer = await bntToken.balanceOf.call(affiliate);

            const path = paths.ERC2.ETH;
            await bancorNetwork.claimAndConvertFor2(path, value, MIN_RETURN, sender2, affiliate, AFFILIATE_FEE);

            const balanceAfterTransfer = await bntToken.balanceOf.call(affiliate);
            expect(balanceAfterTransfer).to.be.bignumber.gt(balanceBeforeTransfer);
        });
    });
});
