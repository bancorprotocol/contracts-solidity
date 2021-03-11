const { accounts, defaultSender, contract, web3 } = require('@openzeppelin/test-environment');
const { expectRevert, expectEvent, constants, BN, balance, time } = require('@openzeppelin/test-helpers');
const { expect } = require('../../chai-local');
const Decimal = require('decimal.js');

const { NATIVE_TOKEN_ADDRESS, registry } = require('./helpers/Constants');
const { ZERO_ADDRESS, MAX_UINT256 } = constants;

const { duration, latest } = time;

const BancorNetwork = contract.fromArtifact('BancorNetwork');
const StandardPoolConverter = contract.fromArtifact('TestStandardPoolConverter');
const StandardPoolConverterFactory = contract.fromArtifact('StandardPoolConverterFactory');
const DSToken = contract.fromArtifact('DSToken');
const ContractRegistry = contract.fromArtifact('ContractRegistry');
const TestStandardToken = contract.fromArtifact('TestStandardToken');
const TestNonStandardToken = contract.fromArtifact('TestNonStandardToken');
const ConverterFactory = contract.fromArtifact('ConverterFactory');
const ConverterUpgrader = contract.fromArtifact('ConverterUpgrader');
const NetworkSettings = contract.fromArtifact('NetworkSettings');

const NETWORK_FEE_WALLET = '0x'.padEnd(42, '1');
const NETWORK_FEE = 0;

