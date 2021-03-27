const { accounts, defaultSender, contract } = require('@openzeppelin/test-environment');
const { expectRevert, expectEvent, BN, constants, balance } = require('@openzeppelin/test-helpers');
const { expect } = require('../../chai-local');
const {
    NATIVE_TOKEN_ADDRESS,
    registry: {
        NETWORK_SETTINGS,
        CONVERTER_FACTORY,
        CONVERTER_REGISTRY,
        CONVERTER_REGISTRY_DATA,
        BANCOR_FORMULA,
        BANCOR_NETWORK
    }
} = require('./helpers/Constants');

const { ZERO_ADDRESS } = constants;

const ContractRegistry = contract.fromArtifact('ContractRegistry');
const BancorFormula = contract.fromArtifact('BancorFormula');
const BancorNetwork = contract.fromArtifact('BancorNetwork');
const DSToken = contract.fromArtifact('DSToken');
const ConverterRegistry = contract.fromArtifact('TestConverterRegistry');
const ConverterRegistryData = contract.fromArtifact('ConverterRegistryData');
const ConverterFactory = contract.fromArtifact('ConverterFactory');
const StandardPoolConverterFactory = contract.fromArtifact('TestStandardPoolConverterFactory');
const StandardPoolConverter = contract.fromArtifact('TestStandardPoolConverter');
const TokenHolder = contract.fromArtifact('TokenHolder');
const TokenGovernance = contract.fromArtifact('TestTokenGovernance');
const NetworkSettings = contract.fromArtifact('NetworkSettings');
const VortexBurner = contract.fromArtifact('VortexBurner');

const PPM_RESOLUTION = new BN(1_000_000);

const TKN = new BN(10).pow(new BN(18));
const RESERVE1_AMOUNT = new BN(100_000_000).mul(TKN);
const RESERVE2_AMOUNT = new BN(1_000_000).mul(TKN);
const STANDARD_CONVERTER_WEIGHTS = [500_000, 500_000];
const TOTAL_SUPPLY = new BN(1_000_000_000).mul(TKN);

