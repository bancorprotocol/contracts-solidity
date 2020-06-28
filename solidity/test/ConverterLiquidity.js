const utils = require('./helpers/Utils');
const ContractRegistryClient = require('./helpers/ContractRegistryClient');

const LiquidityPoolV1Converter = artifacts.require('LiquidityPoolV1Converter');
const SmartToken = artifacts.require('SmartToken');
const ERC20Token = artifacts.require('ERC20Token');
const BancorFormula = artifacts.require('BancorFormula');
const ContractRegistry = artifacts.require('ContractRegistry');

const ETH_RESERVE_ADDRESS = '0x'.padEnd(42, 'e');

let bancorFormula;
let contractRegistry;
let erc20Tokens;

async function initLiquidityPool(hasETH, ...weights) {
    const smartToken = await SmartToken.new('name', 'symbol', 0);
    const converter = await LiquidityPoolV1Converter.new(smartToken.address, contractRegistry.address, 0);

    for (let i = 0; i < weights.length; i++) {
        if (hasETH && i == weights.length - 1)
            await converter.addReserve(ETH_RESERVE_ADDRESS, weights[i] * 10000);
        else
            await converter.addReserve(erc20Tokens[i].address, weights[i] * 10000);
    }

    await smartToken.transferOwnership(converter.address);
    await converter.acceptAnchorOwnership();

    return [converter, smartToken];
}