describe('StandardPoolConverter', () => {
    const createConverter = async (tokenAddress, registryAddress = contractRegistry.address, maxConversionFee = 0) => {
        return StandardPoolConverter.new(tokenAddress, registryAddress, maxConversionFee);
    };

    const initConverter = async (activate, isETHReserve, maxConversionFee = 0) => {
        token = await DSToken.new('Token1', 'TKN1', 2);
        tokenAddress = token.address;

        const converter = await createConverter(tokenAddress, contractRegistry.address, maxConversionFee);
        await converter.addReserve(getReserve1Address(isETHReserve), 500000);
        await converter.addReserve(reserveToken2.address, 500000);
        await reserveToken2.transfer(converter.address, 8000);
        await token.issue(sender, 20000);

        if (isETHReserve) {
            await converter.send(5000);
        } else {
            await reserveToken.transfer(converter.address, 5000);
        }

        if (activate) {
            await token.transferOwnership(converter.address);
            await converter.acceptTokenOwnership();
        }

        now = await latest();
        await converter.setTime(now);

        return converter;
    };

    const removeLiquidityTest = async (poolTokenAmount, reserveTokens) => {
        const inputAmount = new BN(poolTokenAmount);
        const converter = await initConverter(true, false);
        const poolTokenSupply = await token.totalSupply.call();
        const reserveBalances = await Promise.all(
            reserveTokens.map((reserveToken) => converter.reserveBalance.call(reserveToken.address))
        );
        const expectedOutputAmounts = reserveBalances.map((reserveBalance) =>
            reserveBalance.mul(inputAmount).div(poolTokenSupply)
        );
        await converter.removeLiquidityTest(
            inputAmount,
            reserveTokens.map((reserveToken) => reserveToken.address),
            [MIN_RETURN, MIN_RETURN]
        );
        const actualOutputAmounts = await Promise.all(
            reserveTokens.map((reserveToken, i) => converter.reserveAmountsRemoved(i))
        );
        reserveTokens.map((reserveToken, i) =>
            expect(actualOutputAmounts[i]).to.be.bignumber.equal(expectedOutputAmounts[i])
        );
    };

    const getReserve1Address = (isETH) => {
        return isETH ? NATIVE_TOKEN_ADDRESS : reserveToken.address;
    };

    const getBalance = async (token, address, account) => {
        if (address === NATIVE_TOKEN_ADDRESS) {
            return balance.current(account);
        }

        return token.balanceOf.call(account);
    };

    const getTransactionCost = async (txResult) => {
        const transaction = await web3.eth.getTransaction(txResult.tx);
        return new BN(transaction.gasPrice).mul(new BN(txResult.receipt.cumulativeGasUsed));
    };

    const convert = async (path, amount, minReturn, options = {}) => {
        return bancorNetwork.convertByPath2(path, amount, minReturn, ZERO_ADDRESS, options);
    };

    const divCeil = (num, d) => {
        const dm = num.divmod(d);
        if (dm.mod.isZero()) {
            return dm.div;
        }

        return dm.div.negative !== 0 ? dm.div.isubn(1) : dm.div.iaddn(1);
    };

    const expectAlmostEqual = (amount1, amount2, maxError) => {
        if (!amount1.eq(amount2)) {
            const error = Decimal(amount1.toString()).div(amount2.toString()).sub(1).abs();
            expect(error.lte(maxError)).to.be.true(`error = ${error.toFixed(maxError.length)}`);
        }
    };

    let now;
    let bancorNetwork;
    let token;
    let tokenAddress;
    let contractRegistry;
    let networkSettings;
    let reserveToken;
    let reserveToken2;
    let upgrader;
    const sender = defaultSender;
    const sender2 = accounts[9];

    const MIN_RETURN = new BN(1);

    before(async () => {
        // The following contracts are unaffected by the underlying tests, this can be shared.
        contractRegistry = await ContractRegistry.new();

        const factory = await ConverterFactory.new();
        await contractRegistry.registerAddress(registry.CONVERTER_FACTORY, factory.address);

        networkSettings = await NetworkSettings.new(NETWORK_FEE_WALLET, NETWORK_FEE);
        await contractRegistry.registerAddress(registry.NETWORK_SETTINGS, networkSettings.address);

        await factory.registerTypedConverterFactory((await StandardPoolConverterFactory.new()).address);
    });

    beforeEach(async () => {
        bancorNetwork = await BancorNetwork.new(contractRegistry.address);
        await contractRegistry.registerAddress(registry.BANCOR_NETWORK, bancorNetwork.address);

        upgrader = await ConverterUpgrader.new(contractRegistry.address);
        await contractRegistry.registerAddress(registry.CONVERTER_UPGRADER, upgrader.address);

        const token = await DSToken.new('Token1', 'TKN1', 2);
        tokenAddress = token.address;

        reserveToken = await TestStandardToken.new('ERC Token 1', 'ERC1', 18, 1000000000);
        reserveToken2 = await TestNonStandardToken.new('ERC Token 2', 'ERC2', 18, 2000000000);
    });

    it('verifies the Activation event after converter activation', async () => {
        const converter = await initConverter(false, false);
        await token.transferOwnership(converter.address);
        const res = await converter.acceptTokenOwnership();

        expectEvent(res, 'Activation', {
            _type: new BN(3),
            _anchor: tokenAddress,
            _activated: true
        });
    });

    it('verifies the TokenRateUpdate event after adding liquidity', async () => {
        const converter = await initConverter(true, false);

        const value = new BN(500);
        await reserveToken.approve(converter.address, value, { from: sender });
        await reserveToken2.approve(converter.address, value, { from: sender });

        const res = await converter.addLiquidity(
            [reserveToken.address, reserveToken2.address],
            [value, value],
            MIN_RETURN
        );

        const poolTokenSupply = await token.totalSupply.call();
        const reserve1Balance = await converter.reserveBalance.call(reserveToken.address);
        const reserve2Balance = await converter.reserveBalance.call(reserveToken2.address);

        expectEvent(res, 'TokenRateUpdate', {
            _token1: tokenAddress,
            _token2: reserveToken.address,
            _rateN: reserve1Balance,
            _rateD: poolTokenSupply
        });

        expectEvent(res, 'TokenRateUpdate', {
            _token1: tokenAddress,
            _token2: reserveToken2.address,
            _rateN: reserve2Balance,
            _rateD: poolTokenSupply
        });
    });

    it('verifies the TokenRateUpdate event after removing liquidity', async () => {
        const converter = await initConverter(true, false);

        const res = await converter.removeLiquidity(
            100,
            [reserveToken.address, reserveToken2.address],
            [MIN_RETURN, MIN_RETURN]
        );

        const poolTokenSupply = await token.totalSupply.call();
        const reserve1Balance = await converter.reserveBalance.call(reserveToken.address);
        await converter.reserveWeight.call(reserveToken.address);
        const reserve2Balance = await converter.reserveBalance.call(reserveToken2.address);
        await converter.reserveWeight.call(reserveToken2.address);

        expectEvent(res, 'TokenRateUpdate', {
            _token1: tokenAddress,
            _token2: reserveToken.address,
            _rateN: reserve1Balance,
            _rateD: poolTokenSupply
        });

        expectEvent(res, 'TokenRateUpdate', {
            _token1: tokenAddress,
            _token2: reserveToken2.address,
            _rateN: reserve2Balance,
            _rateD: poolTokenSupply
        });
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

                const targetAmountAndFee = await converter.targetAmountAndFee.call(
                    getReserve1Address(true),
                    reserveToken2.address,
                    amount
                );

                const sourceAmountAndFee = await converter.sourceAmountAndFee.call(
                    getReserve1Address(true),
                    reserveToken2.address,
                    targetAmountAndFee[0]
                );

                const targetAmountAndFee2 = await converter.targetAmountAndFee.call(
                    getReserve1Address(true),
                    reserveToken2.address,
                    sourceAmountAndFee[0]
                );

                expectAlmostEqual(sourceAmountAndFee[0], new BN(amount), '0.0014');
                expect(sourceAmountAndFee[1]).to.be.bignumber.gte(targetAmountAndFee[1]);
                expect(sourceAmountAndFee[1]).to.be.bignumber.lte(targetAmountAndFee[1].addn(1));
                expect(targetAmountAndFee2[0]).to.be.bignumber.equal(targetAmountAndFee[0]);
                expect(targetAmountAndFee2[1]).to.be.bignumber.equal(sourceAmountAndFee[1]);
            });
        }
    }

    for (const amount of [0, 500, 1234, 5678, 7890]) {
        for (const fee of [0, 1000, 2000, 3456, 6789]) {
            it(`verifies function sourceAmountAndFee(${amount}) when fee = ${fee}`, async () => {
                const converter = await initConverter(true, true, 1000000);
                await converter.setConversionFee(fee);

                const sourceAmountAndFee = await converter.sourceAmountAndFee.call(
                    getReserve1Address(true),
                    reserveToken2.address,
                    amount
                );

                const targetAmountAndFee = await converter.targetAmountAndFee.call(
                    getReserve1Address(true),
                    reserveToken2.address,
                    sourceAmountAndFee[0]
                );

                expectAlmostEqual(targetAmountAndFee[0], new BN(amount), '0.002');
                expect(targetAmountAndFee[0]).to.be.bignumber.gte(new BN(amount));
                expect(targetAmountAndFee[1]).to.be.bignumber.gte(sourceAmountAndFee[1]);
                expect(targetAmountAndFee[1]).to.be.bignumber.lte(sourceAmountAndFee[1].addn(1));
            });
        }
    }

    for (let isETHReserve = 0; isETHReserve < 2; isETHReserve++) {
        describe(`${isETHReserve === 0 ? '(with ERC20 reserves)' : '(with ETH reserve)'}:`, () => {
            it('verifies that convert returns valid amount and fee after converting', async () => {
                const converter = await initConverter(true, isETHReserve, 5000);
                await converter.setConversionFee(3000);

                const amount = new BN(500);
                let value = 0;
                if (isETHReserve) {
                    value = amount;
                } else {
                    await reserveToken.approve(bancorNetwork.address, amount, { from: sender });
                }

                const purchaseAmount = (
                    await converter.targetAmountAndFee.call(
                        getReserve1Address(isETHReserve),
                        reserveToken2.address,
                        amount
                    )
                )[0];
                const res = await convert(
                    [getReserve1Address(isETHReserve), tokenAddress, reserveToken2.address],
                    amount,
                    MIN_RETURN,
                    { value }
                );
                expectEvent(res, 'Conversion', {
                    _smartToken: token.address,
                    _fromToken: getReserve1Address(isETHReserve),
                    _toToken: reserveToken2.address,
                    _fromAmount: amount,
                    _toAmount: purchaseAmount
                });
            });

            it('verifies the TokenRateUpdate event after conversion', async () => {
                const converter = await initConverter(true, isETHReserve, 10000);
                await converter.setConversionFee(6000);

                const amount = new BN(500);
                let value = 0;
                if (isETHReserve) {
                    value = amount;
                } else {
                    await reserveToken.approve(bancorNetwork.address, amount, { from: sender });
                }

                const res = await convert(
                    [getReserve1Address(isETHReserve), tokenAddress, reserveToken2.address],
                    amount,
                    MIN_RETURN,
                    { value }
                );

                const poolTokenSupply = await token.totalSupply.call();
                const reserve1Balance = await converter.reserveBalance(getReserve1Address(isETHReserve));
                const reserve2Balance = await converter.reserveBalance(reserveToken2.address);

                const events = await converter.getPastEvents('TokenRateUpdate', {
                    fromBlock: res.receipt.blockNumber,
                    toBlock: res.receipt.blockNumber
                });

                // TokenRateUpdate for [source, target):
                const { args: event1 } = events[0];
                expect(event1._token1).to.eql(getReserve1Address(isETHReserve));
                expect(event1._token2).to.eql(reserveToken2.address);
                expect(event1._rateN).to.be.bignumber.equal(reserve2Balance);
                expect(event1._rateD).to.be.bignumber.equal(reserve1Balance);

                // TokenRateUpdate for [source, pool token):
                const { args: event2 } = events[1];
                expect(event2._token1).to.eql(tokenAddress);
                expect(event2._token2).to.eql(getReserve1Address(isETHReserve));
                expect(event2._rateN).to.be.bignumber.equal(reserve1Balance);
                expect(event2._rateD).to.be.bignumber.equal(poolTokenSupply);

                // TokenRateUpdate for [pool token, target):
                const { args: event3 } = events[2];
                expect(event3._token1).to.eql(tokenAddress);
                expect(event3._token2).to.eql(reserveToken2.address);
                expect(event3._rateN).to.be.bignumber.equal(reserve2Balance);
                expect(event3._rateD).to.be.bignumber.equal(poolTokenSupply);
            });

            it('should revert when attempting to convert when the return is smaller than the minimum requested amount', async () => {
                await initConverter(true, isETHReserve);

                const amount = new BN(500);
                let value = 0;
                if (isETHReserve) {
                    value = amount;
                } else {
                    await reserveToken.approve(bancorNetwork.address, amount, { from: sender });
                }

                await expectRevert(
                    convert([getReserve1Address(isETHReserve), tokenAddress, reserveToken2.address], amount, 200000, {
                        value
                    }),
                    'ERR_RETURN_TOO_LOW'
                );
            });

            it('verifies that addLiquidity gets the correct reserve balance amounts from the caller', async () => {
                const converter = await initConverter(false, isETHReserve);

                await token.transferOwnership(converter.address);
                await converter.acceptTokenOwnership();

                await reserveToken.transfer(sender2, 5000);
                await reserveToken2.transfer(sender2, 5000);

                const supply = await token.totalSupply.call();
                const percentage = new BN(19);
                const prevReserve1Balance = await converter.reserveBalance.call(getReserve1Address(isETHReserve));
                const prevReserve2Balance = await converter.reserveBalance.call(reserveToken2.address);
                const token1Amount = divCeil(prevReserve1Balance.mul(percentage), supply);
                const token2Amount = divCeil(prevReserve2Balance.mul(percentage), supply);

                const amount = new BN(100000);
                let value = 0;
                if (isETHReserve) {
                    value = amount;
                } else {
                    await reserveToken.approve(converter.address, amount, { from: sender2 });
                }

                await reserveToken2.approve(converter.address, amount, { from: sender2 });
                await converter.addLiquidity(
                    [getReserve1Address(isETHReserve), reserveToken2.address],
                    [amount, token2Amount],
                    1,
                    { from: sender2, value }
                );

                const reserve1Balance = await converter.reserveBalance.call(getReserve1Address(isETHReserve));
                const reserve2Balance = await converter.reserveBalance.call(reserveToken2.address);

                expect(reserve1Balance).to.be.bignumber.equal(prevReserve1Balance.add(token1Amount));
                expect(reserve2Balance).to.be.bignumber.equal(prevReserve2Balance.add(token2Amount));
            });

            it('verifies that increasing the liquidity by a large amount gets the correct reserve balance amounts from the caller', async () => {
                const converter = await initConverter(false, isETHReserve);

                await token.transferOwnership(converter.address);
                await converter.acceptTokenOwnership();

                await reserveToken.transfer(sender2, 500000);
                await reserveToken2.transfer(sender2, 500000);

                const supply = await token.totalSupply.call();
                const percentage = new BN(140854);
                const prevReserve1Balance = await converter.reserveBalance.call(getReserve1Address(isETHReserve));
                const prevReserve2Balance = await converter.reserveBalance.call(reserveToken2.address);
                const token1Amount = divCeil(prevReserve1Balance.mul(percentage), supply);
                const token2Amount = divCeil(prevReserve2Balance.mul(percentage), supply);

                const amount = new BN(100000);
                let value = 0;
                if (isETHReserve) {
                    value = amount;
                } else {
                    await reserveToken.approve(converter.address, amount, { from: sender2 });
                }

                await reserveToken2.approve(converter.address, amount, { from: sender2 });
                await converter.addLiquidity(
                    [getReserve1Address(isETHReserve), reserveToken2.address],
                    [amount, token2Amount],
                    1,
                    { from: sender2, value }
                );

                const reserve1Balance = await converter.reserveBalance.call(getReserve1Address(isETHReserve));
                const reserve2Balance = await converter.reserveBalance.call(reserveToken2.address);

                expect(reserve1Balance).to.be.bignumber.equal(prevReserve1Balance.add(token1Amount));
                expect(reserve2Balance).to.be.bignumber.equal(prevReserve2Balance.add(token2Amount));
            });

            it('should revert when attempting to add liquidity with insufficient funds', async () => {
                const converter = await initConverter(false, isETHReserve);

                await token.transferOwnership(converter.address);
                await converter.acceptTokenOwnership();

                await reserveToken.transfer(sender2, 100);
                await reserveToken2.transfer(sender2, 100);

                const amount = new BN(100000);
                let value = 0;
                if (isETHReserve) {
                    value = amount;
                } else {
                    await reserveToken.approve(converter.address, amount, { from: sender2 });
                }

                await reserveToken2.approve(converter.address, amount, { from: sender2 });
                await converter.addLiquidity(
                    [getReserve1Address(isETHReserve), reserveToken2.address],
                    [amount, 10],
                    1,
                    { from: sender2, value }
                );

                await expectRevert.unspecified(
                    converter.addLiquidity(
                        [getReserve1Address(isETHReserve), reserveToken2.address],
                        [amount, 1000],
                        1,
                        { from: sender2, value }
                    )
                );
            });

            it('verifies that addLiquidity with separate reserve balances gets the correct reserve balance amounts from the caller', async () => {
                const converter = await initConverter(false, isETHReserve);

                await token.transferOwnership(converter.address);
                await converter.acceptTokenOwnership();

                await reserveToken.transfer(sender2, 5000);
                await reserveToken2.transfer(sender2, 5000);

                const supply = await token.totalSupply.call();
                const percentage = new BN(19);
                const prevReserve1Balance = await converter.reserveBalance.call(getReserve1Address(isETHReserve));
                const prevReserve2Balance = await converter.reserveBalance.call(reserveToken2.address);
                const token1Amount = divCeil(prevReserve1Balance.mul(percentage), supply);
                const token2Amount = divCeil(prevReserve2Balance.mul(percentage), supply);

                const amount = new BN(100000);
                let value = 0;
                if (isETHReserve) {
                    value = amount;
                } else {
                    await reserveToken.approve(converter.address, amount, { from: sender2 });
                }

                await reserveToken2.approve(converter.address, amount, { from: sender2 });
                await converter.methods['addLiquidity(uint256,uint256,uint256)'](amount, token2Amount, 1, {
                    from: sender2,
                    value
                });

                const reserve1Balance = await converter.reserveBalance.call(getReserve1Address(isETHReserve));
                const reserve2Balance = await converter.reserveBalance.call(reserveToken2.address);

                expect(reserve1Balance).to.be.bignumber.equal(prevReserve1Balance.add(token1Amount));
                expect(reserve2Balance).to.be.bignumber.equal(prevReserve2Balance.add(token2Amount));
            });

            it('verifies that removeLiquidity sends the correct reserve balance amounts to the caller', async () => {
                const converter = await initConverter(false, isETHReserve);

                await token.transferOwnership(converter.address);
                await converter.acceptTokenOwnership();

                await token.transfer(sender2, 100);

                const supply = await token.totalSupply.call();
                const percentage = new BN(19);
                const reserve1Balance = await converter.reserveBalance.call(getReserve1Address(isETHReserve));
                const reserve2Balance = await converter.reserveBalance.call(reserveToken2.address);
                const token1Amount = reserve1Balance.mul(percentage).div(supply);
                const token2Amount = reserve2Balance.mul(percentage).div(supply);

                const token1PrevBalance = await getBalance(reserveToken, getReserve1Address(isETHReserve), sender2);
                const token2PrevBalance = await reserveToken2.balanceOf.call(sender2);
                const res = await converter.removeLiquidity(
                    19,
                    [getReserve1Address(isETHReserve), reserveToken2.address],
                    [1, 1],
                    { from: sender2 }
                );

                let transactionCost = new BN(0);
                if (isETHReserve) {
                    transactionCost = await getTransactionCost(res);
                }

                const token1Balance = await getBalance(reserveToken, getReserve1Address(isETHReserve), sender2);
                const token2Balance = await reserveToken2.balanceOf.call(sender2);

                expect(token1Balance).to.be.bignumber.equal(token1PrevBalance.add(token1Amount.sub(transactionCost)));
                expect(token2Balance).to.be.bignumber.equal(token2PrevBalance.add(token2Amount));
            });

            it('verifies that removing a large amount of liquidity sends the correct reserve balance amounts to the caller', async () => {
                const converter = await initConverter(false, isETHReserve);

                await token.transferOwnership(converter.address);
                await converter.acceptTokenOwnership();

                await token.transfer(sender2, 15000);

                const supply = await token.totalSupply.call();
                const percentage = new BN(14854);
                const reserve1Balance = await converter.reserveBalance.call(getReserve1Address(isETHReserve));
                const reserve2Balance = await converter.reserveBalance.call(reserveToken2.address);
                const token1Amount = reserve1Balance.mul(percentage).div(supply);
                const token2Amount = reserve2Balance.mul(percentage).div(supply);

                const token1PrevBalance = await getBalance(reserveToken, getReserve1Address(isETHReserve), sender2);
                const token2PrevBalance = await reserveToken2.balanceOf.call(sender2);

                const res = await converter.removeLiquidity(
                    14854,
                    [getReserve1Address(isETHReserve), reserveToken2.address],
                    [1, 1],
                    { from: sender2 }
                );

                let transactionCost = new BN(0);
                if (isETHReserve) {
                    transactionCost = await getTransactionCost(res);
                }

                const token1Balance = await getBalance(reserveToken, getReserve1Address(isETHReserve), sender2);
                const token2Balance = await reserveToken2.balanceOf.call(sender2);

                expect(token1Balance).to.be.bignumber.equal(token1PrevBalance.add(token1Amount.sub(transactionCost)));
                expect(token2Balance).to.be.bignumber.equal(token2PrevBalance.add(token2Amount));
            });

            it('verifies that removing the entire liquidity sends the full reserve balances to the caller', async () => {
                const converter = await initConverter(false, isETHReserve);

                await token.transferOwnership(converter.address);
                await converter.acceptTokenOwnership();

                await token.transfer(sender2, 20000);

                const reserve1Balance = await converter.reserveBalance.call(getReserve1Address(isETHReserve));
                const reserve2Balance = await converter.reserveBalance.call(reserveToken2.address);

                const token1PrevBalance = await getBalance(reserveToken, getReserve1Address(isETHReserve), sender2);
                const token2PrevBalance = await reserveToken2.balanceOf.call(sender2);
                const res = await converter.removeLiquidity(
                    20000,
                    [getReserve1Address(isETHReserve), reserveToken2.address],
                    [1, 1],
                    { from: sender2 }
                );

                let transactionCost = new BN(0);
                if (isETHReserve) {
                    transactionCost = await getTransactionCost(res);
                }

                const supply = await token.totalSupply.call();
                const token1Balance = await getBalance(reserveToken, getReserve1Address(isETHReserve), sender2);
                const token2Balance = await reserveToken2.balanceOf.call(sender2);

                expect(supply).to.be.bignumber.equal(new BN(0));
                expect(token1PrevBalance.add(reserve1Balance).sub(transactionCost)).to.be.bignumber.equal(
                    token1Balance
                );
                expect(token2PrevBalance.add(reserve2Balance)).to.be.bignumber.equal(token2Balance);
            });

            it('should revert when attempting to remove liquidity with insufficient funds', async () => {
                const converter = await initConverter(false, isETHReserve);

                await token.transferOwnership(converter.address);
                await converter.acceptTokenOwnership();

                await token.transfer(sender2, 100);

                await converter.removeLiquidity(5, [getReserve1Address(isETHReserve), reserveToken2.address], [1, 1], {
                    from: sender2
                });

                await expectRevert.unspecified(
                    converter.removeLiquidity(600, [getReserve1Address(isETHReserve), reserveToken2.address], [1, 1], {
                        from: sender2
                    })
                );
            });

            it('verifies that removeLiquidity with separate minimum return args sends the correct reserve balance amounts to the caller', async () => {
                const converter = await initConverter(false, isETHReserve);

                await token.transferOwnership(converter.address);
                await converter.acceptTokenOwnership();

                await token.transfer(sender2, 100);

                const supply = await token.totalSupply.call();
                const percentage = new BN(19);
                const reserve1Balance = await converter.reserveBalance.call(getReserve1Address(isETHReserve));
                const reserve2Balance = await converter.reserveBalance.call(reserveToken2.address);
                const token1Amount = reserve1Balance.mul(percentage).div(supply);
                const token2Amount = reserve2Balance.mul(percentage).div(supply);

                const token1PrevBalance = await getBalance(reserveToken, getReserve1Address(isETHReserve), sender2);
                const token2PrevBalance = await reserveToken2.balanceOf.call(sender2);
                const res = await converter.methods['removeLiquidity(uint256,uint256,uint256)'](19, 1, 1, {
                    from: sender2
                });

                let transactionCost = new BN(0);
                if (isETHReserve) {
                    transactionCost = await getTransactionCost(res);
                }

                const token1Balance = await getBalance(reserveToken, getReserve1Address(isETHReserve), sender2);
                const token2Balance = await reserveToken2.balanceOf.call(sender2);

                expect(token1Balance).to.be.bignumber.equal(token1PrevBalance.add(token1Amount.sub(transactionCost)));
                expect(token2Balance).to.be.bignumber.equal(token2PrevBalance.add(token2Amount));
            });
        });
    }

    describe('verifies that the maximum possible liquidity is added', () => {
        let converter;
        let reserveToken1;
        let reserveToken2;

        const amounts = [
            [1000, 1200],
            [200, 240],
            [2000, 2400],
            [20000, 22000],
            [20000, 26000],
            [100000, 120000]
        ];

        beforeEach(async () => {
            const token = await DSToken.new('Token', 'TKN', 0);
            converter = await StandardPoolConverter.new(token.address, contractRegistry.address, 0);
            reserveToken1 = await TestStandardToken.new('ERC Token 1', 'ERC1', 18, 1000000000);
            reserveToken2 = await TestStandardToken.new('ERC Token 2', 'ERC2', 18, 1000000000);
            await converter.addReserve(reserveToken1.address, 500000);
            await converter.addReserve(reserveToken2.address, 500000);
            await token.transferOwnership(converter.address);
            await converter.acceptTokenOwnership();
        });

        for (const [amount1, amount2] of amounts) {
            it(`addLiquidity(${[amount1, amount2]})`, async () => {
                await reserveToken1.approve(converter.address, amount1, { from: sender });
                await reserveToken2.approve(converter.address, amount2, { from: sender });
                await converter.addLiquidity([reserveToken1.address, reserveToken2.address], [amount1, amount2], 1);
                const balance1 = await reserveToken1.balanceOf.call(converter.address);
                const balance2 = await reserveToken2.balanceOf.call(converter.address);
                const a1b2 = new BN(amount1).mul(balance2);
                const a2b1 = new BN(amount2).mul(balance1);
                const expected1 = a1b2.lt(a2b1) ? new BN(0) : a1b2.sub(a2b1).div(balance2);
                const expected2 = a2b1.lt(a1b2) ? new BN(0) : a2b1.sub(a1b2).div(balance1);
                const actual1 = await reserveToken1.allowance.call(sender, converter.address);
                const actual2 = await reserveToken2.allowance.call(sender, converter.address);
                expect(actual1).to.be.bignumber.equal(expected1);
                expect(actual2).to.be.bignumber.equal(expected2);
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
                    const token = await DSToken.new('Token', 'TKN', 0);
                    const converter = await StandardPoolConverter.new(token.address, contractRegistry.address, 0);
                    const reserveToken1 = await TestStandardToken.new('ERC Token 1', 'ERC1', 18, 1000000000);
                    const reserveToken2 = await TestStandardToken.new('ERC Token 2', 'ERC2', 18, 1000000000);
                    await converter.addReserve(reserveToken1.address, 500000);
                    await converter.addReserve(reserveToken2.address, 500000);
                    await token.transferOwnership(converter.address);
                    await converter.acceptTokenOwnership();
                    let lastAmount = new BN(0);
                    for (const amount of amounts) {
                        await reserveToken1.transfer(sender2, amount, { from: sender });
                        await reserveToken2.transfer(sender2, amount, { from: sender });
                        await reserveToken1.approve(converter.address, amount, { from: sender2 });
                        await reserveToken2.approve(converter.address, amount, { from: sender2 });
                        await converter.addLiquidity(
                            [reserveToken1.address, reserveToken2.address],
                            [amount, amount],
                            MIN_RETURN,
                            { from: sender2 }
                        );
                        const balance = await token.balanceOf.call(sender2);
                        lastAmount = balance.sub(lastAmount);
                    }
                    for (const percent of percents) {
                        await converter.removeLiquidity(
                            lastAmount.mul(new BN(percent)).div(new BN(100)),
                            [reserveToken1.address, reserveToken2.address],
                            [MIN_RETURN, MIN_RETURN],
                            { from: sender2 }
                        );
                    }
                    const balance1 = await reserveToken1.balanceOf.call(sender2);
                    const balance2 = await reserveToken2.balanceOf.call(sender2);
                    const amount = new BN(amounts[1]);
                    expect(balance1).to.be.bignumber.equal(amount);
                    expect(balance2).to.be.bignumber.equal(amount);
                });
            }
        }
    });

    describe('recent average rate', () => {
        const AVERAGE_RATE_PERIOD = duration.minutes(10);

        let converter;
        beforeEach(async () => {
            converter = await initConverter(true, true, 5000);
        });

        const getExpectedAverageRate = (prevAverageRate, currentRate, timeElapsed) => {
            if (timeElapsed.eq(new BN(0))) {
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

        const expectRatesAlmostEqual = (rate, newRate) => {
            const rate1 = Decimal(rate.n.toString()).div(Decimal(rate.d.toString()));
            const rate2 = Decimal(newRate.n.toString()).div(Decimal(newRate.d.toString()));

            if (!rate1.eq(rate2)) {
                const error = Decimal(rate1.toString()).div(rate2.toString()).sub(1).abs();
                expect(error.lte('0.000002')).to.be.true(`error = ${error.toFixed(10)}`);
            }
        };

        const getCurrentRate = async (reserve1Address, reserve2Address) => {
            const balance1 = await converter.reserveBalance.call(reserve1Address);
            const balance2 = await converter.reserveBalance.call(reserve2Address);
            return { n: balance2, d: balance1 };
        };

        const getAverageRate = async (reserveAddress) => {
            const averageRate = await converter.recentAverageRate.call(reserveAddress);
            return { n: averageRate[0], d: averageRate[1] };
        };

        const getPrevAverageRate = async () => {
            const averageRateInfo = await converter.averageRateInfo.call();
            return { n: averageRateInfo.shrn(112).maskn(112), d: averageRateInfo.maskn(112) };
        };

        const getPrevAverageRateUpdateTime = async () => {
            const averageRateInfo = await converter.averageRateInfo.call();
            return averageRateInfo.shrn(224);
        };

        it('should revert when requesting the average rate for a non reserve token', async () => {
            await expectRevert(converter.recentAverageRate.call(accounts[7]), 'ERR_INVALID_RESERVE');
        });

        it('should be initially equal to the current rate', async () => {
            const averageRate = await getAverageRate(NATIVE_TOKEN_ADDRESS);
            const currentRate = await getCurrentRate(NATIVE_TOKEN_ADDRESS, reserveToken2.address);
            const prevAverageRateUpdateTime = await getPrevAverageRateUpdateTime();

            expect(averageRate.n).to.be.bignumber.equal(currentRate.n);
            expect(averageRate.d).to.be.bignumber.equal(currentRate.d);
            expect(prevAverageRateUpdateTime).to.be.bignumber.equal(new BN(0));
        });

        it('should change after a conversion', async () => {
            const amount = new BN(500);

            await convert([NATIVE_TOKEN_ADDRESS, tokenAddress, reserveToken2.address], amount, MIN_RETURN, {
                value: amount
            });
            const prevAverageRate = await getAverageRate(NATIVE_TOKEN_ADDRESS);
            const prevAverageRateUpdateTime = await getPrevAverageRateUpdateTime();

            await converter.setTime(now.add(duration.seconds(10)));

            await convert([NATIVE_TOKEN_ADDRESS, tokenAddress, reserveToken2.address], amount, MIN_RETURN, {
                value: amount
            });
            const averageRate = await getAverageRate(NATIVE_TOKEN_ADDRESS);
            const averageRateUpdateTime = await getPrevAverageRateUpdateTime();

            expect(averageRate.n).not.to.be.bignumber.equal(prevAverageRate.n);
            expect(averageRate.d).not.to.be.bignumber.equal(prevAverageRate.d);
            expect(averageRateUpdateTime).not.to.be.bignumber.equal(prevAverageRateUpdateTime);
        });

        it('should be identical to the current rate after the full average rate period has passed', async () => {
            const amount = new BN(500);

            // set initial rate
            await convert([NATIVE_TOKEN_ADDRESS, tokenAddress, reserveToken2.address], amount, MIN_RETURN, {
                value: amount
            });

            let converterTime = now.add(duration.seconds(10));
            await converter.setTime(converterTime);
            await convert([NATIVE_TOKEN_ADDRESS, tokenAddress, reserveToken2.address], amount, MIN_RETURN, {
                value: amount
            });

            const currentRate = await getCurrentRate(NATIVE_TOKEN_ADDRESS, reserveToken2.address);
            let averageRate = await getAverageRate(NATIVE_TOKEN_ADDRESS);

            expect(averageRate.n).not.to.be.bignumber.equal(currentRate.n);
            expect(averageRate.d).not.to.be.bignumber.equal(currentRate.d);

            converterTime = converterTime.add(AVERAGE_RATE_PERIOD);
            await converter.setTime(converterTime);
            averageRate = await getAverageRate(NATIVE_TOKEN_ADDRESS);

            expect(averageRate.n).to.be.bignumber.equal(currentRate.n);
            expect(averageRate.d).to.be.bignumber.equal(currentRate.d);
        });

        for (const seconds of [0, 1, 2, 3, 10, 100, 200, 300, 400, 500]) {
            const timeElapsed = duration.seconds(seconds);
            context(`${timeElapsed.toString()} seconds after conversion`, async () => {
                beforeEach(async () => {
                    const amount = new BN(500);

                    // set initial rate (a second ago)
                    await converter.setTime(now.sub(duration.seconds(1)));
                    await convert([NATIVE_TOKEN_ADDRESS, tokenAddress, reserveToken2.address], amount, MIN_RETURN, {
                        value: amount
                    });

                    // reset converter time to current time
                    await converter.setTime(now);

                    // convert
                    await convert([NATIVE_TOKEN_ADDRESS, tokenAddress, reserveToken2.address], amount, MIN_RETURN, {
                        value: amount
                    });

                    // increase the current time
                    await converter.setTime(now.add(timeElapsed));
                });

                it('should properly calculate the average rate', async () => {
                    const amount = new BN(1000);

                    const prevAverageRate = await getPrevAverageRate();
                    const currentRate = await getCurrentRate(NATIVE_TOKEN_ADDRESS, reserveToken2.address);
                    const expectedAverageRate = getExpectedAverageRate(prevAverageRate, currentRate, timeElapsed);
                    await convert([NATIVE_TOKEN_ADDRESS, tokenAddress, reserveToken2.address], amount, MIN_RETURN, {
                        value: amount
                    });
                    const averageRate = await getAverageRate(NATIVE_TOKEN_ADDRESS);

                    expectRatesAlmostEqual(averageRate, expectedAverageRate);
                });

                it('should not change more than once in a block', async () => {
                    const amount = new BN(1000);

                    await convert([NATIVE_TOKEN_ADDRESS, tokenAddress, reserveToken2.address], amount, MIN_RETURN, {
                        value: amount
                    });
                    const averageRate = await getAverageRate(NATIVE_TOKEN_ADDRESS);

                    for (let i = 0; i < 5; i++) {
                        await convert([NATIVE_TOKEN_ADDRESS, tokenAddress, reserveToken2.address], amount, MIN_RETURN, {
                            value: amount
                        });
                        let averageRate2 = await getAverageRate(NATIVE_TOKEN_ADDRESS);

                        expect(averageRate.n).to.be.bignumber.equal(averageRate2.n);
                        expect(averageRate.d).to.be.bignumber.equal(averageRate2.d);
                    }
                });

                it('should change after some time with no conversions', async () => {
                    const prevAverageRate = await getPrevAverageRate();
                    const currentRate = await getCurrentRate(NATIVE_TOKEN_ADDRESS, reserveToken2.address);

                    for (let i = 0; i < 10; i++) {
                        // increase the current time and verify that the average rate is updated accordingly
                        const delta = duration.seconds(10).mul(new BN(i));
                        const totalElapsedTime = timeElapsed.add(delta);
                        await converter.setTime(now.add(totalElapsedTime));

                        const expectedAverageRate = getExpectedAverageRate(
                            prevAverageRate,
                            currentRate,
                            totalElapsedTime
                        );
                        const averageRate = await getAverageRate(NATIVE_TOKEN_ADDRESS);

                        expectRatesAlmostEqual(averageRate, expectedAverageRate);
                    }
                });
            });
        }
    });

    describe('add/remove liquidity', () => {
        const initLiquidityPool = async (hasETH) => {
            const poolToken = await DSToken.new('name', 'symbol', 0);
            const converter = await StandardPoolConverter.new(poolToken.address, contractRegistry.address, 0);

            const reserveTokens = [
                (await TestStandardToken.new('name', 'symbol', 0, MAX_UINT256)).address,
                hasETH ? NATIVE_TOKEN_ADDRESS : (await TestStandardToken.new('name', 'symbol', 0, MAX_UINT256)).address
            ];

            for (const reserveToken of reserveTokens) {
                await converter.addReserve(reserveToken, 500000);
            }

            await poolToken.transferOwnership(converter.address);
            await converter.acceptAnchorOwnership();

            return [converter, poolToken, reserveTokens];
        };

        const approve = async (reserveToken, converter, amount) => {
            if (reserveToken === NATIVE_TOKEN_ADDRESS) {
                return;
            }

            const token = await TestStandardToken.at(reserveToken);
            return token.approve(converter.address, amount);
        };

        const getAllowance = async (reserveToken, converter) => {
            if (reserveToken === NATIVE_TOKEN_ADDRESS) {
                return new BN(0);
            }

            const token = await TestStandardToken.at(reserveToken);
            return token.allowance.call(sender, converter.address);
        };

        const getBalance = async (reserveToken, converter) => {
            if (reserveToken === NATIVE_TOKEN_ADDRESS) {
                return balance.current(converter.address);
            }

            const token = await TestStandardToken.at(reserveToken);
            return await token.balanceOf.call(converter.address);
        };

        const getLiquidityCosts = async (firstTime, converter, reserveTokens, reserveAmounts) => {
            if (firstTime) {
                return reserveAmounts.map((reserveAmount, i) => reserveAmounts);
            }

            return await Promise.all(
                reserveAmounts.map((reserveAmount, i) => converter.addLiquidityCost(reserveTokens, i, reserveAmount))
            );
        };

        const getLiquidityReturns = async (firstTime, converter, reserveTokens, reserveAmounts) => {
            if (firstTime) {
                const length = Math.round(
                    reserveAmounts.map((reserveAmount) => reserveAmount.toString()).join('').length /
                        reserveAmounts.length
                );
                const retVal = new BN('1'.padEnd(length, '0'));
                return reserveAmounts.map((reserveAmount, i) => retVal);
            }

            return await Promise.all(
                reserveAmounts.map((reserveAmount, i) => converter.addLiquidityReturn(reserveTokens[i], reserveAmount))
            );
        };

        const test = async (hasETH) => {
            const [converter, poolToken, reserveTokens] = await initLiquidityPool(hasETH);

            const state = [];
            let expected = [];
            let prevSupply = new BN(0);
            let prevBalances = reserveTokens.map((reserveToken) => new BN(0));

            for (const supplyAmount of [1000000000, 1000000, 2000000, 3000000, 4000000]) {
                const reserveAmounts = reserveTokens.map((reserveToken, i) =>
                    new BN(supplyAmount).mul(new BN(100 + i)).div(new BN(100))
                );
                await Promise.all(
                    reserveTokens.map((reserveToken, i) =>
                        approve(reserveToken, converter, reserveAmounts[i].mul(new BN(0)))
                    )
                );
                await Promise.all(
                    reserveTokens.map((reserveToken, i) =>
                        approve(reserveToken, converter, reserveAmounts[i].mul(new BN(1)))
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
                await converter.addLiquidity(reserveTokens, reserveAmounts, MIN_RETURN, {
                    value: hasETH ? reserveAmounts.slice(-1)[0] : 0
                });
                const allowances = await Promise.all(
                    reserveTokens.map((reserveToken) => getAllowance(reserveToken, converter))
                );
                const balances = await Promise.all(
                    reserveTokens.map((reserveToken) => getBalance(reserveToken, converter))
                );
                const supply = await poolToken.totalSupply.call();

                state.push({ supply: supply, balances: balances });

                for (let i = 0; i < allowances.length; i++) {
                    const diff = Decimal(allowances[i].toString()).div(reserveAmounts[i].toString());
                    expect(diff.eq('0')).to.be.true();
                }

                const actual = balances.map((balance) => Decimal(balance.toString()).div(supply.toString()));
                for (let i = 0; i < expected.length; i++) {
                    const diff = expected[i].div(actual[i]);
                    expect(diff.eq('1')).to.be.true();
                    for (const liquidityCost of liquidityCosts) {
                        expect(liquidityCost[i]).to.be.bignumber.equal(balances[i].sub(prevBalances[i]));
                    }
                }

                for (const liquidityReturn of liquidityReturns) {
                    expect(liquidityReturn).to.be.bignumber.equal(supply.sub(prevSupply));
                }

                expected = actual;
                prevSupply = supply;
                prevBalances = balances;
            }

            for (let n = state.length - 1; n > 0; n--) {
                const supplyAmount = state[n].supply.sub(new BN(state[n - 1].supply));
                const reserveAmounts = await converter.removeLiquidityReturn(supplyAmount, reserveTokens);
                await converter.removeLiquidity(
                    supplyAmount,
                    reserveTokens,
                    reserveTokens.map((reserveTokens) => 1)
                );
                const balances = await Promise.all(
                    reserveTokens.map((reserveToken) => getBalance(reserveToken, converter))
                );
                for (let i = 0; i < balances.length; i++) {
                    const diff = Decimal(state[n - 1].balances[i].toString()).div(Decimal(balances[i].toString()));
                    expect(diff.eq('1')).to.be.true();
                    expect(prevBalances[i].sub(balances[i])).to.be.bignumber.equal(reserveAmounts[i]);
                }
                prevBalances = balances;
            }

            const supplyAmount = state[0].supply;
            const reserveAmounts = await converter.removeLiquidityReturn(supplyAmount, reserveTokens);
            await converter.removeLiquidity(
                supplyAmount,
                reserveTokens,
                reserveTokens.map((reserveTokens) => 1)
            );
            const balances = await Promise.all(
                reserveTokens.map((reserveToken) => getBalance(reserveToken, converter))
            );
            for (let i = 0; i < balances.length; i++) {
                expect(balances[i]).to.be.bignumber.equal(new BN(0));
                expect(prevBalances[i].sub(balances[i])).to.be.bignumber.equal(reserveAmounts[i]);
            }
        };

        for (const hasETH of [false, true]) {
            it(`hasETH = ${hasETH}`, async () => {
                await test(hasETH);
            });
        }
    });

    describe.only('verifies that the network fee is transferred correctly', () => {
        const TOTAL_SUPPLY = new BN(1000000000000);
        const LIQUIDITY_AMOUNT = new BN(1000000000);
        const CONVERSION_AMOUNT = new BN(1000000);

        function expectAlmostEqual(actual, expected, maxAbsoluteError, maxRelativeError) {
            if (!actual.eq(expected)) {
                actual = Decimal(actual.toString());
                expected = Decimal(expected.toString());
                const absoluteError = actual.sub(expected).abs();
                const relativeError = actual.div(expected).sub(1).abs();
                expect(absoluteError.lte(maxAbsoluteError) || relativeError.lte(maxRelativeError)).to.be.true(
                    `\nabsoluteError = ${absoluteError.toFixed(25)}\nrelativeError = ${relativeError.toFixed(25)}`
                );
            }
        }

        for (let i = 1; i < 5; i++) {
            for (let j = 1; j < 5; j++) {
                for (const conversionFeePercent of [0, 5, 10, 20, 25]) {
                    for (const networkFeePercent of [0, 5, 10, 20, 25]) {
                        it(`when conversion fee = ${conversionFeePercent}% and network fee = ${networkFeePercent}%`, async () => {                
                            const poolToken = await DSToken.new('token0', 'token0', 18);
                            const reserveToken1 = await TestStandardToken.new('token1', 'token1', 18, TOTAL_SUPPLY);
                            const reserveToken2 = await TestStandardToken.new('token2', 'token2', 18, TOTAL_SUPPLY);
                            const converter = await StandardPoolConverter.new(poolToken.address, contractRegistry.address, 1000000);

                            await networkSettings.setNetworkFee(networkFeePercent * 10000);
                            await converter.setConversionFee(conversionFeePercent * 10000);
                            await converter.addReserve(reserveToken1.address, 500000);
                            await converter.addReserve(reserveToken2.address, 500000);
                            await poolToken.transferOwnership(converter.address);
                            await converter.acceptTokenOwnership();
                
                            const amount1 = LIQUIDITY_AMOUNT.muln(i);
                            const amount2 = LIQUIDITY_AMOUNT.muln(j);
                            await reserveToken1.approve(converter.address, amount1);
                            await reserveToken2.approve(converter.address, amount2);
                            await converter.addLiquidity([reserveToken1.address, reserveToken2.address], [amount1, amount2], 1);

                            const conversionPath = [reserveToken1.address, poolToken.address, reserveToken2.address];
                            await reserveToken1.approve(bancorNetwork.address, CONVERSION_AMOUNT);
                            const response = await bancorNetwork.convertByPath2(conversionPath, CONVERSION_AMOUNT, 1, ZERO_ADDRESS);
                            const events = await converter.getPastEvents('Conversion', { fromBlock: response.receipt.blockNumber });
                            const expectedFeeBase = events[0].args._conversionFee.muln(networkFeePercent).divn(200);

                            const balance1Before = await reserveToken1.balanceOf(NETWORK_FEE_WALLET);
                            const balance2Before = await reserveToken1.balanceOf(NETWORK_FEE_WALLET);

                            const reserveBalance1 = await reserveToken1.balanceOf(converter.address);
                            const reserveBalance2 = await reserveToken1.balanceOf(converter.address);
                            await converter.transferFees();

                            const balance1After = await reserveToken1.balanceOf(NETWORK_FEE_WALLET);
                            const balance2After = await reserveToken1.balanceOf(NETWORK_FEE_WALLET);

                            const expectedFee1 = expectedFeeBase.mul(reserveBalance1).div(balance2After);
                            const expectedFee2 = expectedFeeBase;

                            const actualFee1 = balance1After.sub(balance1Before);
                            const actualFee2 = balance2After.sub(balance2Before);

                            expectAlmostEqual(actualFee1, expectedFee1, '1', '0.1');
                            expectAlmostEqual(actualFee2, expectedFee2, '1', '0.1');
                        });
                    }
                }
            }
        }
    });
});
