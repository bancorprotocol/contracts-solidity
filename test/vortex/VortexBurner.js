const { expect } = require('chai');
const { BigNumber } = require('ethers');
const { ethers } = require('hardhat');

const { NATIVE_TOKEN_ADDRESS, registry, ZERO_ADDRESS } = require('../helpers/Constants');
const Contracts = require('../../components/Contracts').default;

const PPM_RESOLUTION = BigNumber.from(1_000_000);

const TKN = BigNumber.from(10).pow(BigNumber.from(18));
const RESERVE1_AMOUNT = BigNumber.from(100_000_000).mul(TKN);
const RESERVE2_AMOUNT = BigNumber.from(1_000_000).mul(TKN);
const STANDARD_CONVERTER_WEIGHTS = [500_000, 500_000];
const TOTAL_SUPPLY = BigNumber.from(1_000_000_000).mul(TKN);

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

let owner;
let newOwner;
let nonOwner;
let accounts;

describe('VortexBurner', () => {
    before(async () => {
        accounts = await ethers.getSigners();

        owner = accounts[0];
        newOwner = accounts[1];
        nonOwner = accounts[3];

        contractRegistry = await Contracts.ContractRegistry.deploy();
        bancorNetwork = await Contracts.BancorNetwork.deploy(contractRegistry.address);

        await contractRegistry.registerAddress(registry.BANCOR_NETWORK, bancorNetwork.address);

        networkSettings = await Contracts.NetworkSettings.deploy(owner.address, BigNumber.from(0));
        await contractRegistry.registerAddress(registry.NETWORK_SETTINGS, networkSettings.address);
    });

    beforeEach(async () => {
        converterRegistry = await Contracts.TestConverterRegistry.deploy(contractRegistry.address);
        converterRegistryData = await Contracts.ConverterRegistryData.deploy(contractRegistry.address);
        const standardPoolConverterFactory = await Contracts.TestStandardPoolConverterFactory.deploy();
        const converterFactory = await Contracts.ConverterFactory.deploy();
        await converterFactory.registerTypedConverterFactory(standardPoolConverterFactory.address);

        await contractRegistry.registerAddress(registry.CONVERTER_FACTORY, converterFactory.address);
        await contractRegistry.registerAddress(registry.CONVERTER_REGISTRY, converterRegistry.address);
        await contractRegistry.registerAddress(registry.CONVERTER_REGISTRY_DATA, converterRegistryData.address);

        networkFeeWallet = await Contracts.TokenHolder.deploy();
        await networkSettings.setNetworkFeeWallet(networkFeeWallet.address);

        networkToken = await Contracts.DSToken.deploy('BNT', 'BNT', 18);
        await networkToken.issue(owner.address, TOTAL_SUPPLY);

        govToken = await Contracts.DSToken.deploy('vBNT', 'vBNT', 18);
        await govToken.issue(owner.address, TOTAL_SUPPLY);

        govTokenGovernance = await Contracts.TestTokenGovernance.deploy(govToken.address);
        await govToken.transferOwnership(govTokenGovernance.address);
        await govTokenGovernance.acceptTokenOwnership();

        await networkToken.issue(owner.address, TOTAL_SUPPLY);

        vortex = await Contracts.VortexBurner.deploy(
            networkToken.address,
            govTokenGovernance.address,
            contractRegistry.address
        );

        await networkFeeWallet.transferOwnership(vortex.address);
        await vortex.acceptNetworkFeeOwnership();
    });

    describe('construction', () => {
        it('should be properly initialized', async () => {
            const burnReward = await vortex.burnReward();
            const reward = burnReward[0];
            const maxRewardAmount = burnReward[1];
            expect(reward).to.equal(BigNumber.from(0));
            expect(maxRewardAmount).to.equal(BigNumber.from(0));

            expect(await vortex.totalBurnedAmount()).to.equal(BigNumber.from(0));
        });

        it('should revert if initialized with an invalid network token address', async () => {
            await expect(
                Contracts.VortexBurner.deploy(ZERO_ADDRESS, govTokenGovernance.address, contractRegistry.address)
            ).to.be.revertedWith('ERR_INVALID_ADDRESS');
        });

        it('should revert if initialized with an invalid governance token governance address', async () => {
            await expect(
                Contracts.VortexBurner.deploy(networkToken.address, ZERO_ADDRESS, contractRegistry.address)
            ).to.be.revertedWith('ERR_INVALID_ADDRESS');
        });

        it('should revert if initialized with an invalid contract registry address', async () => {
            await expect(
                Contracts.VortexBurner.deploy(networkToken.address, govTokenGovernance.address, ZERO_ADDRESS)
            ).to.be.revertedWith('ERR_INVALID_ADDRESS');
        });
    });

    describe('receive ETH', () => {
        it('should ETH from any address explicitly', async () => {
            const prevBalance = await ethers.provider.getBalance(vortex.address);

            const value = BigNumber.from(1);
            await accounts[9].sendTransaction({ to: vortex.address, value: value });
            expect(await ethers.provider.getBalance(vortex.address)).to.equal(prevBalance.add(value));
        });
    });

    describe('network fee wallet ownership', () => {
        it('should allow the owner to transfer the network fee wallet ownership', async () => {
            await vortex.transferNetworkFeeWalletOwnership(newOwner.address);
            await networkFeeWallet.connect(newOwner).acceptOwnership();
            expect(await networkFeeWallet.owner()).to.equal(newOwner.address);
        });

        it('should revert when a non owner attempts to transfer the network fee wallet', async () => {
            await expect(
                vortex.connect(nonOwner).transferNetworkFeeWalletOwnership(newOwner.address)
            ).to.be.revertedWith('ERR_ACCESS_DENIED');
        });

        it('should allow the vortex to accept the network fee wallet ownership', async () => {
            const newVortex = await Contracts.VortexBurner.deploy(
                networkToken.address,
                govTokenGovernance.address,
                contractRegistry.address
            );

            await vortex.transferNetworkFeeWalletOwnership(newVortex.address);
            await newVortex.acceptNetworkFeeOwnership();
            expect(await networkFeeWallet.owner()).to.equal(newVortex.address);
        });
    });

    describe('burn reward setting', () => {
        it('should allow the owner to set the burn reward', async () => {
            const burnRewardParams = await vortex.burnReward();
            const prevBurnReward = burnRewardParams[0];
            const prevMaxBurnRewardAmount = burnRewardParams[1];

            const newBurnReward = PPM_RESOLUTION;
            const newMaxBurnRewardAmount = BigNumber.from(1000);

            const res = await vortex.setBurnReward(newBurnReward, newMaxBurnRewardAmount);
            expect(res)
                .emit(vortex, 'BurnRewardUpdated')
                .withArgs(prevBurnReward, newBurnReward, prevMaxBurnRewardAmount, newMaxBurnRewardAmount);

            const currentBurnRewardParams = await vortex.burnReward();
            const currentBurnReward = currentBurnRewardParams[0];
            const currentMaxBurnRewardAmount = currentBurnRewardParams[1];

            expect(currentBurnReward).to.equal(newBurnReward);
            expect(currentMaxBurnRewardAmount).to.equal(newMaxBurnRewardAmount);
        });

        it('should revert when a non owner attempts to set the burn reward', async () => {
            await expect(
                vortex.connect(nonOwner).setBurnReward(PPM_RESOLUTION, BigNumber.from(111))
            ).to.be.revertedWith('ERR_ACCESS_DENIED');
        });

        it('should revert when the owner attempts set the burn reward to an invalid fee', async () => {
            await expect(
                vortex.setBurnReward(PPM_RESOLUTION.add(BigNumber.from(1)), BigNumber.from(111))
            ).to.be.revertedWith('ERR_INVALID_FEE');
        });
    });

    describe('burning event', () => {
        const TOKEN_CONVERTERS_COUNT = 5;
        const EXTERNAL_TOKENS = ['ETH', 'GOV', 'BNT'];

        const getBalance = async (token, account) => {
            const address = token.address || token;
            if (address === NATIVE_TOKEN_ADDRESS) {
                return await ethers.provider.getBalance(account);
            }

            return await token.balanceOf(account);
        };

        const seedNetworkFeeWallet = async (feeAmount) => {
            // Transfer network fee balances to the network wallet.
            for (const [symbol, tokenData] of Object.entries(data)) {
                const isETH = symbol === 'ETH';
                const token = tokenData.token;

                if (isETH) {
                    await accounts[9].sendTransaction({ to: networkFeeWallet.address, value: feeAmount });
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

                const baseToken = await Contracts.DSToken.deploy(symbol, symbol, 18);
                await baseToken.issue(owner.address, TOTAL_SUPPLY);

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

                const anchorCount = await converterRegistry.getAnchorCount();
                const poolTokenAddress = await converterRegistry.getAnchor(anchorCount - 1);
                const poolToken = await Contracts.DSToken.attach(poolTokenAddress);
                const converterAddress = await poolToken.owner();

                const converter = await Contracts.TestStandardPoolConverter.attach(converterAddress);

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

        describe('successful burn', () => {
            for (const feeAmount of [
                BigNumber.from(1_000).mul(TKN),
                BigNumber.from(10_000).mul(TKN),
                BigNumber.from(100_000).mul(TKN),
                BigNumber.from(1_000_000).mul(TKN)
            ]) {
                context(`with ${feeAmount.toString()} network fee balance per token`, () => {
                    beforeEach(async () => {
                        await seedNetworkFeeWallet(feeAmount);
                    });

                    for (const testTokens of [
                        ['ETH'],
                        ['GOV'],
                        ['BNT'],
                        ['ETH', 'GOV', 'BNT'],
                        ['ETH', 'GOV', 'BNT', 'TKN1', 'TKN2', 'TKN3', 'TKN4', 'TKN5']
                    ]) {
                        context(`with tokens: ${testTokens.join(',')}`, () => {
                            for (const burnRewardParams of [
                                [BigNumber.from(0), BigNumber.from(0)], // No rewards
                                [BigNumber.from(200_000), BigNumber.from(0)], // 20%, capped at 0
                                [BigNumber.from(500_000), BigNumber.from(1_000).mul(TKN)] // 50%, capped at 1000 tokens
                            ]) {
                                const [burnReward, maxBurnRewardAmount] = burnRewardParams;

                                context(
                                    `with ${burnReward.toString()} burn reward, capped at ${maxBurnRewardAmount.toString()}`,
                                    () => {
                                        const getExpectedResults = async () => {
                                            const selectedTokens = testTokens.map((symbol) => data[symbol]);
                                            const convertibleTokens = [];
                                            const amounts = [];
                                            const networkTokenConversionAmounts = [];

                                            let grossNetworkTokenConversionAmount = BigNumber.from(0);
                                            let totalBurnedAmount = BigNumber.from(0);

                                            for (const tokenData of selectedTokens) {
                                                const token = tokenData.token;
                                                const poolToken = tokenData.poolToken;

                                                const tokenAddress = token.address || token;

                                                const amount = await getBalance(token, networkFeeWallet.address);
                                                amounts.push(amount);

                                                if (tokenAddress === networkToken.address) {
                                                    // If the source token is the network token, don't try to convert it, but
                                                    // rather add its amount to the total amount to convert to the governance token.
                                                    grossNetworkTokenConversionAmount =
                                                        grossNetworkTokenConversionAmount.add(amount);
                                                } else if (tokenAddress === govToken.address) {
                                                    // if the source token is the governance token, don't try to convert it
                                                    // either, but rather include it in the amount to burn.
                                                    totalBurnedAmount = totalBurnedAmount.add(amount);
                                                } else {
                                                    convertibleTokens.push(tokenAddress);
                                                    if (tokenAddress !== NATIVE_TOKEN_ADDRESS) {
                                                        await token.approve(bancorNetwork.address, amount);
                                                    }

                                                    const targetAmount = await bancorNetwork.rateByPath(
                                                        [tokenAddress, poolToken.address, networkToken.address],
                                                        amount
                                                    );

                                                    networkTokenConversionAmounts.push(targetAmount);
                                                    grossNetworkTokenConversionAmount =
                                                        grossNetworkTokenConversionAmount.add(targetAmount);
                                                }
                                            }

                                            let netNetworkTokenConversionAmount = grossNetworkTokenConversionAmount;
                                            let burnRewardAmount = BigNumber.from(0);
                                            if (!burnReward.eq(BigNumber.from(0))) {
                                                burnRewardAmount = BigNumber.min(
                                                    netNetworkTokenConversionAmount.mul(burnReward).div(PPM_RESOLUTION),
                                                    maxBurnRewardAmount
                                                );

                                                netNetworkTokenConversionAmount =
                                                    netNetworkTokenConversionAmount.sub(burnRewardAmount);
                                            }

                                            // take into account that if one of the source tokens is the governance token -
                                            // we won't be able to use rateByPath explicitly, since it wouldn't take into
                                            // account a previous conversion.
                                            totalBurnedAmount = totalBurnedAmount.add(
                                                await bancorNetwork.rateByPath(
                                                    [
                                                        networkToken.address,
                                                        data.GOV.poolToken.address,
                                                        govToken.address
                                                    ],
                                                    netNetworkTokenConversionAmount
                                                )
                                            );

                                            return {
                                                convertibleTokens,
                                                amounts,
                                                networkTokenConversionAmounts,
                                                grossNetworkTokenConversionAmount,
                                                totalBurnedAmount,
                                                burnRewardAmount
                                            };
                                        };

                                        beforeEach(async () => {
                                            await vortex.setBurnReward(burnReward, maxBurnRewardAmount);
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
                                                expect(await getBalance(token, networkFeeWallet.address)).to.equal(
                                                    feeAmount
                                                );
                                            }

                                            const {
                                                convertibleTokens,
                                                amounts,
                                                networkTokenConversionAmounts,
                                                grossNetworkTokenConversionAmount,
                                                totalBurnedAmount,
                                                burnRewardAmount
                                            } = await getExpectedResults();

                                            // Check that the sender received the reward.
                                            const prevNetworkTokenBalance = await getBalance(
                                                networkToken,
                                                owner.address
                                            );

                                            // Perform the actual burn.
                                            const res = await vortex.burn(tokenAddresses);

                                            await expect(res)
                                                .to.emit(vortex, 'Burned')
                                                .withArgs(
                                                    tokenAddresses,
                                                    grossNetworkTokenConversionAmount,
                                                    totalBurnedAmount
                                                );

                                            const tx = await res.wait();
                                            let events = await vortex.queryFilter(
                                                'Converted',
                                                tx.blockNumber,
                                                tx.blockNumber
                                            );

                                            for (let i = 0; i < convertibleTokens.length; ++i) {
                                                expect(events[i].args.reserveToken).to.equal(convertibleTokens[i]);
                                                expect(events[i].args.sourceAmount).to.equal(amounts[i]);
                                                expect(events[i].args.targetAmount).to.equal(
                                                    networkTokenConversionAmounts[i]
                                                );
                                            }

                                            // Check that governance tokens were actually burned.
                                            const blockNumber = tx.blockNumber;
                                            events = await govToken.queryFilter(
                                                'Destruction',
                                                blockNumber,
                                                blockNumber
                                            );
                                            expect(events[0].args.amount).to.equal(totalBurnedAmount);

                                            // Check that the network fee wallet balances have been depleted.
                                            for (const tokenData of selectedTokens) {
                                                const token = tokenData.token;
                                                expect(await getBalance(token, networkFeeWallet.address)).to.equal(
                                                    BigNumber.from(0)
                                                );
                                            }

                                            // Check that the sender received the reward.
                                            expect(await getBalance(networkToken, owner.address)).to.equal(
                                                prevNetworkTokenBalance.add(burnRewardAmount)
                                            );

                                            // Check that no network tokens have left in the contract.
                                            expect(await getBalance(networkToken, vortex.address)).to.equal(
                                                BigNumber.from(0)
                                            );

                                            // Check that no governance tokens have left in the contract.
                                            expect(await getBalance(govToken, vortex.address)).to.equal(
                                                BigNumber.from(0)
                                            );

                                            // Check that the total burned stat has been increment.
                                            expect(await vortex.totalBurnedAmount()).to.equal(totalBurnedAmount);
                                        });
                                    }
                                );
                            }
                        });
                    }
                });
            }
        });

        it('failing burn: 0 governance tokens to burn', async () => {
            await seedNetworkFeeWallet(BigNumber.from(0));
            const tokenAddresses = getTokenAddresses(['GOV']);

            await expect(vortex.burn(tokenAddresses)).to.be.revertedWith('ERR_ZERO_BURN_AMOUNT');
        });

        describe('failing burn: 0 conversion result', () => {
            for (const feeAmount of [BigNumber.from(1), BigNumber.from(100)]) {
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

                                await expect(vortex.burn(tokenAddresses)).to.be.revertedWith('ERR_ZERO_TARGET_AMOUNT');
                            });
                        });
                    }
                });
            }
        });

        describe('failing burn: duplicate tokens', () => {
            const FEE_AMOUNT = BigNumber.from(100_000).mul(TKN);

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

                        await expect(vortex.burn(tokenAddresses)).to.be.revertedWith(
                            'ERC20: transfer amount exceeds balance'
                        );
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

                        await expect(vortex.burn(tokenAddresses)).to.be.reverted;
                    });
                });
            }
        });

        describe('failing burn: unsupported tokens', () => {
            const FEE_AMOUNT = BigNumber.from(100_000).mul(TKN);
            const UNSUPPORTED = 'TKN100';

            beforeEach(async () => {
                const unsupportedToken = await Contracts.DSToken.deploy(UNSUPPORTED, UNSUPPORTED, 18);
                await unsupportedToken.issue(owner.address, TOTAL_SUPPLY);

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

                        await expect(vortex.burn(tokenAddresses)).to.be.revertedWith('ERR_INVALID_RESERVE_TOKEN');
                    });
                });
            }
        });
    });
});
