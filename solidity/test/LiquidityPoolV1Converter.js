const { expect } = require('chai');

const { BigNumber } = require('ethers');

const { divCeil } = require('./helpers/MathUtils');

const Decimal = require('decimal.js');

const { NATIVE_TOKEN_ADDRESS, registry, ZERO_ADDRESS, MAX_UINT256, duration, latest } = require('./helpers/Constants');

const BancorNetwork = ethers.getContractFactory('BancorNetwork');
const LiquidityPoolV1Converter = ethers.getContractFactory('TestLiquidityPoolV1Converter');
const LiquidityPoolV1ConverterFactory = ethers.getContractFactory('LiquidityPoolV1ConverterFactory');
const DSToken = ethers.getContractFactory('DSToken');
const BancorFormula = ethers.getContractFactory('BancorFormula');
const ContractRegistry = ethers.getContractFactory('ContractRegistry');
const TestStandardToken = ethers.getContractFactory('TestStandardToken');
const TestNonStandardToken = ethers.getContractFactory('TestNonStandardToken');
const ConverterFactory = ethers.getContractFactory('ConverterFactory');
const ConverterUpgrader = ethers.getContractFactory('ConverterUpgrader');

let now;
let bancorNetwork;
let token;
let tokenAddress;
let contractRegistry;
let reserveToken;
let reserveToken2;
let reserveToken3;
let upgrader;
let sender;
let sender2;

const MIN_RETURN = BigNumber.from(1);
const PPM_RESOLUTION = BigNumber.from(1000000);

