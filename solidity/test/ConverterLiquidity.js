const { expect } = require('chai');
const { expectRevert, BN, balance } = require('@openzeppelin/test-helpers');
const Decimal = require('decimal.js');

const { ETH_RESERVE_ADDRESS, registry } = require('./helpers/Constants');

const LiquidityPoolV1Converter = artifacts.require('LiquidityPoolV1Converter');
const DSToken = artifacts.require('DSToken');
const ERC20Token = artifacts.require('ERC20Token');
const BancorFormula = artifacts.require('BancorFormula');
const ContractRegistry = artifacts.require('ContractRegistry');

contract('ConverterLiquidity', accounts => {
    const initLiquidityPool = async (hasETH, ...weights) => {
        const poolToken = await DSToken.new('name', 'symbol', 0);
        const converter = await LiquidityPoolV1Converter.new(poolToken.address, contractRegistry.address, 0);

        for (let i = 0; i < weights.length; i++) {
            if (hasETH && i === weights.length - 1) {
                await converter.addReserve(ETH_RESERVE_ADDRESS, weights[i] * 10000);
            }
            else {
                const erc20Token = await ERC20Token.new('name', 'symbol', 0, -1);
                await converter.addReserve(erc20Token.address, weights[i] * 10000);
            }
        }

        await poolToken.transferOwnership(converter.address);
        await converter.acceptAnchorOwnership();

        return [converter, poolToken];
    };

    let contractRegistry;
    const owner = accounts[0];

    const MIN_RETURN = new BN(1);

    before(async () => {
        // The following contracts are unaffected by the underlying tests, thus can be shared
        contractRegistry = await ContractRegistry.new();
        const bancorFormula = await BancorFormula.new();
        await bancorFormula.init();
        await contractRegistry.registerAddress(registry.BANCOR_FORMULA, bancorFormula.address);
    });

    describe('security assertion', () => {
        let converter;
        let poolToken;
        let reserveTokens;

        const weights = [1, 2, 3, 4, 5];
        const reserveAmounts = weights.map(weight => 1);

        context('without ether reserve', async () => {
            beforeEach(async () => {
                [converter, poolToken] = await initLiquidityPool(false, ...weights);
                reserveTokens = await Promise.all(weights.map((weight, i) => converter.reserveTokens.call(i)));
            });

            it('should revert if the number of input reserve tokens is not equal to the number of reserve tokens', async () => {
                await expectRevert(converter.addLiquidity(reserveTokens.slice(0, -1), reserveAmounts, MIN_RETURN), 'ERR_INVALID_RESERVE');
            });

            it('should revert if the number of input reserve amounts is not equal to the number of reserve tokens', async () => {
                await expectRevert(converter.addLiquidity(reserveTokens, reserveAmounts.slice(0, -1), MIN_RETURN), 'ERR_INVALID_AMOUNT');
            });

            it('should revert if any of the input reserve tokens is not one of the reserve tokens', async () => {
                await expectRevert(converter.addLiquidity([...reserveTokens.slice(0, -1), poolToken.address], reserveAmounts,
                    MIN_RETURN), 'ERR_INVALID_RESERVE');
            });

            it('should revert if any of the reserve tokens is not within the input reserve tokens', async () => {
                await expectRevert(converter.addLiquidity([...reserveTokens.slice(0, -1), reserveTokens[0]], reserveAmounts,
                    MIN_RETURN), 'ERR_INVALID_RESERVE');
            });

            it('should revert if the minimum-return is not larger than zero', async () => {
                await expectRevert(converter.addLiquidity(reserveTokens, reserveAmounts, 0), 'ERR_ZERO_AMOUNT');
            });

            it('should revert if the minimum-return is larger than the return', async () => {
                await Promise.all(reserveTokens.map((reserveToken, i) => approve(reserveToken, converter, reserveAmounts[i])));
                await expectRevert(converter.addLiquidity(reserveTokens, reserveAmounts, -1), 'ERR_RETURN_TOO_LOW');
            });

            it('should revert if any of the input reserve amounts is not larger than zero', async () => {
                await expectRevert(converter.addLiquidity(reserveTokens, [...reserveAmounts.slice(0, -1), 0], MIN_RETURN),
                    'ERR_INVALID_AMOUNT');
            });

            it('should revert if the input value to a non-ether converter is larger than zero', async () => {
                await expectRevert(converter.addLiquidity(reserveTokens, reserveAmounts, MIN_RETURN,
                    { value: reserveAmounts.slice(-1)[0] }), 'ERR_NO_ETH_RESERVE');
            });
        });

        context('with ether reserve', async () => {
            beforeEach(async () => {
                [converter, poolToken] = await initLiquidityPool(true, ...weights);
                reserveTokens = await Promise.all(weights.map((weight, i) => converter.reserveTokens.call(i)));
            });

            it('should revert if the input value is not equal to the input amount of ether', async () => {
                await expectRevert(converter.addLiquidity(reserveTokens, reserveAmounts, MIN_RETURN,
                    { value: reserveAmounts.slice(-1)[0] + 1 }), 'ERR_ETH_AMOUNT_MISMATCH');
            });
        });
    });

    describe('functionality assertion', () => {
        const test = (hasETH, ...weights) => {
            it(`hasETH = ${hasETH}, weights = [${weights.join('%, ')}%]`, async () => {
                const [converter, poolToken] = await initLiquidityPool(hasETH, ...weights);
                const reserveTokens = await Promise.all(weights.map((weight, i) => converter.reserveTokens.call(i)));

                const state = [];
                let expected = [];
                let prevSupply = new BN(0);
                let prevBalances = reserveTokens.map(reserveToken => new BN(0));

                for (const supplyAmount of [1000000000, 1000000, 2000000, 3000000, 4000000]) {
                    const reserveAmounts = reserveTokens.map((reserveToken, i) => new BN(supplyAmount).mul(new BN(100 + i)).div(new BN(100)));
                    await Promise.all(reserveTokens.map((reserveToken, i) => approve(reserveToken, converter, reserveAmounts[i].mul(new BN(0)))));
                    await Promise.all(reserveTokens.map((reserveToken, i) => approve(reserveToken, converter, reserveAmounts[i].mul(new BN(1)))));
                    const liquidityCosts = await getLiquidityCosts(state.length == 0, converter, reserveTokens, reserveAmounts);
                    const liquidityReturns = await getLiquidityReturns(state.length == 0, converter, reserveTokens, reserveAmounts);
                    await converter.addLiquidity(reserveTokens, reserveAmounts, MIN_RETURN, { value: hasETH ? reserveAmounts.slice(-1)[0] : 0 });
                    const allowances = await Promise.all(reserveTokens.map(reserveToken => getAllowance(reserveToken, converter)));
                    const balances = await Promise.all(reserveTokens.map(reserveToken => getBalance(reserveToken, converter)));
                    const supply = await poolToken.totalSupply.call();

                    state.push({ supply: supply, balances: balances });

                    for (let i = 0; i < allowances.length; i++) {
                        const diff = Decimal(allowances[i].toString()).div(reserveAmounts[i].toString());
                        expect(diff.gte('0') && diff.lte('0.0000005')).to.be.true();
                    }

                    const actual = balances.map(balance => Decimal(balance.toString()).div(supply.toString()));
                    for (let i = 0; i < expected.length; i++) {
                        const diff = expected[i].div(actual[i]);
                        expect(diff.gte('0.996') && diff.lte('1')).to.be.true();
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
                    await converter.removeLiquidity(supplyAmount, reserveTokens, reserveTokens.map(reserveTokens => 1));
                    const balances = await Promise.all(reserveTokens.map(reserveToken => getBalance(reserveToken, converter)));
                    for (let i = 0; i < balances.length; i++) {
                        const diff = Decimal(state[n - 1].balances[i].toString()).div(Decimal(balances[i].toString()));
                        expect(diff.gte('0.999999996') && diff.lte('1')).to.be.true();
                        expect(prevBalances[i].sub(balances[i])).to.be.bignumber.equal(reserveAmounts[i]);
                    }
                    prevBalances = balances;
                }

                const supplyAmount = state[0].supply;
                const reserveAmounts = await converter.removeLiquidityReturn(supplyAmount, reserveTokens);
                await converter.removeLiquidity(supplyAmount, reserveTokens, reserveTokens.map(reserveTokens => 1));
                const balances = await Promise.all(reserveTokens.map(reserveToken => getBalance(reserveToken, converter)));
                for (let i = 0; i < balances.length; i++) {
                    expect(balances[i]).to.be.bignumber.equal(new BN(0));
                    expect(prevBalances[i].sub(balances[i])).to.be.bignumber.equal(reserveAmounts[i]);
                }
            });
        };

        for (const hasETH of [false, true]) {
            for (const weight1 of [10, 20, 30, 40, 50, 60, 70, 80, 90]) {
                for (const weight2 of [10, 20, 30, 40, 50, 60, 70, 80, 90]) {
                    if (weight1 + weight2 <= 100) {
                        test(hasETH, weight1, weight2);
                    }
                }
            }
        }

        for (const hasETH of [false, true]) {
            for (const weight1 of [10, 20, 30, 40, 50, 60]) {
                for (const weight2 of [10, 20, 30, 40, 50, 60]) {
                    for (const weight3 of [10, 20, 30, 40, 50, 60]) {
                        if (weight1 + weight2 + weight3 <= 100) {
                            test(hasETH, weight1, weight2, weight3);
                        }
                    }
                }
            }
        }
    });

    const approve = async (reserveToken, converter, amount) => {
        if (reserveToken === ETH_RESERVE_ADDRESS) {
            return;
        }

        const token = await ERC20Token.at(reserveToken);
        return token.approve(converter.address, amount);
    };

    const getAllowance = async (reserveToken, converter) => {
        if (reserveToken === ETH_RESERVE_ADDRESS) {
            return new BN(0);
        }

        const token = await ERC20Token.at(reserveToken);
        return token.allowance.call(owner, converter.address);
    };

    const getBalance = async (reserveToken, converter) => {
        if (reserveToken === ETH_RESERVE_ADDRESS) {
            return balance.current(converter.address);
        }

        const token = await ERC20Token.at(reserveToken);
        return await token.balanceOf.call(converter.address);
    };

    const getLiquidityCosts = async (firstTime, converter, reserveTokens, reserveAmounts) => {
        if (firstTime) {
            return reserveAmounts.map((reserveAmount, i) => reserveAmounts);
        }

        return await Promise.all(reserveAmounts.map((reserveAmount, i) => converter.addLiquidityCost(reserveTokens, i, reserveAmount)));
    };

    const getLiquidityReturns = async (firstTime, converter, reserveTokens, reserveAmounts) => {
        if (firstTime) {
            const length = Math.round(reserveAmounts.map(reserveAmount => reserveAmount.toString()).join('').length / reserveAmounts.length);
            const retVal = new BN('1'.padEnd(length, '0'));
            return reserveAmounts.map((reserveAmount, i) => retVal);
        }

        return await Promise.all(reserveAmounts.map((reserveAmount, i) => converter.addLiquidityReturn(reserveTokens[i], reserveAmount)));
    };
});
