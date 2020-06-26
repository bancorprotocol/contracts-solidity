const { expect } = require('chai');
const { expectRevert, constants, BN, balance } = require('@openzeppelin/test-helpers');
const Decimal = require('decimal.js');

const { ETH_RESERVE_ADDRESS, registry } = require('./helpers/Constants');
const { ZERO_ADDRESS } = constants;

const LiquidityPoolV1Converter = artifacts.require('LiquidityPoolV1Converter');
const SmartToken = artifacts.require('SmartToken');
const ERC20Token = artifacts.require('ERC20Token');
const BancorFormula = artifacts.require('BancorFormula');
const ContractRegistry = artifacts.require('ContractRegistry');

contract('ConverterLiquidity', accounts => {
    const initLiquidityPool = async (hasETH, ...weights) => {
        const smartToken = await SmartToken.new('name', 'symbol', 0);
        const converter = await LiquidityPoolV1Converter.new(smartToken.address, contractRegistry.address, 0);

        for (let i = 0; i < weights.length; i++) {
            if (hasETH && i === weights.length - 1) {
                await converter.addReserve(ETH_RESERVE_ADDRESS, weights[i] * 10000);
            } else {
                await converter.addReserve(erc20Tokens[i].address, weights[i] * 10000);
            }
        }

        await smartToken.transferOwnership(converter.address);
        await converter.acceptAnchorOwnership();

        return [converter, smartToken];
    };

    let bancorFormula;
    let contractRegistry;
    let erc20Tokens;
    const owner = accounts[0];

    beforeEach(async () => {
        bancorFormula = await BancorFormula.new();
        contractRegistry = await ContractRegistry.new();
        erc20Tokens = await Promise.all([...Array(5).keys()].map(i => ERC20Token.new('name', 'symbol', 0, -1)));

        await contractRegistry.registerAddress(registry.BANCOR_FORMULA, bancorFormula.address);
    });

    describe('auxiliary functions', () => {
        let converter;

        beforeEach(async () => {
            converter = await LiquidityPoolV1Converter.new(ZERO_ADDRESS, contractRegistry.address, 0);
        });

        for (let n = 1; n <= 77; n++) {
            for (const k of [-1, 0, +1]) {
                const input = new BN(10).pow(new BN(n)).add(new BN(k));
                it(`decimalLength(${input.toString()})`, async () => {
                    const expected = input.toString().length;
                    const actual = await converter.decimalLength.call(input);
                    expect(actual).to.be.bignumber.equal(new BN(expected));
                });
            }
        }

        for (let n = 1; n <= 15; n++) {
            for (let d = 1; d <= 15; d++) {
                it(`roundDiv(${n}, ${d})`, async () => {
                    const expected = Math.round(n / d);
                    const actual = await converter.roundDiv.call(n, d);
                    expect(actual).to.be.bignumber.equal(new BN(expected));
                });
            }
        }

        for (const values of [[123, 456789], [12, 345, 6789], [1, 1000, 1000000, 1000000000, 1000000000000]]) {
            it(`geometricMean([${values}])`, async () => {
                const expected = 10 ** (Math.round(values.join('').length / values.length) - 1);
                const actual = await converter.geometricMean.call(values).call;
                expect(actual).to.be.bignumber.equal(new BN(expected));
            });
        }
    });

    describe('security assertion', () => {
        let converter;
        let smartToken;

        beforeEach(async () => {
            [converter, smartToken] = await initLiquidityPool(false, ...weights);
        });

        const weights = [1, 2, 3, 4, 5];
        const reserveAmounts = weights.map(weight => 1);

        it('should revert if the number of input reserve tokens is not equal to the number of reserve tokens', async () => {
            const reserveTokens = await Promise.all(weights.map((weight, i) => converter.reserveTokens.call(i)));
            await expectRevert(converter.addLiquidity(reserveTokens.slice(0, -1), reserveAmounts, 1),
                'ERR_INVALID_RESERVE');
        });

        it('should revert if the number of input reserve amounts is not equal to the number of reserve tokens', async () => {
            const reserveTokens = await Promise.all(weights.map((weight, i) => converter.reserveTokens.call(i)));
            await expectRevert(converter.addLiquidity(reserveTokens, reserveAmounts.slice(0, -1), 1),
                'ERR_INVALID_RESERVE');
        });

        it('should revert if any of the input reserve tokens is not one of the reserve tokens', async () => {
            const reserveTokens = await Promise.all(weights.map((weight, i) => converter.reserveTokens.call(i)));
            await expectRevert(converter.addLiquidity([...reserveTokens.slice(0, -1), smartToken.address],
                reserveAmounts, 1), 'ERR_INVALID_RESERVE');
        });

        it('should revert if any of the reserve tokens is not within the input reserve tokens', async () => {
            const reserveTokens = await Promise.all(weights.map((weight, i) => converter.reserveTokens.call(i)));
            await expectRevert(converter.addLiquidity([...reserveTokens.slice(0, -1), reserveTokens[0]],
                reserveAmounts, 1), 'ERR_INVALID_RESERVE');
        });

        it('should revert if the minimum-return is not larger than zero', async () => {
            const reserveTokens = await Promise.all(weights.map((weight, i) => converter.reserveTokens.call(i)));
            await expectRevert(converter.addLiquidity(reserveTokens, reserveAmounts, 0), 'ERR_ZERO_AMOUNT');
        });

        it('should revert if the minimum-return is larger than the return', async () => {
            const reserveTokens = await Promise.all(weights.map((weight, i) => converter.reserveTokens.call(i)));
            await expectRevert(converter.addLiquidity(reserveTokens, reserveAmounts, -1), 'ERR_RETURN_TOO_LOW');
        });

        it('should revert if any of the input reserve amounts is not larger than zero', async () => {
            const reserveTokens = await Promise.all(weights.map((weight, i) => converter.reserveTokens.call(i)));
            await expectRevert(converter.addLiquidity(reserveTokens, [...reserveAmounts.slice(0, -1), 0], 1),
                'ERR_INVALID_AMOUNT');
        });

        it('should revert if the input value to a non-ether converter is larger than zero', async () => {
            const reserveTokens = await Promise.all(weights.map((weight, i) => converter.reserveTokens.call(i)));
            await expectRevert(converter.addLiquidity(reserveTokens, reserveAmounts, 1,
                { value: reserveAmounts.slice(-1)[0] }), 'ERR_NO_ETH_RESERVE');
        });

        it('should revert if the input value is not equal to the input amount of ether', async () => {
            const reserveTokens = await Promise.all(weights.map((weight, i) => converter.reserveTokens.call(i)));
            await expectRevert(converter.addLiquidity(reserveTokens, reserveAmounts, 1,
                { value: reserveAmounts.slice(-1)[0] + 1 }), 'ERR_ETH_AMOUNT_MISMATCH');
        });
    });

    describe('functionality assertion', () => {
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

        function test (hasETH, ...weights) {
            it(`hasETH = ${hasETH}, weights = [${weights.join('%, ')}%]`, async () => {
                const [converter, smartToken] = await initLiquidityPool(hasETH, ...weights);
                const reserveTokens = await Promise.all(weights.map((weight, i) => converter.reserveTokens.call(i)));

                const state = [];
                let expected = [];

                for (const supplyAmount of [1000000000, 1000000, 2000000, 3000000, 4000000]) {
                    const reserveAmounts = reserveTokens.map((reserveToken, i) => new BN(supplyAmount).mul(new BN(100 + i)).div(new BN(100)));
                    await Promise.all(reserveTokens.map((reserveToken, i) => approve(reserveToken, converter, reserveAmounts[i].mul(new BN(0)))));
                    await Promise.all(reserveTokens.map((reserveToken, i) => approve(reserveToken, converter, reserveAmounts[i].mul(new BN(1)))));
                    await converter.addLiquidity(reserveTokens, reserveAmounts, 1, { value: hasETH ? reserveAmounts.slice(-1)[0] : 0 });
                    const allowances = await Promise.all(reserveTokens.map(reserveToken => getAllowance(reserveToken, converter)));
                    const balances = await Promise.all(reserveTokens.map(reserveToken => getBalance(reserveToken, converter)));
                    const supply = await smartToken.totalSupply.call();

                    state.push({ supply: supply, balances: balances });

                    for (let i = 0; i < allowances.length; i++) {
                        const diff = Decimal(allowances[i].toString()).div(reserveAmounts[i].toString());
                        expect(diff.toNumber()).to.be.gte(0).and.lte(0.004);
                    }

                    const actual = balances.map(balance => Decimal(balance.toString()).div(supply.toString()));
                    for (let i = 0; i < expected.length; i++) {
                        const diff = expected[i].div(actual[i]);
                        expect(diff.toNumber()).to.be.gte(0.996).and.lte(1);
                    }

                    expected = actual;
                }

                for (let n = state.length - 1; n > 0; n--) {
                    const supplyAmount = state[n].supply.sub(new BN(state[n - 1].supply));
                    await converter.removeLiquidity(supplyAmount, reserveTokens, reserveTokens.map(reserveTokens => 1));
                    const balances = await Promise.all(reserveTokens.map(reserveToken => getBalance(reserveToken, converter)));
                    for (let i = 0; i < balances.length; i++) {
                        const diff = Decimal(state[n - 1].balances[i].toString()).div(Decimal(balances[i].toString()));
                        expect(diff.toNumber()).to.be.gte(0.99999999).and.lte(1);
                    }
                }

                const supplyAmount = state[0].supply;
                await converter.removeLiquidity(supplyAmount, reserveTokens, reserveTokens.map(reserveTokens => 1));
                const balances = await Promise.all(reserveTokens.map(reserveToken => getBalance(reserveToken, converter)));
                for (let i = 0; i < balances.length; i++) {
                    expect(balances[i]).to.be.bignumber.equal(new BN(0));
                }
            });
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
});
