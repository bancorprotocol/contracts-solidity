import { ethers } from 'hardhat';
import { expect } from 'chai';
import { BigNumber } from 'ethers';

import MathUtils from './helpers/MathUtils';
import Utils from './helpers/Utils';
import Constants from './helpers/Constants';

import Contracts from './helpers/Contracts';

let now: any;
let bancorNetwork: any;
let networkSettings: any;
let token: any;
let tokenAddress: any;
let contractRegistry: any;
let reserveToken: any;
let reserveToken2: any;
let upgrader: any;
let sender: any;
let sender2: any;
let networkFeeWallet: any;
let accounts: any;

const MIN_RETURN = BigNumber.from(1);

describe('StandardPoolConverter', () => {
    const createConverter = async (
        tokenAddress: any,
        registryAddress = contractRegistry.address,
        maxConversionFee = 0
    ) => {
        return await Contracts.TestStandardPoolConverter.deploy(tokenAddress, registryAddress, maxConversionFee);
    };

    const initConverter = async (activate: any, isETHReserve: any, maxConversionFee = 0) => {
        token = await Contracts.DSToken.deploy('Token1', 'TKN1', 2);
        tokenAddress = token.address;

        const converter = await createConverter(tokenAddress, contractRegistry.address, maxConversionFee);
        await converter.addReserve(getReserve1Address(isETHReserve), 500000);
        await converter.addReserve(reserveToken2.address, 500000);
        await reserveToken2.transfer(converter.address, 8000);
        await token.issue(sender.address, 20000);

        if (isETHReserve) {
            await sender.sendTransaction({ to: converter.address, value: 5000 });
        } else {
            await reserveToken.transfer(converter.address, 5000);
        }

        if (activate) {
            await token.transferOwnership(converter.address);
            await converter.acceptTokenOwnership();
        }

        now = await Utils.latest();
        await converter.setTime(now);

        return converter;
    };

    const removeLiquidityTest = async (poolTokenAmount: any, reserveTokens: any) => {
        const inputAmount = BigNumber.from(poolTokenAmount);
        const converter = await initConverter(true, false);
        const poolTokenSupply = await token.totalSupply();
        const reserveBalances = await Promise.all(
            reserveTokens.map((reserveToken: any) => converter.reserveBalance(reserveToken.address))
        );
        const expectedOutputAmounts = reserveBalances.map((reserveBalance: any) =>
            reserveBalance.mul(inputAmount).div(poolTokenSupply)
        );
        await converter.removeLiquidityTest(
            inputAmount,
            reserveTokens.map((reserveToken: any) => reserveToken.address),
            [MIN_RETURN, MIN_RETURN]
        );
        const actualOutputAmounts = await Promise.all(
            reserveTokens.map((reserveToken: any, i: any) => converter.reserveAmountsRemoved(i))
        );
        reserveTokens.map((reserveToken: any, i: any) =>
            expect(actualOutputAmounts[i]).to.be.equal(expectedOutputAmounts[i])
        );
    };

    const getReserve1Address = (isETH: any) => {
        return isETH ? Constants.NATIVE_TOKEN_ADDRESS : reserveToken.address;
    };

    const getBalance = async (token: any, address: any, account: any) => {
        if (address === Constants.NATIVE_TOKEN_ADDRESS) {
            return ethers.provider.getBalance(account);
        }

        return token.balanceOf(account);
    };

    const getTransactionCost = async (txResult: any) => {
        const cumulativeGasUsed = (await txResult.wait()).cumulativeGasUsed;
        return BigNumber.from(txResult.gasPrice).mul(BigNumber.from(cumulativeGasUsed));
    };

    const convert = async (path: any, amount: any, minReturn: any, options = {}) => {
        return bancorNetwork.convertByPath2(path, amount, minReturn, ethers.constants.AddressZero, options);
    };

    const expectAlmostEqual = (amount1: any, amount2: any, maxError: any) => {
        if (!amount1.eq(amount2)) {
            const error = new MathUtils.Decimal(amount1.toString()).div(amount2.toString()).sub(1).abs();
            expect(error.lte(maxError)).to.be.true;
        }
    };

    before(async () => {
        accounts = await ethers.getSigners();

        sender = accounts[0];
        sender2 = accounts[9];
        networkFeeWallet = accounts[1];

        // The following contracts are unaffected by the underlying tests, this can be shared.
        contractRegistry = await Contracts.ContractRegistry.deploy();

        const factory = await Contracts.ConverterFactory.deploy();
        await contractRegistry.registerAddress(Constants.registry.CONVERTER_FACTORY, factory.address);

        networkSettings = await Contracts.NetworkSettings.deploy(networkFeeWallet.address, 0);
        await contractRegistry.registerAddress(Constants.registry.NETWORK_SETTINGS, networkSettings.address);

        await factory.registerTypedConverterFactory((await Contracts.StandardPoolConverterFactory.deploy()).address);
    });

    beforeEach(async () => {
        bancorNetwork = await Contracts.BancorNetwork.deploy(contractRegistry.address);
        await contractRegistry.registerAddress(Constants.registry.BANCOR_NETWORK, bancorNetwork.address);

        upgrader = await Contracts.ConverterUpgrader.deploy(contractRegistry.address);
        await contractRegistry.registerAddress(Constants.registry.CONVERTER_UPGRADER, upgrader.address);

        const token = await Contracts.DSToken.deploy('Token1', 'TKN1', 2);
        tokenAddress = token.address;

        reserveToken = await Contracts.TestStandardToken.deploy('ERC Token 1', 'ERC1', 18, 1000000000);
        reserveToken2 = await Contracts.TestNonStandardToken.deploy('ERC Token 2', 'ERC2', 18, 2000000000);
    });

    it('verifies the Activation event after converter activation', async () => {
        const converter = await initConverter(false, false);
        await token.transferOwnership(converter.address);
        const res = await converter.acceptTokenOwnership();

        expect(res).to.emit(converter, 'Activation').withArgs(BigNumber.from(3), tokenAddress, true);
    });

    it('verifies the TokenRateUpdate event after adding liquidity', async () => {
        const converter = await initConverter(true, false);
        const value = BigNumber.from(500);
        await reserveToken.connect(sender).approve(converter.address, value);
        await reserveToken2.connect(sender).approve(converter.address, value);

        const res = await converter['addLiquidity(address[],uint256[],uint256)'](
            [reserveToken.address, reserveToken2.address],
            [value, value],
            MIN_RETURN
        );

        const poolTokenSupply = await token.totalSupply();
        const reserve1Balance = await converter.reserveBalance(reserveToken.address);
        const reserve2Balance = await converter.reserveBalance(reserveToken2.address);

        expect(res)
            .to.emit(converter, 'TokenRateUpdate')
            .withArgs(tokenAddress, reserveToken.address, reserve1Balance, poolTokenSupply);

        expect(res)
            .to.emit(converter, 'TokenRateUpdate')
            .withArgs(tokenAddress, reserveToken2.address, reserve2Balance, poolTokenSupply);
    });

    it('verifies the TokenRateUpdate event after removing liquidity', async () => {
        const converter = await initConverter(true, false);

        const res = await converter['removeLiquidity(uint256,address[],uint256[])'](
            100,
            [reserveToken.address, reserveToken2.address],
            [MIN_RETURN, MIN_RETURN]
        );

        const poolTokenSupply = await token.totalSupply();
        const reserve1Balance = await converter.reserveBalance(reserveToken.address);
        await converter.reserveWeight(reserveToken.address);
        const reserve2Balance = await converter.reserveBalance(reserveToken2.address);
        await converter.reserveWeight(reserveToken2.address);

        expect(res)
            .to.emit(converter, 'TokenRateUpdate')
            .withArgs(tokenAddress, reserveToken.address, reserve1Balance, poolTokenSupply);

        expect(res)
            .to.emit(converter, 'TokenRateUpdate')
            .withArgs(tokenAddress, reserveToken2.address, reserve2Balance, poolTokenSupply);
    });

    it('verifies function removeLiquidity when the reserves tokens are passed in the initial order', async () => {
        await removeLiquidityTest(100, [reserveToken, reserveToken2]);
    });

    it('verifies function removeLiquidity when the reserves tokens are passed in the opposite order', async () => {
        await removeLiquidityTest(100, [reserveToken2, reserveToken]);
    });

    for (const amount of [0, 500, 1234, 5678, 9999, 12345, 98765]) {
        for (const fee of [0, 1000, 2000, 3000, 6000, 9999, 12345]) {
            it(`verifies function sourceAmountAndFee(${amount}) when fee = ${fee}`, async () => {
                const converter = await initConverter(true, true, 1000000);
                await converter.setConversionFee(fee);

                const targetAmountAndFee = await converter.targetAmountAndFee(
                    getReserve1Address(true),
                    reserveToken2.address,
                    amount
                );

                const sourceAmountAndFee = await converter.sourceAmountAndFee(
                    getReserve1Address(true),
                    reserveToken2.address,
                    targetAmountAndFee[0]
                );

                const targetAmountAndFee2 = await converter.targetAmountAndFee(
                    getReserve1Address(true),
                    reserveToken2.address,
                    sourceAmountAndFee[0]
                );

                expectAlmostEqual(sourceAmountAndFee[0], BigNumber.from(amount), '0.0014');
                expect(sourceAmountAndFee[1]).to.be.gte(targetAmountAndFee[1]);
                expect(sourceAmountAndFee[1]).to.be.lte(targetAmountAndFee[1].add(1));
                expect(targetAmountAndFee2[0]).to.be.equal(targetAmountAndFee[0]);
                expect(targetAmountAndFee2[1]).to.be.equal(sourceAmountAndFee[1]);
            });
        }
    }

    for (const amount of [0, 500, 1234, 5678, 7890]) {
        for (const fee of [0, 1000, 2000, 3456, 6789]) {
            it(`verifies function sourceAmountAndFee(${amount}) when fee = ${fee}`, async () => {
                const converter = await initConverter(true, true, 1000000);
                await converter.setConversionFee(fee);

                const sourceAmountAndFee = await converter.sourceAmountAndFee(
                    getReserve1Address(true),
                    reserveToken2.address,
                    amount
                );

                const targetAmountAndFee = await converter.targetAmountAndFee(
                    getReserve1Address(true),
                    reserveToken2.address,
                    sourceAmountAndFee[0]
                );

                expectAlmostEqual(targetAmountAndFee[0], BigNumber.from(amount), '0.002');
                expect(targetAmountAndFee[0]).to.be.gte(BigNumber.from(amount));
                expect(targetAmountAndFee[1]).to.be.gte(sourceAmountAndFee[1]);
                expect(targetAmountAndFee[1]).to.be.lte(sourceAmountAndFee[1].add(1));
            });
        }
    }

    for (let isETHReserve = 0; isETHReserve < 2; isETHReserve++) {
        describe(`${isETHReserve === 0 ? '(with ERC20 reserves)' : '(with ETH reserve)'}:`, () => {
            it('verifies that convert returns valid amount and fee after converting', async () => {
                const converter = await initConverter(true, isETHReserve, 5000);
                await converter.setConversionFee(3000);

                const amount = BigNumber.from(500);
                let value = BigNumber.from(0);
                if (isETHReserve) {
                    value = amount;
                } else {
                    await reserveToken.connect(sender).approve(bancorNetwork.address, amount);
                }

                const purchaseAmount = (
                    await converter.targetAmountAndFee(getReserve1Address(isETHReserve), reserveToken2.address, amount)
                )[0];
                const res = await convert(
                    [getReserve1Address(isETHReserve), tokenAddress, reserveToken2.address],
                    amount,
                    MIN_RETURN,
                    { value: value }
                );
                expect(res)
                    .to.emit(bancorNetwork, 'Conversion')
                    .withArgs(
                        token.address,
                        getReserve1Address(isETHReserve),
                        reserveToken2.address,
                        amount,
                        purchaseAmount,
                        sender.address
                    );
            });

            it('verifies the TokenRateUpdate event after conversion', async () => {
                const converter = await initConverter(true, isETHReserve, 10000);
                await converter.setConversionFee(6000);

                const amount = BigNumber.from(500);
                let value = BigNumber.from(0);
                if (isETHReserve) {
                    value = amount;
                } else {
                    await reserveToken.connect(sender).approve(bancorNetwork.address, amount);
                }

                const res = await convert(
                    [getReserve1Address(isETHReserve), tokenAddress, reserveToken2.address],
                    amount,
                    MIN_RETURN,
                    { value: value }
                );

                const poolTokenSupply = await token.totalSupply();
                const reserve1Balance = await converter.reserveBalance(getReserve1Address(isETHReserve));
                const reserve2Balance = await converter.reserveBalance(reserveToken2.address);

                const events = await converter.queryFilter('TokenRateUpdate', res.blockNumber, res.blockNumber);

                // TokenRateUpdate for [source, target):
                const { args: event1 } = events[0];
                expect(event1._token1).to.eql(getReserve1Address(isETHReserve));
                expect(event1._token2).to.eql(reserveToken2.address);
                expect(event1._rateN).to.be.equal(reserve2Balance);
                expect(event1._rateD).to.be.equal(reserve1Balance);

                // TokenRateUpdate for [source, pool token):
                const { args: event2 } = events[1];
                expect(event2._token1).to.eql(tokenAddress);
                expect(event2._token2).to.eql(getReserve1Address(isETHReserve));
                expect(event2._rateN).to.be.equal(reserve1Balance);
                expect(event2._rateD).to.be.equal(poolTokenSupply);

                // TokenRateUpdate for [pool token, target):
                const { args: event3 } = events[2];
                expect(event3._token1).to.eql(tokenAddress);
                expect(event3._token2).to.eql(reserveToken2.address);
                expect(event3._rateN).to.be.equal(reserve2Balance);
                expect(event3._rateD).to.be.equal(poolTokenSupply);
            });

            it('should revert when attempting to convert when the return is smaller than the minimum requested amount', async () => {
                await initConverter(true, isETHReserve);

                const amount = BigNumber.from(500);
                let value = BigNumber.from(0);
                if (isETHReserve) {
                    value = amount;
                } else {
                    await reserveToken.connect(sender).approve(bancorNetwork.address, amount);
                }

                await expect(
                    convert([getReserve1Address(isETHReserve), tokenAddress, reserveToken2.address], amount, 200000, {
                        value
                    })
                ).to.be.revertedWith('ERR_RETURN_TOO_LOW');
            });

            it('verifies that addLiquidity gets the correct reserve balance amounts from the caller', async () => {
                const converter = await initConverter(false, isETHReserve);

                await token.transferOwnership(converter.address);
                await converter.acceptTokenOwnership();

                await reserveToken.transfer(sender2.address, 5000);
                await reserveToken2.transfer(sender2.address, 5000);

                const supply = await token.totalSupply();
                const percentage = BigNumber.from(19);
                const prevReserve1Balance = await converter.reserveBalance(getReserve1Address(isETHReserve));
                const prevReserve2Balance = await converter.reserveBalance(reserveToken2.address);
                const token1Amount = MathUtils.divCeil(prevReserve1Balance.mul(percentage), supply);
                const token2Amount = MathUtils.divCeil(prevReserve2Balance.mul(percentage), supply);

                const amount = BigNumber.from(100000);
                let value = BigNumber.from(0);
                if (isETHReserve) {
                    value = amount;
                } else {
                    await reserveToken.connect(sender2).approve(converter.address, amount);
                }

                await reserveToken2.connect(sender2).approve(converter.address, amount);
                await converter
                    .connect(sender2)
                    ['addLiquidity(address[],uint256[],uint256)'](
                        [getReserve1Address(isETHReserve), reserveToken2.address],
                        [amount, token2Amount],
                        1,
                        { value: value }
                    );

                const reserve1Balance = await converter.reserveBalance(getReserve1Address(isETHReserve));
                const reserve2Balance = await converter.reserveBalance(reserveToken2.address);

                expect(reserve1Balance).to.be.equal(prevReserve1Balance.add(token1Amount));
                expect(reserve2Balance).to.be.equal(prevReserve2Balance.add(token2Amount));
            });

            it('verifies that increasing the liquidity by a large amount gets the correct reserve balance amounts from the caller', async () => {
                const converter = await initConverter(false, isETHReserve);

                await token.transferOwnership(converter.address);
                await converter.acceptTokenOwnership();

                await reserveToken.transfer(sender2.address, 500000);
                await reserveToken2.transfer(sender2.address, 500000);

                const supply = await token.totalSupply();
                const percentage = BigNumber.from(140854);
                const prevReserve1Balance = await converter.reserveBalance(getReserve1Address(isETHReserve));
                const prevReserve2Balance = await converter.reserveBalance(reserveToken2.address);
                const token1Amount = MathUtils.divCeil(prevReserve1Balance.mul(percentage), supply);
                const token2Amount = MathUtils.divCeil(prevReserve2Balance.mul(percentage), supply);

                const amount = BigNumber.from(100000);
                let value = BigNumber.from(0);
                if (isETHReserve) {
                    value = amount;
                } else {
                    await reserveToken.connect(sender2).approve(converter.address, amount);
                }

                await reserveToken2.connect(sender2).approve(converter.address, amount);
                await converter
                    .connect(sender2)
                    ['addLiquidity(address[],uint256[],uint256)'](
                        [getReserve1Address(isETHReserve), reserveToken2.address],
                        [amount, token2Amount],
                        1,
                        { value: value }
                    );

                const reserve1Balance = await converter.reserveBalance(getReserve1Address(isETHReserve));
                const reserve2Balance = await converter.reserveBalance(reserveToken2.address);

                expect(reserve1Balance).to.be.equal(prevReserve1Balance.add(token1Amount));
                expect(reserve2Balance).to.be.equal(prevReserve2Balance.add(token2Amount));
            });

            it('should revert when attempting to add liquidity with insufficient funds', async () => {
                const converter = await initConverter(false, isETHReserve);

                await token.transferOwnership(converter.address);
                await converter.acceptTokenOwnership();

                await reserveToken.transfer(sender2.address, 100);
                await reserveToken2.transfer(sender2.address, 100);

                const amount = BigNumber.from(100000);
                let value = BigNumber.from(0);
                if (isETHReserve) {
                    value = amount;
                } else {
                    await reserveToken.connect(sender2).approve(converter.address, amount);
                }

                await reserveToken2.connect(sender2).approve(converter.address, amount);
                await converter
                    .connect(sender2)
                    ['addLiquidity(address[],uint256[],uint256)'](
                        [getReserve1Address(isETHReserve), reserveToken2.address],
                        [amount, 10],
                        1,
                        {
                            value: value
                        }
                    );

                await expect(
                    converter
                        .connect(sender2)
                        ['addLiquidity(address[],uint256[],uint256)'](
                            [getReserve1Address(isETHReserve), reserveToken2.address],
                            [amount, 1000],
                            1,
                            {
                                value: value
                            }
                        )
                ).to.be.reverted;
            });

            it('verifies that addLiquidity with separate reserve balances gets the correct reserve balance amounts from the caller', async () => {
                const converter = await initConverter(false, isETHReserve);

                await token.transferOwnership(converter.address);
                await converter.acceptTokenOwnership();

                await reserveToken.transfer(sender2.address, 5000);
                await reserveToken2.transfer(sender2.address, 5000);

                const supply = await token.totalSupply();
                const percentage = BigNumber.from(19);
                const prevReserve1Balance = await converter.reserveBalance(getReserve1Address(isETHReserve));
                const prevReserve2Balance = await converter.reserveBalance(reserveToken2.address);
                const token1Amount = MathUtils.divCeil(prevReserve1Balance.mul(percentage), supply);
                const token2Amount = MathUtils.divCeil(prevReserve2Balance.mul(percentage), supply);

                const amount = BigNumber.from(100000);
                let value = BigNumber.from(0);
                if (isETHReserve) {
                    value = amount;
                } else {
                    await reserveToken.connect(sender2).approve(converter.address, amount);
                }

                await reserveToken2.connect(sender2).approve(converter.address, amount);
                await converter.connect(sender2)['addLiquidity(uint256,uint256,uint256)'](amount, token2Amount, 1, {
                    value: value
                });

                const reserve1Balance = await converter.reserveBalance(getReserve1Address(isETHReserve));
                const reserve2Balance = await converter.reserveBalance(reserveToken2.address);

                expect(reserve1Balance).to.be.equal(prevReserve1Balance.add(token1Amount));
                expect(reserve2Balance).to.be.equal(prevReserve2Balance.add(token2Amount));
            });

            it('verifies that removeLiquidity sends the correct reserve balance amounts to the caller', async () => {
                const converter = await initConverter(false, isETHReserve);

                await token.transferOwnership(converter.address);
                await converter.acceptTokenOwnership();

                await token.transfer(sender2.address, 100);

                const supply = await token.totalSupply();
                const percentage = BigNumber.from(19);
                const reserve1Balance = await converter.reserveBalance(getReserve1Address(isETHReserve));
                const reserve2Balance = await converter.reserveBalance(reserveToken2.address);
                const token1Amount = reserve1Balance.mul(percentage).div(supply);
                const token2Amount = reserve2Balance.mul(percentage).div(supply);

                const token1PrevBalance = await getBalance(
                    reserveToken,
                    getReserve1Address(isETHReserve),
                    sender2.address
                );
                const token2PrevBalance = await reserveToken2.balanceOf(sender2.address);
                const res = await converter
                    .connect(sender2)
                    ['removeLiquidity(uint256,address[],uint256[])'](
                        19,
                        [getReserve1Address(isETHReserve), reserveToken2.address],
                        [1, 1]
                    );

                let transactionCost = BigNumber.from(0);
                if (isETHReserve) {
                    transactionCost = await getTransactionCost(res);
                }

                const token1Balance = await getBalance(reserveToken, getReserve1Address(isETHReserve), sender2.address);
                const token2Balance = await reserveToken2.balanceOf(sender2.address);

                expect(token1Balance).to.be.equal(token1PrevBalance.add(token1Amount.sub(transactionCost)));
                expect(token2Balance).to.be.equal(token2PrevBalance.add(token2Amount));
            });

            it('verifies that removing a large amount of liquidity sends the correct reserve balance amounts to the caller', async () => {
                const converter = await initConverter(false, isETHReserve);

                await token.transferOwnership(converter.address);
                await converter.acceptTokenOwnership();

                await token.transfer(sender2.address, 15000);

                const supply = await token.totalSupply();
                const percentage = BigNumber.from(14854);
                const reserve1Balance = await converter.reserveBalance(getReserve1Address(isETHReserve));
                const reserve2Balance = await converter.reserveBalance(reserveToken2.address);
                const token1Amount = reserve1Balance.mul(percentage).div(supply);
                const token2Amount = reserve2Balance.mul(percentage).div(supply);

                const token1PrevBalance = await getBalance(
                    reserveToken,
                    getReserve1Address(isETHReserve),
                    sender2.address
                );
                const token2PrevBalance = await reserveToken2.balanceOf(sender2.address);

                const res = await converter
                    .connect(sender2)
                    ['removeLiquidity(uint256,address[],uint256[])'](
                        14854,
                        [getReserve1Address(isETHReserve), reserveToken2.address],
                        [1, 1]
                    );

                let transactionCost = BigNumber.from(0);
                if (isETHReserve) {
                    transactionCost = await getTransactionCost(res);
                }

                const token1Balance = await getBalance(reserveToken, getReserve1Address(isETHReserve), sender2.address);
                const token2Balance = await reserveToken2.balanceOf(sender2.address);

                expect(token1Balance).to.be.equal(token1PrevBalance.add(token1Amount.sub(transactionCost)));
                expect(token2Balance).to.be.equal(token2PrevBalance.add(token2Amount));
            });

            it('verifies that removing the entire liquidity sends the full reserve balances to the caller', async () => {
                const converter = await initConverter(false, isETHReserve);

                await token.transferOwnership(converter.address);
                await converter.acceptTokenOwnership();

                await token.transfer(sender2.address, 20000);

                const reserve1Balance = await converter.reserveBalance(getReserve1Address(isETHReserve));
                const reserve2Balance = await converter.reserveBalance(reserveToken2.address);

                const token1PrevBalance = await getBalance(
                    reserveToken,
                    getReserve1Address(isETHReserve),
                    sender2.address
                );
                const token2PrevBalance = await reserveToken2.balanceOf(sender2.address);
                const res = await converter
                    .connect(sender2)
                    ['removeLiquidity(uint256,address[],uint256[])'](
                        20000,
                        [getReserve1Address(isETHReserve), reserveToken2.address],
                        [1, 1]
                    );

                let transactionCost = BigNumber.from(0);
                if (isETHReserve) {
                    transactionCost = await getTransactionCost(res);
                }

                const supply = await token.totalSupply();
                const token1Balance = await getBalance(reserveToken, getReserve1Address(isETHReserve), sender2.address);
                const token2Balance = await reserveToken2.balanceOf(sender2.address);

                expect(supply).to.be.equal(BigNumber.from(0));
                expect(token1PrevBalance.add(reserve1Balance).sub(transactionCost)).to.be.equal(token1Balance);
                expect(token2PrevBalance.add(reserve2Balance)).to.be.equal(token2Balance);
            });

            it('should revert when attempting to remove liquidity with insufficient funds', async () => {
                const converter = await initConverter(false, isETHReserve);

                await token.transferOwnership(converter.address);
                await converter.acceptTokenOwnership();

                await token.transfer(sender2.address, 100);

                await converter
                    .connect(sender2)
                    ['removeLiquidity(uint256,address[],uint256[])'](
                        5,
                        [getReserve1Address(isETHReserve), reserveToken2.address],
                        [1, 1]
                    );

                await expect(
                    converter
                        .connect(sender2)
                        ['removeLiquidity(uint256,address[],uint256[])'](
                            600,
                            [getReserve1Address(isETHReserve), reserveToken2.address],
                            [1, 1]
                        )
                ).to.be.reverted;
            });

            it('verifies that removeLiquidity with separate minimum return args sends the correct reserve balance amounts to the caller', async () => {
                const converter = await initConverter(false, isETHReserve);

                await token.transferOwnership(converter.address);
                await converter.acceptTokenOwnership();

                await token.transfer(sender2.address, 100);

                const supply = await token.totalSupply();
                const percentage = BigNumber.from(19);
                const reserve1Balance = await converter.reserveBalance(getReserve1Address(isETHReserve));
                const reserve2Balance = await converter.reserveBalance(reserveToken2.address);
                const token1Amount = reserve1Balance.mul(percentage).div(supply);
                const token2Amount = reserve2Balance.mul(percentage).div(supply);

                const token1PrevBalance = await getBalance(
                    reserveToken,
                    getReserve1Address(isETHReserve),
                    sender2.address
                );
                const token2PrevBalance = await reserveToken2.balanceOf(sender2.address);
                const res = await converter.connect(sender2)['removeLiquidity(uint256,uint256,uint256)'](19, 1, 1);

                let transactionCost = BigNumber.from(0);
                if (isETHReserve) {
                    transactionCost = await getTransactionCost(res);
                }

                const token1Balance = await getBalance(reserveToken, getReserve1Address(isETHReserve), sender2.address);
                const token2Balance = await reserveToken2.balanceOf(sender2.address);

                expect(token1Balance).to.be.equal(token1PrevBalance.add(token1Amount.sub(transactionCost)));
                expect(token2Balance).to.be.equal(token2PrevBalance.add(token2Amount));
            });
        });
    }

    describe('verifies that the maximum possible liquidity is added', () => {
        let converter: any;
        let reserveToken1: any;
        let reserveToken2: any;

        const amounts = [
            [1000, 1200],
            [200, 240],
            [2000, 2400],
            [20000, 22000],
            [20000, 26000],
            [100000, 120000]
        ];

        beforeEach(async () => {
            const token = await Contracts.DSToken.deploy('Token', 'TKN', 0);
            converter = await Contracts.TestStandardPoolConverter.deploy(token.address, contractRegistry.address, 0);
            reserveToken1 = await Contracts.TestStandardToken.deploy('ERC Token 1', 'ERC1', 18, 1000000000);
            reserveToken2 = await Contracts.TestStandardToken.deploy('ERC Token 2', 'ERC2', 18, 1000000000);
            await converter.addReserve(reserveToken1.address, 500000);
            await converter.addReserve(reserveToken2.address, 500000);
            await token.transferOwnership(converter.address);
            await converter.acceptTokenOwnership();
        });

        for (const [amount1, amount2] of amounts) {
            it(`addLiquidity(${[amount1, amount2]})`, async () => {
                await reserveToken1.connect(sender).approve(converter.address, amount1);
                await reserveToken2.connect(sender).approve(converter.address, amount2);
                await converter['addLiquidity(address[],uint256[],uint256)'](
                    [reserveToken1.address, reserveToken2.address],
                    [amount1, amount2],
                    1
                );
                const balance1 = await reserveToken1.balanceOf(converter.address);
                const balance2 = await reserveToken2.balanceOf(converter.address);
                const a1b2 = BigNumber.from(amount1).mul(balance2);
                const a2b1 = BigNumber.from(amount2).mul(balance1);
                const expected1 = a1b2.lt(a2b1) ? BigNumber.from(0) : a1b2.sub(a2b1).div(balance2);
                const expected2 = a2b1.lt(a1b2) ? BigNumber.from(0) : a2b1.sub(a1b2).div(balance1);
                const actual1 = await reserveToken1.allowance(sender.address, converter.address);
                const actual2 = await reserveToken2.allowance(sender.address, converter.address);
                expect(actual1).to.be.equal(expected1);
                expect(actual2).to.be.equal(expected2);
            });
        }
    });

    describe('verifies no gain by adding/removing liquidity', () => {
        const addAmounts = [
            [1000, 1000],
            [1000, 2000],
            [2000, 1000]
        ];

        const removePercents = [[100], [50, 50], [25, 75], [75, 25], [10, 20, 30, 40]];

        for (const amounts of addAmounts) {
            for (const percents of removePercents) {
                it(`(amounts = ${amounts}, percents = ${percents})`, async () => {
                    const token = await Contracts.DSToken.deploy('Token', 'TKN', 0);
                    const converter = await Contracts.TestStandardPoolConverter.deploy(
                        token.address,
                        contractRegistry.address,
                        0
                    );
                    const reserveToken1 = await Contracts.TestStandardToken.deploy(
                        'ERC Token 1',
                        'ERC1',
                        18,
                        1000000000
                    );
                    const reserveToken2 = await Contracts.TestStandardToken.deploy(
                        'ERC Token 2',
                        'ERC2',
                        18,
                        1000000000
                    );
                    await converter.addReserve(reserveToken1.address, 500000);
                    await converter.addReserve(reserveToken2.address, 500000);
                    await token.transferOwnership(converter.address);
                    await converter.acceptTokenOwnership();
                    let lastAmount = BigNumber.from(0);
                    for (const amount of amounts) {
                        await reserveToken1.connect(sender).transfer(sender2.address, amount);
                        await reserveToken2.connect(sender).transfer(sender2.address, amount);
                        await reserveToken1.connect(sender2).approve(converter.address, amount);
                        await reserveToken2.connect(sender2).approve(converter.address, amount);
                        await converter
                            .connect(sender2)
                            ['addLiquidity(address[],uint256[],uint256)'](
                                [reserveToken1.address, reserveToken2.address],
                                [amount, amount],
                                MIN_RETURN
                            );
                        const balance = await token.balanceOf(sender2.address);
                        lastAmount = balance.sub(lastAmount);
                    }
                    for (const percent of percents) {
                        await converter
                            .connect(sender2)
                            ['removeLiquidity(uint256,address[],uint256[])'](
                                lastAmount.mul(BigNumber.from(percent)).div(BigNumber.from(100)),
                                [reserveToken1.address, reserveToken2.address],
                                [MIN_RETURN, MIN_RETURN]
                            );
                    }
                    const balance1 = await reserveToken1.balanceOf(sender2.address);
                    const balance2 = await reserveToken2.balanceOf(sender2.address);
                    const amount = BigNumber.from(amounts[1]);
                    expect(balance1).to.be.equal(amount);
                    expect(balance2).to.be.equal(amount);
                });
            }
        }
    });

    describe('recent average rate', () => {
        const AVERAGE_RATE_PERIOD = Utils.duration.minutes(10);

        let converter: any;
        beforeEach(async () => {
            converter = await initConverter(true, true, 5000);
        });

        const getExpectedAverageRate = (prevAverageRate: any, currentRate: any, timeElapsed: any) => {
            if (timeElapsed.eq(BigNumber.from(0))) {
                return prevAverageRate;
            }

            if (timeElapsed.gte(AVERAGE_RATE_PERIOD)) {
                return currentRate;
            }

            const newAverageRateN = prevAverageRate.n
                .mul(currentRate.d)
                .mul(AVERAGE_RATE_PERIOD.sub(timeElapsed))
                .add(prevAverageRate.d.mul(currentRate.n).mul(timeElapsed));
            const newAverageRateD = AVERAGE_RATE_PERIOD.mul(prevAverageRate.d).mul(currentRate.d);

            return { n: newAverageRateN, d: newAverageRateD };
        };

        const expectRatesAlmostEqual = (rate: any, newRate: any) => {
            const rate1 = new MathUtils.Decimal(rate.n.toString()).div(new MathUtils.Decimal(rate.d.toString()));
            const rate2 = new MathUtils.Decimal(newRate.n.toString()).div(new MathUtils.Decimal(newRate.d.toString()));

            if (!rate1.eq(rate2)) {
                const error = new MathUtils.Decimal(rate1.toString()).div(rate2.toString()).sub(1).abs();
                expect(error.lte('0.000002')).to.be.true;
            }
        };

        const getCurrentRate = async (reserve1Address: any, reserve2Address: any) => {
            const balance1 = await converter.reserveBalance(reserve1Address);
            const balance2 = await converter.reserveBalance(reserve2Address);
            return { n: balance2, d: balance1 };
        };

        const getAverageRate = async (reserveAddress: any) => {
            const averageRate = await converter.recentAverageRate(reserveAddress);
            return { n: averageRate[0], d: averageRate[1] };
        };

        const getPrevAverageRate = async () => {
            const averageRateInfo = await converter.averageRateInfo();
            return { n: averageRateInfo.shr(112).mask(112), d: averageRateInfo.mask(112) };
        };

        const getPrevAverageRateUpdateTime = async () => {
            const averageRateInfo = await converter.averageRateInfo();
            return averageRateInfo.shr(224);
        };

        it('should revert when requesting the average rate for a non reserve token', async () => {
            await expect(converter.recentAverageRate(accounts[7].address)).to.be.revertedWith('ERR_INVALID_RESERVE');
        });

        it('should be initially equal to the current rate', async () => {
            const averageRate = await getAverageRate(Constants.NATIVE_TOKEN_ADDRESS);
            const currentRate = await getCurrentRate(Constants.NATIVE_TOKEN_ADDRESS, reserveToken2.address);
            const prevAverageRateUpdateTime = await getPrevAverageRateUpdateTime();

            expect(averageRate.n).to.be.equal(currentRate.n);
            expect(averageRate.d).to.be.equal(currentRate.d);
            expect(prevAverageRateUpdateTime).to.be.equal(BigNumber.from(0));
        });

        it('should change after a conversion', async () => {
            const amount = BigNumber.from(500);

            await convert([Constants.NATIVE_TOKEN_ADDRESS, tokenAddress, reserveToken2.address], amount, MIN_RETURN, {
                value: amount
            });
            const prevAverageRate = await getAverageRate(Constants.NATIVE_TOKEN_ADDRESS);
            const prevAverageRateUpdateTime = await getPrevAverageRateUpdateTime();

            await converter.setTime(now.add(Utils.duration.seconds(10)));

            await convert([Constants.NATIVE_TOKEN_ADDRESS, tokenAddress, reserveToken2.address], amount, MIN_RETURN, {
                value: amount
            });
            const averageRate = await getAverageRate(Constants.NATIVE_TOKEN_ADDRESS);
            const averageRateUpdateTime = await getPrevAverageRateUpdateTime();

            expect(averageRate.n).not.to.be.equal(prevAverageRate.n);
            expect(averageRate.d).not.to.be.equal(prevAverageRate.d);
            expect(averageRateUpdateTime).not.to.be.equal(prevAverageRateUpdateTime);
        });

        it('should be identical to the current rate after the full average rate period has passed', async () => {
            const amount = BigNumber.from(500);

            // set initial rate
            await convert([Constants.NATIVE_TOKEN_ADDRESS, tokenAddress, reserveToken2.address], amount, MIN_RETURN, {
                value: amount
            });

            let converterTime = now.add(Utils.duration.seconds(10));
            await converter.setTime(converterTime);
            await convert([Constants.NATIVE_TOKEN_ADDRESS, tokenAddress, reserveToken2.address], amount, MIN_RETURN, {
                value: amount
            });

            const currentRate = await getCurrentRate(Constants.NATIVE_TOKEN_ADDRESS, reserveToken2.address);
            let averageRate = await getAverageRate(Constants.NATIVE_TOKEN_ADDRESS);

            expect(averageRate.n).not.to.be.equal(currentRate.n);
            expect(averageRate.d).not.to.be.equal(currentRate.d);

            converterTime = converterTime.add(AVERAGE_RATE_PERIOD);
            await converter.setTime(converterTime);
            averageRate = await getAverageRate(Constants.NATIVE_TOKEN_ADDRESS);

            expect(averageRate.n).to.be.equal(currentRate.n);
            expect(averageRate.d).to.be.equal(currentRate.d);
        });

        for (const seconds of [0, 1, 2, 3, 10, 100, 200, 300, 400, 500]) {
            const timeElapsed = Utils.duration.seconds(seconds);
            context(`${timeElapsed.toString()} seconds after conversion`, async () => {
                beforeEach(async () => {
                    const amount = BigNumber.from(500);

                    // set initial rate (a second ago)
                    await converter.setTime(now.sub(Utils.duration.seconds(1)));
                    await convert(
                        [Constants.NATIVE_TOKEN_ADDRESS, tokenAddress, reserveToken2.address],
                        amount,
                        MIN_RETURN,
                        {
                            value: amount
                        }
                    );

                    // reset converter time to current time
                    await converter.setTime(now);

                    // convert
                    await convert(
                        [Constants.NATIVE_TOKEN_ADDRESS, tokenAddress, reserveToken2.address],
                        amount,
                        MIN_RETURN,
                        {
                            value: amount
                        }
                    );

                    // increase the current time
                    await converter.setTime(now.add(timeElapsed));
                });

                it('should properly calculate the average rate', async () => {
                    const amount = BigNumber.from(1000);

                    const prevAverageRate = await getPrevAverageRate();
                    const currentRate = await getCurrentRate(Constants.NATIVE_TOKEN_ADDRESS, reserveToken2.address);
                    const expectedAverageRate = getExpectedAverageRate(prevAverageRate, currentRate, timeElapsed);
                    await convert(
                        [Constants.NATIVE_TOKEN_ADDRESS, tokenAddress, reserveToken2.address],
                        amount,
                        MIN_RETURN,
                        {
                            value: amount
                        }
                    );
                    const averageRate = await getAverageRate(Constants.NATIVE_TOKEN_ADDRESS);

                    expectRatesAlmostEqual(averageRate, expectedAverageRate);
                });

                it('should not change more than once in a block', async () => {
                    const amount = BigNumber.from(1000);

                    await convert(
                        [Constants.NATIVE_TOKEN_ADDRESS, tokenAddress, reserveToken2.address],
                        amount,
                        MIN_RETURN,
                        {
                            value: amount
                        }
                    );
                    const averageRate = await getAverageRate(Constants.NATIVE_TOKEN_ADDRESS);

                    for (let i = 0; i < 5; i++) {
                        await convert(
                            [Constants.NATIVE_TOKEN_ADDRESS, tokenAddress, reserveToken2.address],
                            amount,
                            MIN_RETURN,
                            {
                                value: amount
                            }
                        );
                        let averageRate2 = await getAverageRate(Constants.NATIVE_TOKEN_ADDRESS);

                        expect(averageRate.n).to.be.equal(averageRate2.n);
                        expect(averageRate.d).to.be.equal(averageRate2.d);
                    }
                });

                it('should change after some time with no conversions', async () => {
                    const prevAverageRate = await getPrevAverageRate();
                    const currentRate = await getCurrentRate(Constants.NATIVE_TOKEN_ADDRESS, reserveToken2.address);

                    for (let i = 0; i < 10; i++) {
                        // increase the current time and verify that the average rate is updated accordingly
                        const delta = Utils.duration.seconds(10).mul(BigNumber.from(i));
                        const totalElapsedTime = timeElapsed.add(delta);
                        await converter.setTime(now.add(totalElapsedTime));

                        const expectedAverageRate = getExpectedAverageRate(
                            prevAverageRate,
                            currentRate,
                            totalElapsedTime
                        );
                        const averageRate = await getAverageRate(Constants.NATIVE_TOKEN_ADDRESS);

                        expectRatesAlmostEqual(averageRate, expectedAverageRate);
                    }
                });
            });
        }
    });

    describe('add/remove liquidity', () => {
        const initLiquidityPool = async (hasETH: any): Promise<[any, any, any]> => {
            const poolToken = await Contracts.DSToken.deploy('name', 'symbol', 0);
            const converter = await Contracts.TestStandardPoolConverter.deploy(
                poolToken.address,
                contractRegistry.address,
                0
            );

            const reserveTokens = [
                (await Contracts.TestStandardToken.deploy('name', 'symbol', 0, Constants.MAX_UINT256)).address,
                hasETH
                    ? Constants.NATIVE_TOKEN_ADDRESS
                    : (await Contracts.TestStandardToken.deploy('name', 'symbol', 0, Constants.MAX_UINT256)).address
            ];

            for (const reserveToken of reserveTokens) {
                await converter.addReserve(reserveToken, 500000);
            }

            await poolToken.transferOwnership(converter.address);
            await converter.acceptAnchorOwnership();

            return [converter, poolToken, reserveTokens];
        };

        const approve = async (reserveToken: any, converter: any, amount: any) => {
            if (reserveToken === Constants.NATIVE_TOKEN_ADDRESS) {
                return;
            }

            const token = await Contracts.TestStandardToken.attach(reserveToken);
            return token.approve(converter.address, amount);
        };

        const getAllowance = async (reserveToken: any, converter: any) => {
            if (reserveToken === Constants.NATIVE_TOKEN_ADDRESS) {
                return BigNumber.from(0);
            }

            const token = await Contracts.TestStandardToken.attach(reserveToken);
            return token.allowance(sender.address, converter.address);
        };

        const getBalance = async (reserveToken: any, converter: any) => {
            if (reserveToken === Constants.NATIVE_TOKEN_ADDRESS) {
                return ethers.provider.getBalance(converter.address);
            }

            const token = await Contracts.TestStandardToken.attach(reserveToken);
            return await token.balanceOf(converter.address);
        };

        const getLiquidityCosts = async (firstTime: any, converter: any, reserveTokens: any, reserveAmounts: any) => {
            if (firstTime) {
                return reserveAmounts.map((reserveAmount: any, i: any) => reserveAmounts);
            }

            return await Promise.all(
                reserveAmounts.map((reserveAmount: any, i: any) =>
                    converter.addLiquidityCost(reserveTokens, i, reserveAmount)
                )
            );
        };

        const getLiquidityReturns = async (firstTime: any, converter: any, reserveTokens: any, reserveAmounts: any) => {
            if (firstTime) {
                const length = Math.round(
                    reserveAmounts.map((reserveAmount: any) => reserveAmount.toString()).join('').length /
                        reserveAmounts.length
                );
                const retVal = BigNumber.from('1'.padEnd(length, '0'));
                return reserveAmounts.map((reserveAmount: any, i: any) => retVal);
            }

            return await Promise.all(
                reserveAmounts.map((reserveAmount: any, i: any) =>
                    converter.addLiquidityReturn(reserveTokens[i], reserveAmount)
                )
            );
        };

        const test = async (hasETH: any) => {
            const [converter, poolToken, reserveTokens] = await initLiquidityPool(hasETH);

            const state = [];
            let expected = [];
            let prevSupply = BigNumber.from(0);
            let prevBalances = reserveTokens.map((reserveToken: any) => BigNumber.from(0));

            for (const supplyAmount of [1000000000, 1000000, 2000000, 3000000, 4000000]) {
                const reserveAmounts = reserveTokens.map((reserveToken: any, i: any) =>
                    BigNumber.from(supplyAmount)
                        .mul(BigNumber.from(100 + i))
                        .div(BigNumber.from(100))
                );
                await Promise.all(
                    reserveTokens.map((reserveToken: any, i: any) =>
                        approve(reserveToken, converter, reserveAmounts[i].mul(BigNumber.from(0)))
                    )
                );
                await Promise.all(
                    reserveTokens.map((reserveToken: any, i: any) =>
                        approve(reserveToken, converter, reserveAmounts[i].mul(BigNumber.from(1)))
                    )
                );
                const liquidityCosts = await getLiquidityCosts(
                    state.length == 0,
                    converter,
                    reserveTokens,
                    reserveAmounts
                );
                const liquidityReturns = await getLiquidityReturns(
                    state.length == 0,
                    converter,
                    reserveTokens,
                    reserveAmounts
                );
                await converter['addLiquidity(address[],uint256[],uint256)'](
                    reserveTokens,
                    reserveAmounts,
                    MIN_RETURN,
                    {
                        value: hasETH ? reserveAmounts.slice(-1)[0] : 0
                    }
                );
                const allowances = (await Promise.all(
                    reserveTokens.map((reserveToken: any) => getAllowance(reserveToken, converter))
                )) as any;
                const balances = (await Promise.all(
                    reserveTokens.map((reserveToken: any) => getBalance(reserveToken, converter))
                )) as any;
                const supply = await poolToken.totalSupply();

                state.push({ supply: supply, balances: balances });

                for (let i = 0; i < allowances.length; i++) {
                    const diff = new MathUtils.Decimal(allowances[i].toString()).div(reserveAmounts[i].toString());
                    expect(diff.toFixed()).to.be.equal('0');
                }

                const actual = balances.map((balance: any) =>
                    new MathUtils.Decimal(balance.toString()).div(supply.toString())
                );
                for (let i = 0; i < expected.length; i++) {
                    const diff = expected[i].div(actual[i]);
                    expect(diff.toFixed()).to.be.equal('1');
                    for (const liquidityCost of liquidityCosts) {
                        expect(liquidityCost[i]).to.be.equal(balances[i].sub(prevBalances[i]));
                    }
                }

                for (const liquidityReturn of liquidityReturns) {
                    expect(liquidityReturn).to.be.equal(supply.sub(prevSupply));
                }

                expected = actual;
                prevSupply = supply;
                prevBalances = balances;
            }

            for (let n = state.length - 1; n > 0; n--) {
                const supplyAmount = state[n].supply.sub(BigNumber.from(state[n - 1].supply));
                const reserveAmounts = await converter.removeLiquidityReturn(supplyAmount, reserveTokens);
                await converter['removeLiquidity(uint256,address[],uint256[])'](
                    supplyAmount,
                    reserveTokens,
                    reserveTokens.map((reserveTokens: any) => 1)
                );
                const balances = (await Promise.all(
                    reserveTokens.map((reserveToken: any) => getBalance(reserveToken, converter))
                )) as any;
                for (let i = 0; i < balances.length; i++) {
                    const diff = new MathUtils.Decimal(state[n - 1].balances[i].toString()).div(
                        new MathUtils.Decimal(balances[i].toString())
                    );
                    expect(diff.toFixed()).to.be.equal('1');
                    expect(prevBalances[i].sub(balances[i])).to.be.equal(reserveAmounts[i]);
                }
                prevBalances = balances;
            }

            const supplyAmount = state[0].supply;
            const reserveAmounts = await converter.removeLiquidityReturn(supplyAmount, reserveTokens);
            await converter['removeLiquidity(uint256,address[],uint256[])'](
                supplyAmount,
                reserveTokens,
                reserveTokens.map((reserveTokens: any) => 1)
            );
            const balances = await Promise.all(
                reserveTokens.map((reserveToken: any) => getBalance(reserveToken, converter))
            );
            for (let i = 0; i < balances.length; i++) {
                expect(balances[i]).to.be.equal(BigNumber.from(0));
                expect(prevBalances[i].sub(balances[i])).to.be.equal(reserveAmounts[i]);
            }
        };

        for (const hasETH of [false, true]) {
            it(`hasETH = ${hasETH}`, async () => {
                await test(hasETH);
            });
        }
    });

    describe('verifies that the network fee is transferred correctly via', () => {
        const ONE_TOKEN = BigNumber.from(10).pow(BigNumber.from(18));
        const TOTAL_SUPPLY = ONE_TOKEN.mul(1000000);
        const CONVERSION_AMOUNT = ONE_TOKEN.mul(100);

        for (const initialBalance1 of [100000, 200000, 400000, 800000]) {
            for (const initialBalance2 of [100000, 300000, 500000, 700000]) {
                for (const conversionFeePercent of [0, 5, 10, 25, 75]) {
                    for (const networkFeePercent of [0, 5, 10, 25, 75, 100]) {
                        it(
                            description(
                                'processNetworkFees when',
                                initialBalance1,
                                initialBalance2,
                                conversionFeePercent,
                                networkFeePercent
                            ),
                            async () => {
                                const { poolToken, reserveToken1, reserveToken2, converter } = await createPool(
                                    networkFeePercent,
                                    conversionFeePercent
                                );
                                await addLiquidity(
                                    reserveToken1,
                                    reserveToken2,
                                    converter,
                                    [initialBalance1, initialBalance2].map((n) => ONE_TOKEN.mul(n))
                                );

                                const conversion = await convert(
                                    reserveToken1,
                                    poolToken,
                                    reserveToken2,
                                    bancorNetwork,
                                    converter,
                                    CONVERSION_AMOUNT
                                );
                                const expectedFeeBase = conversion.fee
                                    .div(2)
                                    .muln(networkFeePercent)
                                    .div(100 + networkFeePercent);
                                const reserveBalance1 = ONE_TOKEN.mul(initialBalance1).add(CONVERSION_AMOUNT);
                                const reserveBalance2 = ONE_TOKEN.mul(initialBalance2).sub(conversion.amount);

                                await converter.processNetworkFees();

                                const expectedFee1 = expectedFeeBase.mul(reserveBalance1).div(reserveBalance2);
                                const expectedFee2 = expectedFeeBase;

                                const actualFee1 = await reserveToken1.balanceOf(networkFeeWallet.address);
                                const actualFee2 = await reserveToken2.balanceOf(networkFeeWallet.address);

                                expectAlmostEqual(actualFee1, expectedFee1, '1', '0.000563');
                                expectAlmostEqual(actualFee2, expectedFee2, '1', '0.000563');
                            }
                        );
                    }
                }
            }
        }

        for (const initialBalance1 of [100000, 400000]) {
            for (const initialBalance2 of [100000, 500000]) {
                for (const conversionFeePercent of [1, 2]) {
                    for (const networkFeePercent of [5, 10]) {
                        it(
                            description(
                                'addLiquidity when',
                                initialBalance1,
                                initialBalance2,
                                conversionFeePercent,
                                networkFeePercent
                            ),
                            async () => {
                                const { poolToken, reserveToken1, reserveToken2, converter } = await createPool(
                                    networkFeePercent,
                                    conversionFeePercent
                                );
                                await addLiquidity(
                                    reserveToken1,
                                    reserveToken2,
                                    converter,
                                    [initialBalance1, initialBalance2].map((n) => ONE_TOKEN.mul(n))
                                );

                                const conversion = await convert(
                                    reserveToken1,
                                    poolToken,
                                    reserveToken2,
                                    bancorNetwork,
                                    converter,
                                    CONVERSION_AMOUNT
                                );
                                const expectedFeeBase = conversion.fee
                                    .div(2)
                                    .mul(networkFeePercent)
                                    .div(100 + networkFeePercent);
                                const reserveBalance1 = ONE_TOKEN.mul(initialBalance1).add(CONVERSION_AMOUNT);
                                const reserveBalance2 = ONE_TOKEN.mul(initialBalance2).sub(conversion.amount);

                                const reserveAmounts = [initialBalance1, initialBalance2].map((n) => ONE_TOKEN.mul(n));
                                await addLiquidity(reserveToken1, reserveToken2, converter, reserveAmounts, true);

                                const expectedFee1 = expectedFeeBase.mul(reserveBalance1).div(reserveBalance2);
                                const expectedFee2 = expectedFeeBase;

                                const actualFee1 = await reserveToken1.balanceOf(networkFeeWallet.address);
                                const actualFee2 = await reserveToken2.balanceOf(networkFeeWallet.address);

                                expectAlmostEqual(actualFee1, expectedFee1, '0', '0.000007');
                                expectAlmostEqual(actualFee2, expectedFee2, '0', '0.000007');
                            }
                        );
                    }
                }
            }
        }

        for (const initialBalance1 of [100000, 400000]) {
            for (const initialBalance2 of [100000, 500000]) {
                for (const conversionFeePercent of [1, 2]) {
                    for (const networkFeePercent of [5, 10]) {
                        it(
                            description(
                                'removeLiquidity when',
                                initialBalance1,
                                initialBalance2,
                                conversionFeePercent,
                                networkFeePercent
                            ),
                            async () => {
                                const { poolToken, reserveToken1, reserveToken2, converter } = await createPool(
                                    networkFeePercent,
                                    conversionFeePercent
                                );
                                await addLiquidity(
                                    reserveToken1,
                                    reserveToken2,
                                    converter,
                                    [initialBalance1, initialBalance2].map((n) => ONE_TOKEN.mul(n))
                                );

                                let totalConversionFee1 = BigNumber.from(0);
                                let totalConversionFee2 = BigNumber.from(0);

                                for (const n of [10, 20, 30, 40]) {
                                    const conversion = await convert(
                                        reserveToken1,
                                        poolToken,
                                        reserveToken2,
                                        bancorNetwork,
                                        converter,
                                        ONE_TOKEN.mul(n)
                                    );
                                    totalConversionFee2 = totalConversionFee2.add(conversion.fee);
                                }

                                for (const n of [50, 60, 70, 80]) {
                                    const conversion = await convert(
                                        reserveToken2,
                                        poolToken,
                                        reserveToken1,
                                        bancorNetwork,
                                        converter,
                                        ONE_TOKEN.mul(n)
                                    );
                                    totalConversionFee1 = totalConversionFee1.add(conversion.fee);
                                }

                                for (const n of [180, 170, 160, 150]) {
                                    const conversion = await convert(
                                        reserveToken1,
                                        poolToken,
                                        reserveToken2,
                                        bancorNetwork,
                                        converter,
                                        ONE_TOKEN.mul(n)
                                    );
                                    totalConversionFee2 = totalConversionFee2.add(conversion.fee);
                                }

                                for (const n of [140, 130, 120, 110]) {
                                    const conversion = await convert(
                                        reserveToken2,
                                        poolToken,
                                        reserveToken1,
                                        bancorNetwork,
                                        converter,
                                        ONE_TOKEN.mul(n)
                                    );
                                    totalConversionFee1 = totalConversionFee1.add(conversion.fee);
                                }

                                let totalSupply = await poolToken.totalSupply();
                                let reserveBalance1 = await reserveToken1.balanceOf(converter.address);
                                let reserveBalance2 = await reserveToken2.balanceOf(converter.address);

                                let supplyAmount = await poolToken.balanceOf(sender.address);
                                await removeLiquidity(reserveToken1, reserveToken2, converter, supplyAmount, true);

                                let totalConversionFee1InPoolTokenUnits = totalConversionFee1
                                    .mul(totalSupply)
                                    .div(reserveBalance1);
                                let totalConversionFee2InPoolTokenUnits = totalConversionFee2
                                    .mul(totalSupply)
                                    .div(reserveBalance2);
                                let totalConversionFeeInPoolTokenUnits = totalConversionFee1InPoolTokenUnits.add(
                                    totalConversionFee2InPoolTokenUnits
                                );
                                let expectedFeeBase = totalConversionFeeInPoolTokenUnits
                                    .div(2)
                                    .mul(networkFeePercent)
                                    .div(100 + networkFeePercent);
                                let expectedFee1 = expectedFeeBase.mul(reserveBalance1).div(totalSupply);
                                let expectedFee2 = expectedFeeBase.mul(reserveBalance2).div(totalSupply);

                                let actualFee1 = await reserveToken1.balanceOf(networkFeeWallet.address);
                                let actualFee2 = await reserveToken2.balanceOf(networkFeeWallet.address);

                                expectAlmostEqual(actualFee1, expectedFee1, '0', '0.001367');
                                expectAlmostEqual(actualFee2, expectedFee2, '0', '0.001367');

                                for (const n of [50, 60, 70, 80]) {
                                    const conversion = await convert(
                                        reserveToken2,
                                        poolToken,
                                        reserveToken1,
                                        bancorNetwork,
                                        converter,
                                        ONE_TOKEN.mul(n)
                                    );
                                    totalConversionFee1 = totalConversionFee1.add(conversion.fee);
                                }

                                for (const n of [180, 170, 160, 150]) {
                                    const conversion = await convert(
                                        reserveToken1,
                                        poolToken,
                                        reserveToken2,
                                        bancorNetwork,
                                        converter,
                                        ONE_TOKEN.mul(n)
                                    );
                                    totalConversionFee2 = totalConversionFee2.add(conversion.fee);
                                }

                                for (const n of [140, 130, 120, 110]) {
                                    const conversion = await convert(
                                        reserveToken2,
                                        poolToken,
                                        reserveToken1,
                                        bancorNetwork,
                                        converter,
                                        ONE_TOKEN.mul(n)
                                    );
                                    totalConversionFee1 = totalConversionFee1.add(conversion.fee);
                                }

                                totalSupply = await poolToken.totalSupply();
                                reserveBalance1 = await reserveToken1.balanceOf(converter.address);
                                reserveBalance2 = await reserveToken2.balanceOf(converter.address);

                                supplyAmount = await poolToken.balanceOf(sender.address);
                                await removeLiquidity(reserveToken1, reserveToken2, converter, supplyAmount, true);

                                totalConversionFee1InPoolTokenUnits = totalConversionFee1
                                    .mul(totalSupply)
                                    .div(reserveBalance1);
                                totalConversionFee2InPoolTokenUnits = totalConversionFee2
                                    .mul(totalSupply)
                                    .div(reserveBalance2);
                                totalConversionFeeInPoolTokenUnits = totalConversionFee1InPoolTokenUnits.add(
                                    totalConversionFee2InPoolTokenUnits
                                );
                                expectedFeeBase = totalConversionFeeInPoolTokenUnits
                                    .div(2)
                                    .mul(networkFeePercent)
                                    .div(100 + networkFeePercent);
                                expectedFee1 = expectedFeeBase.mul(reserveBalance1).div(totalSupply);
                                expectedFee2 = expectedFeeBase.mul(reserveBalance2).div(totalSupply);

                                actualFee1 = await reserveToken1.balanceOf(networkFeeWallet);
                                actualFee2 = await reserveToken2.balanceOf(networkFeeWallet);

                                expectAlmostEqual(actualFee1, expectedFee1, '0', '0.001367');
                                expectAlmostEqual(actualFee2, expectedFee2, '0', '0.001367');
                            }
                        );
                    }
                }
            }
        }

        for (const initialBalance1 of [100000]) {
            for (const initialBalance2 of [100000]) {
                for (const conversionFeePercent of [1]) {
                    for (const networkFeePercent of [10]) {
                        it(
                            description(
                                'add/remove liquidity when',
                                initialBalance1,
                                initialBalance2,
                                conversionFeePercent,
                                networkFeePercent
                            ),
                            async () => {
                                const { poolToken, reserveToken1, reserveToken2, converter } = await createPool(
                                    networkFeePercent,
                                    conversionFeePercent
                                );
                                await addLiquidity(
                                    reserveToken1,
                                    reserveToken2,
                                    converter,
                                    [initialBalance1, initialBalance2].map((n) => ONE_TOKEN.mul(n))
                                );

                                let totalConversionFee1 = BigNumber.from(0);
                                let totalConversionFee2 = BigNumber.from(0);

                                for (const n of [10, 20, 30, 40]) {
                                    const conversion = await convert(
                                        reserveToken1,
                                        poolToken,
                                        reserveToken2,
                                        bancorNetwork,
                                        converter,
                                        ONE_TOKEN.mul(n)
                                    );
                                    totalConversionFee2 = totalConversionFee2.add(conversion.fee);
                                }

                                for (let n = 0; n < 4; n++) {
                                    const reserveAmounts = [ONE_TOKEN.mul(1000), ONE_TOKEN.mul(1000)];
                                    await addLiquidity(reserveToken1, reserveToken2, converter, reserveAmounts, true);
                                    await reserveToken1.approve(converter.address, 0);
                                    await reserveToken2.approve(converter.address, 0);
                                }

                                for (const n of [50, 60, 70, 80]) {
                                    const conversion = await convert(
                                        reserveToken2,
                                        poolToken,
                                        reserveToken1,
                                        bancorNetwork,
                                        converter,
                                        ONE_TOKEN.mul(n)
                                    );
                                    totalConversionFee1 = totalConversionFee1.add(conversion.fee);
                                }

                                for (let n = 0; n < 4; n++) {
                                    const supplyAmount = await poolToken.balanceOf(sender.address);
                                    await removeLiquidity(
                                        reserveToken1,
                                        reserveToken2,
                                        converter,
                                        supplyAmount.div(10),
                                        true
                                    );
                                }

                                for (const n of [180, 170, 160, 150]) {
                                    const conversion = await convert(
                                        reserveToken1,
                                        poolToken,
                                        reserveToken2,
                                        bancorNetwork,
                                        converter,
                                        ONE_TOKEN.mul(n)
                                    );
                                    totalConversionFee2 = totalConversionFee2.add(conversion.fee);
                                }

                                for (let n = 0; n < 4; n++) {
                                    const reserveAmounts = [ONE_TOKEN.mul(1000), ONE_TOKEN.mul(1000)];
                                    await addLiquidity(reserveToken1, reserveToken2, converter, reserveAmounts, true);
                                    await reserveToken1.approve(converter.address, 0);
                                    await reserveToken2.approve(converter.address, 0);
                                }

                                for (const n of [140, 130, 120, 110]) {
                                    const conversion = await convert(
                                        reserveToken2,
                                        poolToken,
                                        reserveToken1,
                                        bancorNetwork,
                                        converter,
                                        ONE_TOKEN.mul(n)
                                    );
                                    totalConversionFee1 = totalConversionFee1.add(conversion.fee);
                                }

                                for (let n = 0; n < 4; n++) {
                                    const supplyAmount = await poolToken.balanceOf(sender.address);
                                    await removeLiquidity(
                                        reserveToken1,
                                        reserveToken2,
                                        converter,
                                        supplyAmount.div(10),
                                        true
                                    );
                                }

                                const totalSupply = await poolToken.totalSupply();
                                const reserveBalance1 = await reserveToken1.balanceOf(converter.address);
                                const reserveBalance2 = await reserveToken2.balanceOf(converter.address);

                                const totalConversionFee1InPoolTokenUnits = totalConversionFee1
                                    .mul(totalSupply)
                                    .div(reserveBalance1);
                                const totalConversionFee2InPoolTokenUnits = totalConversionFee2
                                    .mul(totalSupply)
                                    .div(reserveBalance2);
                                const totalConversionFeeInPoolTokenUnits = totalConversionFee1InPoolTokenUnits.add(
                                    totalConversionFee2InPoolTokenUnits
                                );
                                const expectedFeeBase = totalConversionFeeInPoolTokenUnits
                                    .div(2)
                                    .mul(networkFeePercent)
                                    .div(100 + networkFeePercent);
                                const expectedFee1 = expectedFeeBase.mul(reserveBalance1).div(totalSupply);
                                const expectedFee2 = expectedFeeBase.mul(reserveBalance2).div(totalSupply);

                                const actualFee1 = await reserveToken1.balanceOf(networkFeeWallet.address);
                                const actualFee2 = await reserveToken2.balanceOf(networkFeeWallet.address);

                                expectAlmostEqual(actualFee1, expectedFee1, '0', '0.003398');
                                expectAlmostEqual(actualFee2, expectedFee2, '0', '0.001664');
                            }
                        );
                    }
                }
            }
        }

        for (const initialBalance1 of [100000]) {
            for (const initialBalance2 of [100000]) {
                for (const conversionFeePercent of [1]) {
                    for (const networkFeePercent of [10]) {
                        it(
                            description(
                                'processNetworkFees when',
                                initialBalance1,
                                initialBalance2,
                                conversionFeePercent,
                                networkFeePercent
                            ),
                            async () => {
                                const { poolToken, reserveToken1, reserveToken2, converter } = await createPool(
                                    networkFeePercent,
                                    conversionFeePercent
                                );
                                await addLiquidity(
                                    reserveToken1,
                                    reserveToken2,
                                    converter,
                                    [initialBalance1, initialBalance2].map((n) => ONE_TOKEN.mul(n))
                                );

                                let totalConversionFee1 = BigNumber.from(0);
                                let totalConversionFee2 = BigNumber.from(0);

                                for (const n of [10, 20, 30, 40]) {
                                    const conversion = await convert(
                                        reserveToken1,
                                        poolToken,
                                        reserveToken2,
                                        bancorNetwork,
                                        converter,
                                        1000000 * n
                                    );
                                    totalConversionFee2 = totalConversionFee2.add(conversion.fee);
                                }

                                await converter.processNetworkFees();

                                for (const n of [50, 60, 70, 80]) {
                                    const conversion = await convert(
                                        reserveToken2,
                                        poolToken,
                                        reserveToken1,
                                        bancorNetwork,
                                        converter,
                                        1000000 * n
                                    );
                                    totalConversionFee1 = totalConversionFee1.add(conversion.fee);
                                }

                                await converter.processNetworkFees();

                                for (const n of [180, 170, 160, 150]) {
                                    const conversion = await convert(
                                        reserveToken1,
                                        poolToken,
                                        reserveToken2,
                                        bancorNetwork,
                                        converter,
                                        1000000 * n
                                    );
                                    totalConversionFee2 = totalConversionFee2.add(conversion.fee);
                                }

                                await converter.processNetworkFees();

                                for (const n of [140, 130, 120, 110]) {
                                    const conversion = await convert(
                                        reserveToken2,
                                        poolToken,
                                        reserveToken1,
                                        bancorNetwork,
                                        converter,
                                        1000000 * n
                                    );
                                    totalConversionFee1 = totalConversionFee1.add(conversion.fee);
                                }

                                await converter.processNetworkFees();

                                const totalSupply = await poolToken.totalSupply();
                                const reserveBalance1 = await reserveToken1.balanceOf(converter.address);
                                const reserveBalance2 = await reserveToken2.balanceOf(converter.address);

                                const totalConversionFee1InPoolTokenUnits = totalConversionFee1
                                    .mul(totalSupply)
                                    .div(reserveBalance1);
                                const totalConversionFee2InPoolTokenUnits = totalConversionFee2
                                    .mul(totalSupply)
                                    .div(reserveBalance2);
                                const totalConversionFeeInPoolTokenUnits = totalConversionFee1InPoolTokenUnits.add(
                                    totalConversionFee2InPoolTokenUnits
                                );
                                const expectedFeeBase = totalConversionFeeInPoolTokenUnits
                                    .div(2)
                                    .mul(networkFeePercent)
                                    .div(100 + networkFeePercent);
                                const expectedFee1 = expectedFeeBase.mul(reserveBalance1).div(totalSupply);
                                const expectedFee2 = expectedFeeBase.mul(reserveBalance2).div(totalSupply);

                                const actualFee1 = await reserveToken1.balanceOf(networkFeeWallet.address);
                                const actualFee2 = await reserveToken2.balanceOf(networkFeeWallet.address);

                                expectAlmostEqual(actualFee1, expectedFee1, '0', '0.0000015');
                                expectAlmostEqual(actualFee2, expectedFee2, '0', '0.0000029');
                            }
                        );
                    }
                }
            }
        }

        for (const initialBalance1 of [100000, 400000]) {
            for (const initialBalance2 of [100000, 500000]) {
                for (const conversionFeePercent of [1, 2]) {
                    for (const networkFeePercent of [5, 10]) {
                        it(
                            description(
                                'removeLiquidity when',
                                initialBalance1,
                                initialBalance2,
                                conversionFeePercent,
                                networkFeePercent
                            ),
                            async () => {
                                const { poolToken, reserveToken1, reserveToken2, converter } = await createPool(
                                    networkFeePercent,
                                    conversionFeePercent
                                );
                                await addLiquidity(
                                    reserveToken1,
                                    reserveToken2,
                                    converter,
                                    [initialBalance1, initialBalance2].map((n) => ONE_TOKEN.mul(n))
                                );

                                const conversionAmount = ONE_TOKEN.mul(Math.max(initialBalance1, initialBalance2));
                                const conversion = await convert(
                                    reserveToken1,
                                    poolToken,
                                    reserveToken2,
                                    bancorNetwork,
                                    converter,
                                    conversionAmount
                                );
                                const expectedFeeBase = conversion.fee
                                    .div(2)
                                    .mul(networkFeePercent)
                                    .div(100 + networkFeePercent);
                                const reserveBalance1 = ONE_TOKEN.mul(initialBalance1).add(conversionAmount);
                                const reserveBalance2 = ONE_TOKEN.mul(initialBalance2).sub(conversion.amount);

                                const supplyAmount = await poolToken.balanceOf(sender.address);
                                await removeLiquidity(reserveToken1, reserveToken2, converter, supplyAmount, true);

                                const expectedFee1 = expectedFeeBase.mul(reserveBalance1).div(reserveBalance2);
                                const expectedFee2 = expectedFeeBase;

                                const actualFee1 = await reserveToken1.balanceOf(networkFeeWallet.address);
                                const actualFee2 = await reserveToken2.balanceOf(networkFeeWallet.address);

                                expectAlmostEqual(actualFee1, expectedFee1, '0', '0.03256');
                                expectAlmostEqual(actualFee2, expectedFee2, '0', '0.03256');
                            }
                        );
                    }
                }
            }
        }

        function description(
            prefix: any,
            initialBalance1: any,
            initialBalance2: any,
            conversionFeePercent: any,
            networkFeePercent: any
        ) {
            return (
                prefix +
                ` initial balances = [${initialBalance1}, ${initialBalance2}],` +
                ` conversion fee = ${conversionFeePercent}%` +
                ` and network fee = ${networkFeePercent}%`
            );
        }

        async function createPool(networkFeePercent: any, conversionFeePercent: any) {
            const poolToken = await Contracts.DSToken.deploy('poolToken', 'poolToken', 18);
            const reserveToken1 = await Contracts.TestStandardToken.deploy(
                'reserveToken1',
                'reserveToken1',
                18,
                TOTAL_SUPPLY
            );
            const reserveToken2 = await Contracts.TestStandardToken.deploy(
                'reserveToken2',
                'reserveToken2',
                18,
                TOTAL_SUPPLY
            );
            const converter = await Contracts.TestStandardPoolConverter.deploy(
                poolToken.address,
                contractRegistry.address,
                1000000
            );

            await networkSettings.setNetworkFee(networkFeePercent * 10000);
            await converter.setConversionFee(conversionFeePercent * 10000);
            await converter.addReserve(reserveToken1.address, 500000);
            await converter.addReserve(reserveToken2.address, 500000);
            await poolToken.transferOwnership(converter.address);
            await converter.acceptTokenOwnership();

            return { poolToken, reserveToken1, reserveToken2, converter };
        }

        async function addLiquidity(
            reserveToken1: any,
            reserveToken2: any,
            converter: any,
            reserveAmounts: any,
            verify = false
        ) {
            const reserveTokens = [reserveToken1.address, reserveToken2.address];
            await reserveToken1.approve(converter.address, reserveAmounts[0]);
            await reserveToken2.approve(converter.address, reserveAmounts[1]);
            if (verify) {
                const expected1 = await converter.addLiquidityReturn(reserveTokens[0], reserveAmounts[0]);
                const expected2 = await converter.addLiquidityReturn(reserveTokens[1], reserveAmounts[1]);
                const actual = await converter.callStatic['addLiquidity(address[],uint256[],uint256)'](
                    reserveTokens,
                    reserveAmounts,
                    1
                );
                const min = expected1.lt(expected2) ? expected1 : expected2;
                expect(actual).to.be.equal(min);
            }
            await converter['addLiquidity(address[],uint256[],uint256)'](reserveTokens, reserveAmounts, 1);
        }

        async function removeLiquidity(
            reserveToken1: any,
            reserveToken2: any,
            converter: any,
            supplyAmount: any,
            verify = false
        ) {
            const reserveTokens = [reserveToken1.address, reserveToken2.address];
            if (verify) {
                const expected = await converter.removeLiquidityReturn(supplyAmount, reserveTokens);
                const actual = await converter.callStatic['removeLiquidity(uint256,address[],uint256[])'](
                    supplyAmount,
                    reserveTokens,
                    [1, 1]
                );
                expect(actual[0]).to.be.equal(expected[0]);
                expect(actual[1]).to.be.equal(expected[1]);
            }
            await converter['removeLiquidity(uint256,address[],uint256[])'](supplyAmount, reserveTokens, [1, 1]);
        }

        async function convert(
            sourceToken: any,
            poolToken: any,
            targetToken: any,
            bancorNetwork: any,
            converter: any,
            conversionAmount: any
        ) {
            const conversionPath = [sourceToken.address, poolToken.address, targetToken.address];
            await sourceToken.approve(bancorNetwork.address, conversionAmount);
            const response = await bancorNetwork.convertByPath2(
                conversionPath,
                conversionAmount,
                1,
                Constants.ZERO_ADDRESS
            );
            const events = await converter.queryFilter('Conversion', response.blockNumber, response.blockNumber);

            const args = events.slice(-1)[0].args;
            return { amount: args._return, fee: args._conversionFee };
        }

        function expectAlmostEqual(actual: any, expected: any, maxAbsoluteError: any, maxRelativeError: any) {
            const x = new MathUtils.Decimal(actual.toString());
            const y = new MathUtils.Decimal(expected.toString());
            if (!x.eq(y)) {
                const absoluteError = x.sub(y).abs();
                const relativeError = x.div(y).sub(1).abs();
                expect(absoluteError.lte(maxAbsoluteError) || relativeError.lte(maxRelativeError)).to.be.true;
            }
        }
    });
});