contract('ConverterLiquidity', accounts => {
    const owner = accounts[0];

    before(async () => {
        bancorFormula = await BancorFormula.new();
        contractRegistry = await ContractRegistry.new();
        erc20Tokens = await Promise.all([...Array(5).keys()].map(i => ERC20Token.new('name', 'symbol', 0, -1)));
        await contractRegistry.registerAddress(ContractRegistryClient.BANCOR_FORMULA, bancorFormula.address);
    });

    describe('auxiliary functions:', () => {
        let converter;

        before(async () => {
            converter = await LiquidityPoolV1Converter.new('0x'.padEnd(42, '1'), contractRegistry.address, 0);
        });

        for (let n = 1; n <= 77; n++) {
            for (const k of [-1, 0, +1]) {
                const input = web3.toBigNumber(10).pow(n).add(k);
                it(`decimalLength(${input.toFixed()})`, async () => {
                    const expected = input.toFixed().length;
                    const actual = await converter.decimalLength(input);
                    assert(actual.equals(expected), `expected ${expected} but got ${actual}`);
                });
            }
        }

        for (let n = 1; n <= 15; n++) {
            for (let d = 1; d <= 15; d++) {
                it(`roundDiv(${n}, ${d})`, async () => {
                    const expected = Math.round(n / d);
                    const actual = await converter.roundDiv(n, d);
                    assert(actual.equals(expected), `expected ${expected} but got ${actual}`);
                });
            }
        }

        for (const values of [[123, 456789], [12, 345, 6789], [1, 1000, 1000000, 1000000000, 1000000000000]]) {
            it(`geometricMean([${values}])`, async () => {
                const expected = 10 ** (Math.round(values.join('').length / values.length) - 1);
                const actual = await converter.geometricMean(values);
                assert(actual.equals(expected), `expected ${expected} but got ${actual}`);
            });
        }
    });

    describe('security assertion:', () => {
        const weights = [1, 2, 3, 4, 5];
        const reserveAmounts = weights.map(weight => 1);

        it('should revert if the number of input reserve tokens is not equal to the number of reserve tokens', async () => {
            const [converter, smartToken] = await initLiquidityPool(false, ...weights);
            const reserveTokens = await Promise.all(weights.map((weight, i) => converter.reserveTokens(i)));
            await utils.catchRevert(converter.addLiquidity(reserveTokens.slice(0, -1), reserveAmounts, 1));
        });

        it('should revert if the number of input reserve amounts is not equal to the number of reserve tokens', async () => {
            const [converter, smartToken] = await initLiquidityPool(false, ...weights);
            const reserveTokens = await Promise.all(weights.map((weight, i) => converter.reserveTokens(i)));
            await utils.catchRevert(converter.addLiquidity(reserveTokens, reserveAmounts.slice(0, -1), 1));
        });

        it('should revert if any of the input reserve tokens is not one of the reserve tokens', async () => {
            const [converter, smartToken] = await initLiquidityPool(false, ...weights);
            const reserveTokens = await Promise.all(weights.map((weight, i) => converter.reserveTokens(i)));
            await utils.catchRevert(converter.addLiquidity([...reserveTokens.slice(0, -1), smartToken.address], reserveAmounts, 1));
        });

        it('should revert if any of the reserve tokens is not within the input reserve tokens', async () => {
            const [converter, smartToken] = await initLiquidityPool(false, ...weights);
            const reserveTokens = await Promise.all(weights.map((weight, i) => converter.reserveTokens(i)));
            await utils.catchRevert(converter.addLiquidity([...reserveTokens.slice(0, -1), reserveTokens[0]], reserveAmounts, 1));
        });

        it('should revert if the minimum-return is not larger than zero', async () => {
            const [converter, smartToken] = await initLiquidityPool(false, ...weights);
            const reserveTokens = await Promise.all(weights.map((weight, i) => converter.reserveTokens(i)));
            await utils.catchRevert(converter.addLiquidity(reserveTokens, reserveAmounts, 0));
        });

        it('should revert if the minimum-return is larger than the return', async () => {
            const [converter, smartToken] = await initLiquidityPool(false, ...weights);
            const reserveTokens = await Promise.all(weights.map((weight, i) => converter.reserveTokens(i)));
            await Promise.all(reserveTokens.map((reserveToken, i) => approve(reserveToken, converter, reserveAmounts[i])));
            await utils.catchRevert(converter.addLiquidity(reserveTokens, reserveAmounts, -1));
        });

        it('should revert if any of the input reserve amounts is not larger than zero', async () => {
            [converter, smartToken] = await initLiquidityPool(false, ...weights);
            reserveTokens = await Promise.all(weights.map((weight, i) => converter.reserveTokens(i)));
            await utils.catchRevert(converter.addLiquidity(reserveTokens, [...reserveAmounts.slice(0, -1), 0], 1));
        });

        it('should revert if the input value to a non-ether converter is larger than zero', async () => {
            const [converter, smartToken] = await initLiquidityPool(false, ...weights);
            const reserveTokens = await Promise.all(weights.map((weight, i) => converter.reserveTokens(i)));
            await utils.catchRevert(converter.addLiquidity(reserveTokens, reserveAmounts, 1, {value: reserveAmounts.slice(-1)[0]}));
        });

        it('should revert if the input value is not equal to the input amount of ether', async () => {
            const [converter, smartToken] = await initLiquidityPool(true, ...weights);
            const reserveTokens = await Promise.all(weights.map((weight, i) => converter.reserveTokens(i)));
            await utils.catchRevert(converter.addLiquidity(reserveTokens, reserveAmounts, 1, {value: reserveAmounts.slice(-1)[0] + 1}));
        });
    });

    describe('functionality assertion:', () => {
        for (const hasETH of [false, true])
            for (const weight1 of [10, 20, 30, 40, 50, 60, 70, 80, 90])
                for (const weight2 of [10, 20, 30, 40, 50, 60, 70, 80, 90])
                    if (weight1 + weight2 <= 100)
                        test(hasETH, weight1, weight2);

        for (const hasETH of [false, true])
            for (const weight1 of [10, 20, 30, 40, 50, 60])
                for (const weight2 of [10, 20, 30, 40, 50, 60])
                    for (const weight3 of [10, 20, 30, 40, 50, 60])
                        if (weight1 + weight2 + weight3 <= 100)
                            test(hasETH, weight1, weight2, weight3);

        function test(hasETH, ...weights) {
            it(`hasETH = ${hasETH}, weights = [${weights.join('%, ')}%]`, async () => {
                const [converter, smartToken] = await initLiquidityPool(hasETH, ...weights);
                const reserveTokens = await Promise.all(weights.map((weight, i) => converter.reserveTokens(i)));

                const state = [];
                let expected = [];

                for (const supplyAmount of [1000000000, 1000000, 2000000, 3000000, 4000000]) {
                    const reserveAmounts = reserveTokens.map((reserveToken, i) => web3.toBigNumber(supplyAmount).mul(100 + i).div(100));
                    await Promise.all(reserveTokens.map((reserveToken, i) => approve(reserveToken, converter, reserveAmounts[i].mul(0))));
                    await Promise.all(reserveTokens.map((reserveToken, i) => approve(reserveToken, converter, reserveAmounts[i].mul(1))));
                    await converter.addLiquidity(reserveTokens, reserveAmounts, 1, {value: hasETH ? reserveAmounts.slice(-1)[0] : 0});
                    const allowances = await Promise.all(reserveTokens.map(reserveToken => getAllowance(reserveToken, converter)));
                    const balances = await Promise.all(reserveTokens.map(reserveToken => getBalance(reserveToken, converter)));
                    const supply = await smartToken.totalSupply();

                    state.push({supply: supply, balances: balances});

                    for (let i = 0; i < allowances.length; i++) {
                        const diff = allowances[i].div(reserveAmounts[i]);
                        assert(inRange(diff, '0', '0.0000005'), `allowance #${i + 1}: diff = ${diff.toFixed()}`);
                    }

                    const actual = balances.map(balance => balance.div(supply));
                    for (let i = 0; i < expected.length; i++) {
                        const diff = expected[i].div(actual[i]);
                        assert(inRange(diff, '0.996', '1'), `balance #${i + 1}: diff = ${diff.toFixed()}`);
                    }

                    expected = actual;
                }

                for (let n = state.length - 1; n > 0; n--) {
                    const supplyAmount = state[n].supply.sub(state[n - 1].supply);
                    await converter.removeLiquidity(supplyAmount, reserveTokens, reserveTokens.map(reserveTokens => 1));
                    const balances = await Promise.all(reserveTokens.map(reserveToken => getBalance(reserveToken, converter)));
                    for (let i = 0; i < balances.length; i++) {
                        const diff = state[n - 1].balances[i].div(balances[i]);
                        assert(inRange(diff, '0.999999996', '1'), `balance #${i + 1}: diff = ${diff.toFixed()}`);
                    }
                }

                const supplyAmount = state[0].supply;
                await converter.removeLiquidity(supplyAmount, reserveTokens, reserveTokens.map(reserveTokens => 1));
                const balances = await Promise.all(reserveTokens.map(reserveToken => getBalance(reserveToken, converter)));
                for (let i = 0; i < balances.length; i++)
                    assert(balances[i].equals(0), `balance #${i + 1} is ${balances[i].toFixed()} instead of 0`);
            });
        }
    });

    async function approve(reserveToken, converter, amount) {
        if (reserveToken != ETH_RESERVE_ADDRESS)
            return await ERC20Token.at(reserveToken).approve(converter.address, amount);
        return {};
    }

    async function getAllowance(reserveToken, converter) {
        if (reserveToken != ETH_RESERVE_ADDRESS)
            return await ERC20Token.at(reserveToken).allowance(owner, converter.address);
        return web3.toBigNumber(0);
    }

    async function getBalance(reserveToken, converter) {
        if (reserveToken != ETH_RESERVE_ADDRESS)
            return await ERC20Token.at(reserveToken).balanceOf(converter.address);
        return await web3.eth.getBalance(converter.address);
    }

    function inRange(val, min, max) {
        return val.greaterThanOrEqualTo(min) && val.lessThanOrEqualTo(max);
    }
});