describe('VortexBurner', () => {
    let contractRegistry;
    let bancorNetwork;
    let networkToken;
    let govToken;
    let govTokenGovernance;
    let converterRegistry;
    let converterRegistryData;
    let networkSettings;
    let networkFeeWallet;
    let vortex;

    const owner = defaultSender;
    const nonOwner = accounts[3];

    before(async () => {
        contractRegistry = await ContractRegistry.new();
        bancorNetwork = await BancorNetwork.new(contractRegistry.address);

        const bancorFormula = await BancorFormula.new();
        await bancorFormula.init();

        await contractRegistry.registerAddress(BANCOR_FORMULA, bancorFormula.address);
        await contractRegistry.registerAddress(BANCOR_NETWORK, bancorNetwork.address);

        networkSettings = await NetworkSettings.new(defaultSender, new BN(0));
        await contractRegistry.registerAddress(NETWORK_SETTINGS, networkSettings.address);
    });

    beforeEach(async () => {
        converterRegistry = await ConverterRegistry.new(contractRegistry.address);
        converterRegistryData = await ConverterRegistryData.new(contractRegistry.address);
        const standardPoolConverterFactory = await StandardPoolConverterFactory.new();
        const converterFactory = await ConverterFactory.new();
        await converterFactory.registerTypedConverterFactory(standardPoolConverterFactory.address);

        await contractRegistry.registerAddress(CONVERTER_FACTORY, converterFactory.address);
        await contractRegistry.registerAddress(CONVERTER_REGISTRY, converterRegistry.address);
        await contractRegistry.registerAddress(CONVERTER_REGISTRY_DATA, converterRegistryData.address);

        networkFeeWallet = await TokenHolder.new();
        await networkSettings.setNetworkFeeWallet(networkFeeWallet.address);

        networkToken = await DSToken.new('BNT', 'BNT', 18);
        await networkToken.issue(owner, TOTAL_SUPPLY);

        govToken = await DSToken.new('vBNT', 'vBNT', 18);
        await govToken.issue(owner, TOTAL_SUPPLY);

        govTokenGovernance = await TokenGovernance.new(govToken.address);
        await govToken.transferOwnership(govTokenGovernance.address);
        await govTokenGovernance.acceptTokenOwnership();

        await networkToken.issue(owner, TOTAL_SUPPLY);

        vortex = await VortexBurner.new(
            networkToken.address,
            govTokenGovernance.address,
            new BN(0),
            new BN(0),
            contractRegistry.address
        );

        await networkFeeWallet.transferOwnership(vortex.address);
        await vortex.acceptNetworkFeeOwnership();
    });

    describe('construction', () => {
        it('should be properly initialized', async () => {
            const burnIncentiveFee = await vortex.burnIncentiveFee.call();
            const incentiveFee = burnIncentiveFee[0];
            const maxIncentiveFeeAmount = burnIncentiveFee[1];
            expect(incentiveFee).to.be.bignumber.equal(new BN(0));
            expect(maxIncentiveFeeAmount).to.be.bignumber.equal(new BN(0));

            expect(await vortex.totalBurnedAmount.call()).to.be.bignumber.equal(new BN(0));
        });

        it('should revert if initialized with an invalid network token address', async () => {
            await expectRevert(
                VortexBurner.new(
                    ZERO_ADDRESS,
                    govTokenGovernance.address,
                    new BN(0),
                    new BN(0),
                    contractRegistry.address
                ),
                'ERR_INVALID_ADDRESS'
            );
        });

        it('should revert if initialized with an invalid governance token governance address', async () => {
            await expectRevert(
                VortexBurner.new(networkToken.address, ZERO_ADDRESS, new BN(0), new BN(0), contractRegistry.address),
                'ERR_INVALID_ADDRESS'
            );
        });

        it('should revert if initialized with an invalid burn incentive fee', async () => {
            await expectRevert(
                VortexBurner.new(
                    networkToken.address,
                    govTokenGovernance.address,
                    PPM_RESOLUTION.add(new BN(1)),
                    new BN(0),
                    contractRegistry.address
                ),
                'ERR_INVALID_FEE'
            );
        });

        it('should revert if initialized with an invalid contract registry address', async () => {
            await expectRevert(
                VortexBurner.new(networkToken.address, govTokenGovernance.address, new BN(0), new BN(0), ZERO_ADDRESS),
                'ERR_INVALID_ADDRESS'
            );
        });
    });

    describe('receive ETH', () => {
        it('should ETH from any address explicitly', async () => {
            const prevBalance = await balance.current(vortex.address);

            const value = new BN(1);
            await vortex.send(value);
            expect(await balance.current(vortex.address)).to.be.bignumber.equal(prevBalance.add(value));
        });
    });

    describe('network fee wallet ownership', () => {
        const newOwner = accounts[1];

        it('should allow the owner to transfer the network fee wallet ownership', async () => {
            await vortex.transferNetworkFeeWalletOwnership(newOwner);
            await networkFeeWallet.acceptOwnership({ from: newOwner });
            expect(await networkFeeWallet.owner.call()).to.be.eql(newOwner);
        });

        it('should revert when a non owner attempts to transfer the network fee wallet', async () => {
            await expectRevert(
                vortex.transferNetworkFeeWalletOwnership(newOwner, {
                    from: nonOwner
                }),
                'ERR_ACCESS_DENIED'
            );
        });

        it('should allow the vortex to accept the network fee wallet ownership', async () => {
            const newVortex = await VortexBurner.new(
                networkToken.address,
                govTokenGovernance.address,
                new BN(0),
                new BN(0),
                contractRegistry.address
            );

            await vortex.transferNetworkFeeWalletOwnership(newVortex.address);
            await newVortex.acceptNetworkFeeOwnership();
            expect(await networkFeeWallet.owner.call()).to.be.eql(newVortex.address);
        });
    });

    describe('burn incentive fee setting', () => {
        it('should allow the owner to set the burn incentive fee', async () => {
            const burnIncentiveFeeParams = await vortex.burnIncentiveFee.call();
            const prevBurnIncentiveFee = burnIncentiveFeeParams[0];
            const prevMaxBurnIncentiveFeeAmount = burnIncentiveFeeParams[1];

            const newBurnIncentiveFee = PPM_RESOLUTION;
            const newMaxBurnIncentiveFeeAmount = new BN(1000);

            const res = await vortex.setBurnIncentiveFee(newBurnIncentiveFee, newMaxBurnIncentiveFeeAmount);
            expectEvent(res, 'BurnIncentiveFeeUpdated', {
                prevBurnIncentiveFee,
                newBurnIncentiveFee,
                prevMaxBurnIncentiveFeeAmount,
                newMaxBurnIncentiveFeeAmount
            });

            const currentBurnIncentiveFeeParams = await vortex.burnIncentiveFee.call();
            const currentBurnIncentiveFee = currentBurnIncentiveFeeParams[0];
            const currentMaxBurnIncentiveAmount = currentBurnIncentiveFeeParams[1];

            expect(currentBurnIncentiveFee).to.be.bignumber.equal(newBurnIncentiveFee);
            expect(currentMaxBurnIncentiveAmount).to.be.bignumber.equal(newMaxBurnIncentiveFeeAmount);
        });

        it('should revert when a non owner attempts to set the burn incentive fee', async () => {
            await expectRevert(
                vortex.setBurnIncentiveFee(PPM_RESOLUTION, new BN(111), {
                    from: nonOwner
                }),
                'ERR_ACCESS_DENIED'
            );
        });

        it('should revert when the owner attempts set the burn incentive fee to an invalid fee', async () => {
            await expectRevert(
                vortex.setBurnIncentiveFee(PPM_RESOLUTION.add(new BN(1)), new BN(111)),
                'ERR_INVALID_FEE'
            );
        });
    });

    describe('burning event', () => {
        const TOKEN_CONVERTERS_COUNT = 5;
        const EXTERNAL_TOKENS = ['ETH', 'GOV', 'BNT'];

        const getBalance = async (token, account) => {
            const address = token.address || token;
            if (address === NATIVE_TOKEN_ADDRESS) {
                return await balance.current(account);
            }

            return await token.balanceOf.call(account);
        };

        const seedNetworkFeeWallet = async (feeAmount) => {
            // Transfer network fee balances to the network wallet.
            for (const [symbol, tokenData] of Object.entries(data)) {
                const isETH = symbol === 'ETH';
                const token = tokenData.token;

                if (isETH) {
                    await networkFeeWallet.send(feeAmount);
                } else {
                    await token.transfer(networkFeeWallet.address, feeAmount);
                }
            }
        };

        const getTokenAddresses = (testTokens) => {
            const selectedTokens = testTokens.map((symbol) => data[symbol]);
            return selectedTokens.map((tokenData) => {
                const token = tokenData.token;
                return token.address || token;
            });
        };

        let data;
        const systemTokens = EXTERNAL_TOKENS.slice();
        for (let i = 0; i < TOKEN_CONVERTERS_COUNT; i++) {
            systemTokens.push(`TKN${i + 1}`);
        }

        beforeEach(async () => {
            // Include ETH and network to governance token converter.
            data = {
                ETH: {
                    token: NATIVE_TOKEN_ADDRESS
                },
                GOV: {
                    token: govToken
                },
                BNT: {
                    token: networkToken
                }
            };

            // Create 5 token converters.
            for (const symbol of systemTokens) {
                if (EXTERNAL_TOKENS.includes(symbol)) {
                    continue;
                }

                const baseToken = await DSToken.new(symbol, symbol, 18);
                await baseToken.issue(owner, TOTAL_SUPPLY);

                data[symbol] = {
                    token: baseToken
                };
            }

            // Create converters.
            for (const [symbol, tokenData] of Object.entries(data)) {
                // Don't try to create a converter for the network token.
                if (symbol === 'BNT') {
                    continue;
                }

                const isETH = symbol === 'ETH';
                const token = tokenData.token;
                const converterName = `PT$-${symbol}`;
                const tokenAddress = isETH ? NATIVE_TOKEN_ADDRESS : token.address;

                await converterRegistry.newConverter(
                    3,
                    converterName,
                    converterName,
                    18,
                    PPM_RESOLUTION,
                    [tokenAddress, networkToken.address],
                    STANDARD_CONVERTER_WEIGHTS
                );

                const anchorCount = await converterRegistry.getAnchorCount.call();
                const poolTokenAddress = await converterRegistry.getAnchor.call(anchorCount - 1);
                const poolToken = await DSToken.at(poolTokenAddress);
                const converterAddress = await poolToken.owner.call();

                const converter = await StandardPoolConverter.at(converterAddress);

                await converter.acceptOwnership();
                await networkToken.approve(converter.address, RESERVE2_AMOUNT);

                let value = 0;
                if (isETH) {
                    value = RESERVE1_AMOUNT;
                } else {
                    await token.approve(converter.address, RESERVE1_AMOUNT);
                }

                await converter.addLiquidity(
                    [tokenAddress, networkToken.address],
                    [RESERVE1_AMOUNT, RESERVE2_AMOUNT],
                    1,
                    {
                        value
                    }
                );

                data[symbol].poolToken = poolToken;
            }
        });

        describe('successful vortex', () => {
            for (const feeAmount of [
                new BN(1_000).mul(TKN),
                new BN(10_000).mul(TKN),
                new BN(100_000).mul(TKN),
                new BN(1_000_000).mul(TKN)
            ]) {
                context(`with ${feeAmount.toString()} network fee balance per token`, () => {
                    beforeEach(async () => {
                        await seedNetworkFeeWallet(feeAmount);
                    });

                    for (const testTokens of [
                        ['ETH'],
                        ['ETH', 'GOV', 'BNT'],
                        ['ETH', 'GOV', 'BNT', 'TKN1', 'TKN2', 'TKN3', 'TKN4', 'TKN5']
                    ]) {
                        context(`with tokens: ${testTokens.join(',')}`, () => {
                            for (const burnIncentiveFeeParams of [
                                [new BN(0), new BN(0)], // No incentives
                                [new BN(200_000), new BN(0)], // 20%, capped at 0
                                [new BN(500_000), new BN(1_000).mul(TKN)] // 50%, capped at 1000 tokens
                            ]) {
                                const [burnIncentiveFee, maxBurnIncentiveFeeAmount] = burnIncentiveFeeParams;

                                context(
                                    `with ${burnIncentiveFee.toString()} burn incentive fee, capped at ${maxBurnIncentiveFeeAmount.toString()}`,
                                    () => {
                                        const getExpectedResults = async () => {
                                            const selectedTokens = testTokens.map((symbol) => data[symbol]);
                                            const tokens = [];
                                            const amounts = [];
                                            const networkTokenConversionAmounts = [];

                                            let grossNetworkTokenConversionAmount = new BN(0);
                                            let totalBurnedAmount = new BN(0);

                                            for (const tokenData of selectedTokens) {
                                                const token = tokenData.token;
                                                const poolToken = tokenData.poolToken;

                                                const tokenAddress = token.address || token;
                                                tokens.push(tokenAddress);

                                                const amount = await getBalance(token, networkFeeWallet.address);
                                                amounts.push(amount);

                                                if (tokenAddress === networkToken.address) {
                                                    // If the source token is the network token, don't try to convert it, but
                                                    // rather add its amount to the total amount to convert to the governance token.
                                                    grossNetworkTokenConversionAmount = grossNetworkTokenConversionAmount.add(
                                                        amount
                                                    );

                                                    networkTokenConversionAmounts.push(amount);
                                                } else if (tokenAddress === govToken.address) {
                                                    // if the source token is the governance token, don't try to convert it
                                                    // either, but rather include it in the amount to burn.
                                                    totalBurnedAmount = totalBurnedAmount.add(amount);

                                                    networkTokenConversionAmounts.push(new BN(0));
                                                } else {
                                                    if (tokenAddress !== NATIVE_TOKEN_ADDRESS) {
                                                        await token.approve(bancorNetwork.address, amount);
                                                    }

                                                    const targetAmount = await bancorNetwork.rateByPath.call(
                                                        [tokenAddress, poolToken.address, networkToken.address],
                                                        amount
                                                    );

                                                    networkTokenConversionAmounts.push(targetAmount);
                                                    grossNetworkTokenConversionAmount = grossNetworkTokenConversionAmount.add(
                                                        targetAmount
                                                    );
                                                }
                                            }

                                            let netNetworkTokenConversionAmount = grossNetworkTokenConversionAmount;
                                            let incentiveFeeAmount = new BN(0);
                                            if (!burnIncentiveFee.eq(new BN(0))) {
                                                incentiveFeeAmount = BN.min(
                                                    netNetworkTokenConversionAmount
                                                        .mul(burnIncentiveFee)
                                                        .div(PPM_RESOLUTION),
                                                    maxBurnIncentiveFeeAmount
                                                );

                                                netNetworkTokenConversionAmount = netNetworkTokenConversionAmount.sub(
                                                    incentiveFeeAmount
                                                );
                                            }

                                            // take into account that if one of the source tokens is the governance token -
                                            // we won't be able to use rateByPath explicitly, since it wouldn't take into
                                            // account a previous conversion.
                                            totalBurnedAmount = totalBurnedAmount.add(
                                                await bancorNetwork.rateByPath.call(
                                                    [
                                                        networkToken.address,
                                                        data.GOV.poolToken.address,
                                                        govToken.address
                                                    ],
                                                    netNetworkTokenConversionAmount
                                                )
                                            );

                                            return {
                                                tokens,
                                                amounts,
                                                networkTokenConversionAmounts,
                                                totalBurnedAmount,
                                                incentiveFeeAmount
                                            };
                                        };

                                        beforeEach(async () => {
                                            await vortex.setBurnIncentiveFee(
                                                burnIncentiveFee,
                                                maxBurnIncentiveFeeAmount
                                            );
                                        });

                                        it('should burn network fees', async () => {
                                            const selectedTokens = testTokens.map((symbol) => data[symbol]);
                                            const tokenAddresses = selectedTokens.map((tokenData) => {
                                                const token = tokenData.token;
                                                return token.address || token;
                                            });

                                            // Check that the network wallet fee balances are correct.
                                            for (const tokenData of selectedTokens) {
                                                const token = tokenData.token;
                                                expect(
                                                    await getBalance(token, networkFeeWallet.address)
                                                ).to.be.bignumber.equal(feeAmount);
                                            }

                                            const {
                                                tokens,
                                                amounts,
                                                networkTokenConversionAmounts,
                                                totalBurnedAmount,
                                                incentiveFeeAmount
                                            } = await getExpectedResults();

                                            // Check that the sender received the incentive fee.
                                            const prevNetworkTokenBalance = await getBalance(
                                                networkToken,
                                                defaultSender
                                            );

                                            // Check that available vortex query returns the correct results.
                                            const availableVortex = await vortex.availableVortex.call(tokenAddresses);
                                            const vortexAmounts = availableVortex[0];
                                            const vortexConversionAmounts = availableVortex[1];
                                            const vortexTotalBurnedAmount = availableVortex[2];
                                            const vortexIncentiveFeeAmount = availableVortex[3];

                                            // Perform the actual burn.
                                            const res = await vortex.vortex(tokenAddresses);

                                            expectEvent(res, 'Burned', {
                                                tokens,
                                                totalBurnedAmount
                                            });

                                            // Currently, there is a weird bn.js issue with the parsed return amounts, so
                                            // we'll make this check manually, for the time being.
                                            for (let i = 0; i < amounts.length; ++i) {
                                                expect(amounts[i]).to.be.bignumber.equal(res.logs[0].args.amounts[i]);
                                                expect(networkTokenConversionAmounts[i]).to.be.bignumber.equal(
                                                    vortexConversionAmounts[i]
                                                );
                                            }

                                            // Check available vortex data
                                            for (let i = 0; i < amounts.length; ++i) {
                                                expect(amounts[i]).to.be.bignumber.equal(vortexAmounts[i]);
                                                expect(networkTokenConversionAmounts[i]).to.be.bignumber.equal(
                                                    res.logs[0].args.conversionAmounts[i]
                                                );
                                            }
                                            expect(totalBurnedAmount).to.be.bignumber.equal(vortexTotalBurnedAmount);
                                            expect(incentiveFeeAmount).to.be.bignumber.equal(vortexIncentiveFeeAmount);

                                            // Check that governance tokens were actually burnt.
                                            const blockNumber = res.receipt.blockNumber;
                                            const events = await govToken.getPastEvents('Destruction', {
                                                fromBlock: blockNumber,
                                                toBlock: blockNumber
                                            });
                                            expectEvent({ logs: events }, 'Destruction', {
                                                _amount: totalBurnedAmount
                                            });

                                            // Check that the network fee wallet balances have been depleted.
                                            for (const tokenData of selectedTokens) {
                                                const token = tokenData.token;
                                                expect(
                                                    await getBalance(token, networkFeeWallet.address)
                                                ).to.be.bignumber.equal(new BN(0));
                                            }

                                            // Check that the sender received the incentive fee.
                                            expect(await getBalance(networkToken, defaultSender)).to.be.bignumber.equal(
                                                prevNetworkTokenBalance.add(incentiveFeeAmount)
                                            );

                                            // Check that no network tokens have left in the contract.
                                            expect(
                                                await getBalance(networkToken, vortex.address)
                                            ).to.be.bignumber.equal(new BN(0));

                                            // Check that no governance tokens have left in the contract.
                                            expect(await getBalance(govToken, vortex.address)).to.be.bignumber.equal(
                                                new BN(0)
                                            );

                                            // Check that the total burned stat has been increment.
                                            expect(await vortex.totalBurnedAmount.call()).to.be.bignumber.equal(
                                                totalBurnedAmount
                                            );
                                        });
                                    }
                                );
                            }
                        });
                    }
                });
            }
        });

        describe('failing vortex: 0 conversion result', () => {
            for (const feeAmount of [new BN(0), new BN(1), new BN(100)]) {
                context(`with ${feeAmount.toString()} network fee balance per token`, () => {
                    beforeEach(async () => {
                        await seedNetworkFeeWallet(feeAmount);
                    });

                    for (const testTokens of [
                        ['TKN1', 'TKN2', 'TKN3'],
                        ['ETH', 'TKN1', 'TKN2', 'GOV']
                    ]) {
                        context(`with tokens: ${testTokens.join(',')}`, () => {
                            it('should revert when attempting to burn the network fees', async () => {
                                const tokenAddresses = getTokenAddresses(testTokens);

                                await expectRevert(
                                    vortex.availableVortex.call(tokenAddresses),
                                    'ERR_ZERO_TARGET_AMOUNT'
                                );
                                await expectRevert(vortex.vortex(tokenAddresses), 'ERR_ZERO_TARGET_AMOUNT');
                            });
                        });
                    }
                });
            }
        });

        describe('failing vortex: duplicate tokens', () => {
            const FEE_AMOUNT = new BN(100_000).mul(TKN);

            beforeEach(async () => {
                await seedNetworkFeeWallet(FEE_AMOUNT);
            });

            for (const testTokens of [
                ['TKN1', 'TKN2', 'TKN3', 'BNT', 'BNT'],
                ['TKN1', 'TKN2', 'GOV', 'TKN3', 'GOV']
            ]) {
                context(`with tokens: ${testTokens.join(',')}`, () => {
                    it('should revert when attempting to burn the network fees', async () => {
                        const tokenAddresses = getTokenAddresses(testTokens);

                        await expectRevert(vortex.availableVortex.call(tokenAddresses), 'ERR_INVALID_TOKEN_LIST');
                        await expectRevert(vortex.vortex(tokenAddresses), 'ERC20: transfer amount exceeds balance');
                    });
                });
            }

            for (const testTokens of [
                ['ETH', 'ETH'],
                ['ETH', 'TKN1', 'ETH']
            ]) {
                context(`with tokens: ${testTokens.join(',')}`, () => {
                    it('should revert when attempting to burn the network fees', async () => {
                        const tokenAddresses = getTokenAddresses(testTokens);

                        await expectRevert(vortex.availableVortex.call(tokenAddresses), 'ERR_INVALID_TOKEN_LIST');
                        await expectRevert.unspecified(vortex.vortex(tokenAddresses));
                    });
                });
            }
        });

        describe('failing vortex: unsupported tokens', () => {
            const FEE_AMOUNT = new BN(100_000).mul(TKN);
            const UNSUPPORTED = 'TKN100';

            beforeEach(async () => {
                const unsupportedToken = await DSToken.new(UNSUPPORTED, UNSUPPORTED, 18);
                await unsupportedToken.issue(owner, TOTAL_SUPPLY);

                data[UNSUPPORTED] = {
                    token: unsupportedToken
                };

                await seedNetworkFeeWallet(FEE_AMOUNT);
            });

            for (const testTokens of [
                ['TKN1', 'TKN2', 'TKN3', UNSUPPORTED, 'BNT'],
                ['ETH', 'TKN2', 'GOV', 'TKN5', UNSUPPORTED]
            ]) {
                context(`with tokens: ${testTokens.join(',')}`, () => {
                    it('should revert when attempting to burn the network fees', async () => {
                        const tokenAddresses = getTokenAddresses(testTokens);

                        await expectRevert(vortex.availableVortex.call(tokenAddresses), 'ERR_INVALID_RESERVE_TOKEN');
                        await expectRevert(vortex.vortex(tokenAddresses), 'ERR_INVALID_RESERVE_TOKEN');
                    });
                });
            }
        });
    });
});