describe('LiquidityPoolV1Converter', () => {
    const createConverter = async (tokenAddress, registryAddress = contractRegistry.address, maxConversionFee = 0) => {
        return await (await LiquidityPoolV1Converter).deploy(tokenAddress, registryAddress, maxConversionFee);
    };

    const initConverter = async (activate, isETHReserve, maxConversionFee = 0, isStandardPool = false) => {
        token = await (await DSToken).deploy('Token1', 'TKN1', 2);
        tokenAddress = token.address;

        const converter = await createConverter(tokenAddress, contractRegistry.address, maxConversionFee);
        await converter.addReserve(getReserve1Address(isETHReserve), isStandardPool ? 500000 : 250000);
        await converter.addReserve(reserveToken2.address, isStandardPool ? 500000 : 150000);
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

        now = await latest();
        await converter.setTime(now);

        return converter;
    };

    const removeLiquidityTest = async (poolTokenAmount, reserveTokens) => {
        const inputAmount = BigNumber.from(poolTokenAmount);
        const converter = await initConverter(true, false, 0, true);
        const poolTokenSupply = await token.totalSupply();
        const reserveBalances = await Promise.all(
            reserveTokens.map((reserveToken) => converter.reserveBalance(reserveToken.address))
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
        reserveTokens.map((reserveToken, i) => expect(actualOutputAmounts[i]).to.be.equal(expectedOutputAmounts[i]));
    };

    const getReserve1Address = (isETH) => {
        return isETH ? NATIVE_TOKEN_ADDRESS : reserveToken.address;
    };

    const getBalance = async (token, address, account) => {
        if (address === NATIVE_TOKEN_ADDRESS) {
            return ethers.provider.getBalance(account);
        }

        return token.balanceOf(account);
    };

    const getTransactionCost = async (txResult) => {
        const cumulativeGasUsed = (await txResult.wait()).cumulativeGasUsed;
        return BigNumber.from(txResult.gasPrice).mul(BigNumber.from(cumulativeGasUsed));
    };

    const convert = async (path, amount, minReturn, options = {}) => {
        return bancorNetwork.convertByPath2(path, amount, minReturn, ZERO_ADDRESS, options);
    };

    const divCeil2 = (num, d) => {
        const dm = num.divmod(d);
        if (dm.mod.isZero()) {
            return dm.div;
        }

        return dm.div.negative !== 0 ? dm.div.isubn(1) : dm.div.iaddn(1);
    };

    before(async () => {
        accounts = await ethers.getSigners();

        sender = accounts[0];
        sender2 = accounts[9];

        // The following contracts are unaffected by the underlying tests, this can be shared.
        const bancorFormula = await (await BancorFormula).deploy();
        await bancorFormula.init();
        contractRegistry = await (await ContractRegistry).deploy();

        await contractRegistry.registerAddress(registry.BANCOR_FORMULA, bancorFormula.address);

        const factory = await (await ConverterFactory).deploy();
        await contractRegistry.registerAddress(registry.CONVERTER_FACTORY, factory.address);

        await factory.registerTypedConverterFactory((await (await LiquidityPoolV1ConverterFactory).deploy()).address);
    });

    beforeEach(async () => {
        bancorNetwork = await (await BancorNetwork).deploy(contractRegistry.address);
        await contractRegistry.registerAddress(registry.BANCOR_NETWORK, bancorNetwork.address);

        upgrader = await (await ConverterUpgrader).deploy(contractRegistry.address);
        await contractRegistry.registerAddress(registry.CONVERTER_UPGRADER, upgrader.address);

        const token = await (await DSToken).deploy('Token1', 'TKN1', 2);
        tokenAddress = token.address;

        reserveToken = await (await TestStandardToken).deploy('ERC Token 1', 'ERC1', 18, 1000000000);
        reserveToken2 = await (await TestNonStandardToken).deploy('ERC Token 2', 'ERC2', 18, 2000000000);
        reserveToken3 = await (await TestStandardToken).deploy('ERC Token 3', 'ERC3', 18, 1500000000);
    });

    it('verifies the Activation event after converter activation', async () => {
        const converter = await initConverter(false, false);
        await token.transferOwnership(converter.address);
        const res = await converter.acceptTokenOwnership();

        expect(res).to.emit(converter, 'Activation').withArgs(BigNumber.from(1), tokenAddress, true);
    });

    it('verifies the TokenRateUpdate event after adding liquidity', async () => {
        const converter = await initConverter(true, false);

        const value = BigNumber.from(500);
        await reserveToken.connect(sender).approve(converter.address, value);
        await reserveToken2.connect(sender).approve(converter.address, value);

        const res = await converter.addLiquidity(
            [reserveToken.address, reserveToken2.address],
            [value, value],
            MIN_RETURN
        );

        const poolTokenSupply = await token.totalSupply();
        const reserve1Balance = await converter.reserveBalance(reserveToken.address);
        const reserve1Weight = await converter.reserveWeight(reserveToken.address);
        const reserve2Balance = await converter.reserveBalance(reserveToken2.address);
        const reserve2Weight = await converter.reserveWeight(reserveToken2.address);

        expect(res)
            .to.emit(converter, 'TokenRateUpdate')
            .withArgs(
                tokenAddress,
                reserveToken.address,
                reserve1Balance.mul(PPM_RESOLUTION),
                poolTokenSupply.mul(reserve1Weight)
            );

        expect(res)
            .to.emit(converter, 'TokenRateUpdate')
            .withArgs(
                tokenAddress,
                reserveToken2.address,
                reserve2Balance.mul(PPM_RESOLUTION),
                poolTokenSupply.mul(reserve2Weight)
            );
    });

    it('verifies the TokenRateUpdate event after removing liquidity', async () => {
        const converter = await initConverter(true, false);

        const res = await converter.removeLiquidity(
            100,
            [reserveToken.address, reserveToken2.address],
            [MIN_RETURN, MIN_RETURN]
        );

        const poolTokenSupply = await token.totalSupply();
        const reserve1Balance = await converter.reserveBalance(reserveToken.address);
        const reserve1Weight = await converter.reserveWeight(reserveToken.address);
        const reserve2Balance = await converter.reserveBalance(reserveToken2.address);
        const reserve2Weight = await converter.reserveWeight(reserveToken2.address);

        expect(res)
            .to.emit(converter, 'TokenRateUpdate')
            .withArgs(
                tokenAddress,
                reserveToken.address,
                reserve1Balance.mul(PPM_RESOLUTION),
                poolTokenSupply.mul(reserve1Weight)
            );

        expect(res)
            .to.emit(converter, 'TokenRateUpdate')
            .withArgs(
                tokenAddress,
                reserveToken2.address,
                reserve2Balance.mul(PPM_RESOLUTION),
                poolTokenSupply.mul(reserve2Weight)
            );
    });

    it('verifies function removeLiquidity when the reserves tokens are passed in the initial order', async () => {
        await removeLiquidityTest(100, [reserveToken, reserveToken2]);
    });

    it('verifies function removeLiquidity when the reserves tokens are passed in the opposite order', async () => {
        await removeLiquidityTest(100, [reserveToken2, reserveToken]);
    });

    for (let isETHReserve = 0; isETHReserve < 2; isETHReserve++) {
        describe(`${isETHReserve === 0 ? '(with ERC20 reserves)' : '(with ETH reserve)'}:`, () => {
            it('verifies that convert returns valid amount and fee after converting', async () => {
                const converter = await initConverter(true, isETHReserve, 5000);
                await converter.setConversionFee(3000);

                const amount = BigNumber.from(500);
                let value = 0;
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
                    { value }
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
                let value = 0;
                if (isETHReserve) {
                    value = amount;
                } else {
                    await reserveToken.connect(sender).approve(bancorNetwork.address, amount);
                }

                const res = await convert(
                    [getReserve1Address(isETHReserve), tokenAddress, reserveToken2.address],
                    amount,
                    MIN_RETURN,
                    { value }
                );

                const poolTokenSupply = await token.totalSupply();
                const reserve1Balance = await converter.reserveBalance(getReserve1Address(isETHReserve));
                const reserve1Weight = await converter.reserveWeight(getReserve1Address(isETHReserve));
                const reserve2Balance = await converter.reserveBalance(reserveToken2.address);
                const reserve2Weight = await converter.reserveWeight(reserveToken2.address);

                const events = await converter.queryFilter('TokenRateUpdate', res.blockNumber, res.blockNumber);

                // TokenRateUpdate for [source, target):
                const { args: event1 } = events[0];
                expect(event1._token1).to.eql(getReserve1Address(isETHReserve));
                expect(event1._token2).to.eql(reserveToken2.address);
                expect(event1._rateN).to.be.equal(reserve2Balance.mul(reserve1Weight));
                expect(event1._rateD).to.be.equal(reserve1Balance.mul(reserve2Weight));

                // TokenRateUpdate for [source, pool token):
                const { args: event2 } = events[1];
                expect(event2._token1).to.eql(tokenAddress);
                expect(event2._token2).to.eql(getReserve1Address(isETHReserve));
                expect(event2._rateN).to.be.equal(reserve1Balance.mul(PPM_RESOLUTION));
                expect(event2._rateD).to.be.equal(poolTokenSupply.mul(reserve1Weight));

                // TokenRateUpdate for [pool token, target):
                const { args: event3 } = events[2];
                expect(event3._token1).to.eql(tokenAddress);
                expect(event3._token2).to.eql(reserveToken2.address);
                expect(event3._rateN).to.be.equal(reserve2Balance.mul(PPM_RESOLUTION));
                expect(event3._rateD).to.be.equal(poolTokenSupply.mul(reserve2Weight));
            });

            it('should revert when attempting to convert when the return is smaller than the minimum requested amount', async () => {
                await initConverter(true, isETHReserve);

                const amount = BigNumber.from(500);
                let value = 0;
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

            for (const percent of [50, 75, 100]) {
                it(`verifies that fund executes when the reserve ratio equals ${percent}%`, async () => {
                    const converter = await initConverter(false, isETHReserve);
                    await converter.addReserve(reserveToken3.address, (percent - 40) * 10000);

                    await reserveToken3.transfer(converter.address, 6000);

                    await token.transferOwnership(converter.address);
                    await converter.acceptTokenOwnership();

                    const prevBalance = await token.balanceOf(sender.address);

                    const amount = BigNumber.from(100000);
                    let value = 0;
                    if (isETHReserve) {
                        value = amount;
                    } else {
                        await reserveToken.connect(sender).approve(converter.address, amount);
                    }

                    await reserveToken2.connect(sender).approve(converter.address, amount);
                    await reserveToken3.connect(sender).approve(converter.address, amount);

                    const amount2 = BigNumber.from(100);
                    await converter.fund(amount2, { value });

                    const balance = await token.balanceOf(sender.address);
                    expect(balance).to.be.equal(prevBalance.add(amount2));
                });
            }

            it('verifies that fund gets the correct reserve balance amounts from the caller', async () => {
                const converter = await initConverter(false, isETHReserve);
                await converter.addReserve(reserveToken3.address, 600000);

                await reserveToken3.transfer(converter.address, 6000);

                await token.transferOwnership(converter.address);
                await converter.acceptTokenOwnership();

                await reserveToken.transfer(sender2.address, 5000);
                await reserveToken2.transfer(sender2.address, 5000);
                await reserveToken3.transfer(sender2.address, 5000);

                const supply = await token.totalSupply();
                const percentage = BigNumber.from(19);
                const prevReserve1Balance = await converter.reserveBalance(getReserve1Address(isETHReserve));
                const prevReserve2Balance = await converter.reserveBalance(reserveToken2.address);
                const prevReserve3Balance = await converter.reserveBalance(reserveToken3.address);
                const token1Amount = divCeil(prevReserve1Balance.mul(percentage), supply);
                const token2Amount = divCeil(prevReserve2Balance.mul(percentage), supply);
                const token3Amount = divCeil(prevReserve3Balance.mul(percentage), supply);

                const amount = BigNumber.from(100000);
                let value = 0;
                if (isETHReserve) {
                    value = amount;
                } else {
                    await reserveToken.connect(sender2).approve(converter.address, amount);
                }

                await reserveToken2.connect(sender2).approve(converter.address, amount);
                await reserveToken3.connect(sender2).approve(converter.address, amount);
                await converter.connect(sender2).fund(percentage, { value: value });

                const reserve1Balance = await converter.reserveBalance(getReserve1Address(isETHReserve));
                const reserve2Balance = await converter.reserveBalance(reserveToken2.address);
                const reserve3Balance = await converter.reserveBalance(reserveToken3.address);

                expect(reserve1Balance).to.be.equal(prevReserve1Balance.add(token1Amount));
                expect(reserve2Balance).to.be.equal(prevReserve2Balance.add(token2Amount));
                expect(reserve3Balance).to.be.equal(prevReserve3Balance.add(token3Amount));
            });

            it('verifies that increasing the liquidity by a large amount gets the correct reserve balance amounts from the caller', async () => {
                const converter = await initConverter(false, isETHReserve);
                await converter.addReserve(reserveToken3.address, 600000);

                await reserveToken3.transfer(converter.address, 6000);

                await token.transferOwnership(converter.address);
                await converter.acceptTokenOwnership();

                await reserveToken.transfer(sender2.address, 500000);
                await reserveToken2.transfer(sender2.address, 500000);
                await reserveToken3.transfer(sender2.address, 500000);

                const supply = await token.totalSupply();
                const percentage = BigNumber.from(140854);
                const prevReserve1Balance = await converter.reserveBalance(getReserve1Address(isETHReserve));
                const prevReserve2Balance = await converter.reserveBalance(reserveToken2.address);
                const prevReserve3Balance = await converter.reserveBalance(reserveToken3.address);
                const token1Amount = divCeil(prevReserve1Balance.mul(percentage), supply);
                const token2Amount = divCeil(prevReserve2Balance.mul(percentage), supply);
                const token3Amount = divCeil(prevReserve3Balance.mul(percentage), supply);

                const amount = BigNumber.from(100000);
                let value = 0;
                if (isETHReserve) {
                    value = amount;
                } else {
                    await reserveToken.connect(sender2).approve(converter.address, amount);
                }

                await reserveToken2.connect(sender2).approve(converter.address, amount);
                await reserveToken3.connect(sender2).approve(converter.address, amount);
                await converter.connect(sender2).fund(percentage, { value: value });

                const reserve1Balance = await converter.reserveBalance(getReserve1Address(isETHReserve));
                const reserve2Balance = await converter.reserveBalance(reserveToken2.address);
                const reserve3Balance = await converter.reserveBalance(reserveToken3.address);

                expect(reserve1Balance).to.be.equal(prevReserve1Balance.add(token1Amount));
                expect(reserve2Balance).to.be.equal(prevReserve2Balance.add(token2Amount));
                expect(reserve3Balance).to.be.equal(prevReserve3Balance.add(token3Amount));
            });

            it('should revert when attempting to fund the converter with insufficient funds', async () => {
                const converter = await initConverter(false, isETHReserve);
                await converter.addReserve(reserveToken3.address, 600000);

                await reserveToken3.transfer(converter.address, 6000);

                await token.transferOwnership(converter.address);
                await converter.acceptTokenOwnership();

                await reserveToken.transfer(sender2.address, 100);
                await reserveToken2.transfer(sender2.address, 100);
                await reserveToken3.transfer(sender2.address, 100);

                const amount = BigNumber.from(100000);
                let value = 0;
                if (isETHReserve) {
                    value = amount;
                } else {
                    await reserveToken.connect(sender2).approve(converter.address, amount);
                }

                await reserveToken2.connect(sender2).approve(converter.address, amount);
                await reserveToken3.connect(sender2).approve(converter.address, amount);
                await converter.connect(sender2).fund(5, { value: value });

                await expect(converter.connect(sender2).fund(600, { value: value })).to.be.reverted;
            });

            for (const percent of [50, 75, 100]) {
                it(`verifies that liquidate executes when the reserve ratio equals ${percent}%`, async () => {
                    const converter = await initConverter(false, isETHReserve);
                    await converter.addReserve(reserveToken3.address, (percent - 40) * 10000);

                    await reserveToken3.transfer(converter.address, 6000);

                    await token.transferOwnership(converter.address);
                    await converter.acceptTokenOwnership();

                    const prevSupply = await token.totalSupply();
                    await converter.liquidate(100);
                    const supply = await token.totalSupply();

                    expect(prevSupply).to.be.equal(supply.add(BigNumber.from(100)));
                });
            }

            it('verifies that liquidate sends the correct reserve balance amounts to the caller', async () => {
                const converter = await initConverter(false, isETHReserve);
                await converter.addReserve(reserveToken3.address, 600000);

                await reserveToken3.transfer(converter.address, 6000);

                await token.transferOwnership(converter.address);
                await converter.acceptTokenOwnership();

                await token.transfer(sender2.address, 100);

                const supply = await token.totalSupply();
                const percentage = BigNumber.from(19);
                const reserve1Balance = await converter.reserveBalance(getReserve1Address(isETHReserve));
                const reserve2Balance = await converter.reserveBalance(reserveToken2.address);
                const reserve3Balance = await converter.reserveBalance(reserveToken3.address);
                const token1Amount = reserve1Balance.mul(percentage).div(supply);
                const token2Amount = reserve2Balance.mul(percentage).div(supply);
                const token3Amount = reserve3Balance.mul(percentage).div(supply);

                const token1PrevBalance = await getBalance(
                    reserveToken,
                    getReserve1Address(isETHReserve),
                    sender2.address
                );
                const token2PrevBalance = await reserveToken2.balanceOf(sender2.address);
                const token3PrevBalance = await reserveToken3.balanceOf(sender2.address);
                const res = await converter.connect(sender2).liquidate(percentage);

                let transactionCost = BigNumber.from(0);
                if (isETHReserve) {
                    transactionCost = await getTransactionCost(res);
                }

                const token1Balance = await getBalance(reserveToken, getReserve1Address(isETHReserve), sender2.address);
                const token2Balance = await reserveToken2.balanceOf(sender2.address);
                const token3Balance = await reserveToken3.balanceOf(sender2.address);

                expect(token1Balance).to.be.equal(token1PrevBalance.add(token1Amount.sub(transactionCost)));
                expect(token2Balance).to.be.equal(token2PrevBalance.add(token2Amount));
                expect(token3Balance).to.be.equal(token3PrevBalance.add(token3Amount));
            });

            it('verifies that liquidating a large amount sends the correct reserve balance amounts to the caller', async () => {
                const converter = await initConverter(false, isETHReserve);
                await converter.addReserve(reserveToken3.address, 600000);

                await reserveToken3.transfer(converter.address, 6000);

                await token.transferOwnership(converter.address);
                await converter.acceptTokenOwnership();

                await token.transfer(sender2.address, 15000);

                const supply = await token.totalSupply();
                const percentage = BigNumber.from(14854);
                const reserve1Balance = await converter.reserveBalance(getReserve1Address(isETHReserve));
                const reserve2Balance = await converter.reserveBalance(reserveToken2.address);
                const reserve3Balance = await converter.reserveBalance(reserveToken3.address);
                const token1Amount = reserve1Balance.mul(percentage).div(supply);
                const token2Amount = reserve2Balance.mul(percentage).div(supply);
                const token3Amount = reserve3Balance.mul(percentage).div(supply);

                const token1PrevBalance = await getBalance(
                    reserveToken,
                    getReserve1Address(isETHReserve),
                    sender2.address
                );
                const token2PrevBalance = await reserveToken2.balanceOf(sender2.address);
                const token3PrevBalance = await reserveToken3.balanceOf(sender2.address);
                const res = await converter.connect(sender2).liquidate(14854);

                let transactionCost = BigNumber.from(0);
                if (isETHReserve) {
                    transactionCost = await getTransactionCost(res);
                }

                const token1Balance = await getBalance(reserveToken, getReserve1Address(isETHReserve), sender2.address);
                const token2Balance = await reserveToken2.balanceOf(sender2.address);
                const token3Balance = await reserveToken3.balanceOf(sender2.address);

                expect(token1Balance).to.be.equal(token1PrevBalance.add(token1Amount.sub(transactionCost)));
                expect(token2Balance).to.be.equal(token2PrevBalance.add(token2Amount));
                expect(token3Balance).to.be.equal(token3PrevBalance.add(token3Amount));
            });

            it('verifies that liquidating the entire supply sends the full reserve balances to the caller', async () => {
                const converter = await initConverter(false, isETHReserve);
                await converter.addReserve(reserveToken3.address, 600000);

                await reserveToken3.transfer(converter.address, 6000);

                await token.transferOwnership(converter.address);
                await converter.acceptTokenOwnership();

                await token.transfer(sender2.address, 20000);

                const reserve1Balance = await converter.reserveBalance(getReserve1Address(isETHReserve));
                const reserve2Balance = await converter.reserveBalance(reserveToken2.address);
                const reserve3Balance = await converter.reserveBalance(reserveToken3.address);

                const token1PrevBalance = await getBalance(
                    reserveToken,
                    getReserve1Address(isETHReserve),
                    sender2.address
                );
                const token2PrevBalance = await reserveToken2.balanceOf(sender2.address);
                const token3PrevBalance = await reserveToken3.balanceOf(sender2.address);
                const res = await converter.connect(sender2).liquidate(20000);

                let transactionCost = BigNumber.from(0);
                if (isETHReserve) {
                    transactionCost = await getTransactionCost(res);
                }

                const supply = await token.totalSupply();
                const token1Balance = await getBalance(reserveToken, getReserve1Address(isETHReserve), sender2.address);
                const token2Balance = await reserveToken2.balanceOf(sender2.address);
                const token3Balance = await reserveToken3.balanceOf(sender2.address);

                expect(supply).to.be.equal(BigNumber.from(0));
                expect(token1PrevBalance.add(reserve1Balance).sub(transactionCost)).to.be.equal(token1Balance);
                expect(token2PrevBalance.add(reserve2Balance)).to.be.equal(token2Balance);
                expect(token3PrevBalance.add(reserve3Balance)).to.be.equal(token3Balance);
            });

            it('should revert when attempting to liquidate with insufficient funds', async () => {
                const converter = await initConverter(false, isETHReserve);
                await converter.addReserve(reserveToken3.address, 600000);

                await reserveToken3.transfer(converter.address, 6000);

                await token.transferOwnership(converter.address);
                await converter.acceptTokenOwnership();

                await token.transfer(sender2.address, 100);

                await converter.connect(sender2).liquidate(5);

                await expect(converter.connect(sender2).liquidate(600)).to.be.reverted;
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
            const token = await (await DSToken).deploy('Token', 'TKN', 0);
            converter = await (await LiquidityPoolV1Converter).deploy(token.address, contractRegistry.address, 0);
            reserveToken1 = await (await TestStandardToken).deploy('ERC Token 1', 'ERC1', 18, 1000000000);
            reserveToken2 = await (await TestStandardToken).deploy('ERC Token 2', 'ERC2', 18, 1000000000);
            await converter.addReserve(reserveToken1.address, 500000);
            await converter.addReserve(reserveToken2.address, 500000);
            await token.transferOwnership(converter.address);
            await converter.acceptTokenOwnership();
        });

        for (const [amount1, amount2] of amounts) {
            it(`addLiquidity(${[amount1, amount2]})`, async () => {
                await reserveToken1.connect(sender).approve(converter.address, amount1);
                await reserveToken2.connect(sender).approve(converter.address, amount2);
                await converter.addLiquidity([reserveToken1.address, reserveToken2.address], [amount1, amount2], 1);
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
                    const token = await (await DSToken).deploy('Token', 'TKN', 0);
                    const converter = await (await LiquidityPoolV1Converter).deploy(
                        token.address,
                        contractRegistry.address,
                        0
                    );
                    const reserveToken1 = await (await TestStandardToken).deploy('ERC Token 1', 'ERC1', 18, 1000000000);
                    const reserveToken2 = await (await TestStandardToken).deploy('ERC Token 2', 'ERC2', 18, 1000000000);
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
                            .addLiquidity([reserveToken1.address, reserveToken2.address], [amount, amount], MIN_RETURN);
                        const balance = await token.balanceOf(sender2.address);
                        lastAmount = balance.sub(lastAmount);
                    }
                    for (const percent of percents) {
                        await converter
                            .connect(sender2)
                            .removeLiquidity(
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
        const AVERAGE_RATE_PERIOD = duration.minutes(10);

        let converter;
        beforeEach(async () => {
            converter = await initConverter(true, true, 5000, true);
        });

        const getExpectedAverageRate = (prevAverageRate, currentRate, timeElapsed) => {
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

        const expectRatesAlmostEqual = (rate, newRate) => {
            const rate1 = Decimal(rate.n.toString()).div(Decimal(rate.d.toString()));
            const rate2 = Decimal(newRate.n.toString()).div(Decimal(newRate.d.toString()));

            if (!rate1.eq(rate2)) {
                const error = Decimal(rate1.toString()).div(rate2.toString()).sub(1).abs();
                expect(error.lte('0.000002')).to.be.true;
            }
        };

        const getCurrentRate = async (reserve1Address, reserve2Address) => {
            const balance1 = await converter.reserveBalance(reserve1Address);
            const balance2 = await converter.reserveBalance(reserve2Address);
            return { n: balance2, d: balance1 };
        };

        const getAverageRate = async (reserveAddress) => {
            const averageRate = await converter.recentAverageRate(reserveAddress);
            return { n: averageRate[0], d: averageRate[1] };
        };

        const getPrevAverageRate = async () => {
            const prevAverageRate = await converter.prevAverageRate();
            return { n: prevAverageRate[0], d: prevAverageRate[1] };
        };

        const getPrevAverageRateUpdateTime = async () => {
            const prevAverageRateUpdateTime = await converter.prevAverageRateUpdateTime();
            return prevAverageRateUpdateTime;
        };

        it('should revert when requesting the average rate for a non reserve token', async () => {
            await expect(converter.recentAverageRate(accounts[7].address)).to.be.revertedWith('ERR_INVALID_RESERVE');
        });

        it('should be initially equal to the current rate', async () => {
            const averageRate = await getAverageRate(NATIVE_TOKEN_ADDRESS);
            const currentRate = await getCurrentRate(NATIVE_TOKEN_ADDRESS, reserveToken2.address);
            const prevAverageRateUpdateTime = await getPrevAverageRateUpdateTime();

            expect(averageRate.n).to.be.equal(currentRate.n);
            expect(averageRate.d).to.be.equal(currentRate.d);
            expect(prevAverageRateUpdateTime).to.be.equal(BigNumber.from(0));
        });

        it('should change after a conversion', async () => {
            const amount = BigNumber.from(500);

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

            expect(averageRate.n).not.to.be.equal(prevAverageRate.n);
            expect(averageRate.d).not.to.be.equal(prevAverageRate.d);
            expect(averageRateUpdateTime).not.to.be.equal(prevAverageRateUpdateTime);
        });

        it('should be identical to the current rate after the full average rate period has passed', async () => {
            const amount = BigNumber.from(500);

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

            expect(averageRate.n).not.to.be.equal(currentRate.n);
            expect(averageRate.d).not.to.be.equal(currentRate.d);

            converterTime = converterTime.add(AVERAGE_RATE_PERIOD);
            await converter.setTime(converterTime);
            averageRate = await getAverageRate(NATIVE_TOKEN_ADDRESS);

            expect(averageRate.n).to.be.equal(currentRate.n);
            expect(averageRate.d).to.be.equal(currentRate.d);
        });

        for (const seconds of [0, 1, 2, 3, 10, 100, 200, 300, 400, 500]) {
            const timeElapsed = duration.seconds(seconds);
            context(`${timeElapsed.toString()} seconds after conversion`, async () => {
                beforeEach(async () => {
                    const amount = BigNumber.from(500);

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
                    const amount = BigNumber.from(1000);

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
                    const amount = BigNumber.from(1000);

                    await convert([NATIVE_TOKEN_ADDRESS, tokenAddress, reserveToken2.address], amount, MIN_RETURN, {
                        value: amount
                    });
                    const averageRate = await getAverageRate(NATIVE_TOKEN_ADDRESS);

                    for (let i = 0; i < 5; i++) {
                        await convert([NATIVE_TOKEN_ADDRESS, tokenAddress, reserveToken2.address], amount, MIN_RETURN, {
                            value: amount
                        });
                        let averageRate2 = await getAverageRate(NATIVE_TOKEN_ADDRESS);

                        expect(averageRate.n).to.be.equal(averageRate2.n);
                        expect(averageRate.d).to.be.equal(averageRate2.d);
                    }
                });

                it('should change after some time with no conversions', async () => {
                    const prevAverageRate = await getPrevAverageRate();
                    const currentRate = await getCurrentRate(NATIVE_TOKEN_ADDRESS, reserveToken2.address);

                    for (let i = 0; i < 10; i++) {
                        // increase the current time and verify that the average rate is updated accordingly
                        const delta = duration.seconds(10).mul(BigNumber.from(i));
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
            const poolToken = await (await DSToken).deploy('name', 'symbol', 0);
            const converter = await (await LiquidityPoolV1Converter).deploy(
                poolToken.address,
                contractRegistry.address,
                0
            );

            const reserveTokens = [
                (await (await TestStandardToken).deploy('name', 'symbol', 0, MAX_UINT256)).address,
                hasETH
                    ? NATIVE_TOKEN_ADDRESS
                    : (await (await TestStandardToken).deploy('name', 'symbol', 0, MAX_UINT256)).address
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

            const token = await (await TestStandardToken).attach(reserveToken);
            return token.approve(converter.address, amount);
        };

        const getAllowance = async (reserveToken, converter) => {
            if (reserveToken === NATIVE_TOKEN_ADDRESS) {
                return BigNumber.from(0);
            }

            const token = await (await TestStandardToken).attach(reserveToken);
            return token.allowance(sender.address, converter.address);
        };

        const getBalance = async (reserveToken, converter) => {
            if (reserveToken === NATIVE_TOKEN_ADDRESS) {
                return ethers.provider.getBalance(converter.address);
            }

            const token = await (await TestStandardToken).attach(reserveToken);
            return await token.balanceOf(converter.address);
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
                const retVal = BigNumber.from('1'.padEnd(length, '0'));
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
            let prevSupply = BigNumber.from(0);
            let prevBalances = reserveTokens.map((reserveToken) => BigNumber.from(0));

            for (const supplyAmount of [1000000000, 1000000, 2000000, 3000000, 4000000]) {
                const reserveAmounts = reserveTokens.map((reserveToken, i) =>
                    BigNumber.from(supplyAmount)
                        .mul(BigNumber.from(100 + i))
                        .div(BigNumber.from(100))
                );
                await Promise.all(
                    reserveTokens.map((reserveToken, i) =>
                        approve(reserveToken, converter, reserveAmounts[i].mul(BigNumber.from(0)))
                    )
                );
                await Promise.all(
                    reserveTokens.map((reserveToken, i) =>
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
                await converter.addLiquidity(reserveTokens, reserveAmounts, MIN_RETURN, {
                    value: hasETH ? reserveAmounts.slice(-1)[0] : 0
                });
                const allowances = await Promise.all(
                    reserveTokens.map((reserveToken) => getAllowance(reserveToken, converter))
                );
                const balances = await Promise.all(
                    reserveTokens.map((reserveToken) => getBalance(reserveToken, converter))
                );
                const supply = await poolToken.totalSupply();

                state.push({ supply: supply, balances: balances });

                for (let i = 0; i < allowances.length; i++) {
                    const diff = Decimal(allowances[i].toString()).div(reserveAmounts[i].toString());
                    expect(diff.eq('0')).to.be.true;
                }

                const actual = balances.map((balance) => Decimal(balance.toString()).div(supply.toString()));
                for (let i = 0; i < expected.length; i++) {
                    const diff = expected[i].div(actual[i]);
                    expect(diff.eq('1')).to.be.true;
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
                    expect(diff.eq('1')).to.be.true;
                    expect(prevBalances[i].sub(balances[i])).to.be.equal(reserveAmounts[i]);
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
});
