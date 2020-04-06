const utils = require('./helpers/Utils');
const ContractRegistryClient = require('./helpers/ContractRegistryClient');

const BancorConverter = artifacts.require('BancorConverter');
const SmartToken = artifacts.require('SmartToken');
const ERC20Token = artifacts.require('ERC20Token');
const BancorFormula = artifacts.require('BancorFormula');
const ContractFeatures = artifacts.require('ContractFeatures');
const ContractRegistry = artifacts.require('ContractRegistry');

async function initLiquidityPool(hasETH, ...ratios) {
    const smartToken = await SmartToken.new('name', 'symbol', 0);
    const converter = await BancorConverter.new(smartToken.address, contractRegistry.address, 0, utils.zeroAddress, 0);

    for (let i = 0; i < ratios.length; i++) {
        if (hasETH && i == ratios.length - 1) {
            await converter.addETHReserve(ratios[i] * 10000);
        }
        else {
            const reserveToken = await ERC20Token.new('name', 'symbol', 0, -1);
            await converter.addReserve(reserveToken.address, ratios[i] * 10000);
        }
    }

    await smartToken.transferOwnership(converter.address);
    await converter.acceptTokenOwnership();

    return [converter, smartToken];
}

contract('BancorConverterLiquidity', accounts => {
    const owner = accounts[0];

    before(async () => {
        bancorFormula = await BancorFormula.new();
        contractFeatures = await ContractFeatures.new();
        contractRegistry = await ContractRegistry.new();

        await contractRegistry.registerAddress(ContractRegistryClient.BANCOR_FORMULA, bancorFormula.address);
        await contractRegistry.registerAddress(ContractRegistryClient.CONTRACT_FEATURES, contractFeatures.address);
    });

    for (const hasETH of [false, true])
        for (const ratio1 of [10, 20, 30, 40, 50, 60, 70, 80, 90])
            for (const ratio2 of [10, 20, 30, 40, 50, 60, 70, 80, 90])
                if (ratio1 + ratio2 <= 100)
                    test(hasETH, ratio1, ratio2);

    for (const hasETH of [false, true])
        for (const ratio1 of [10, 20, 30, 40, 50, 60])
            for (const ratio2 of [10, 20, 30, 40, 50, 60])
                for (const ratio3 of [10, 20, 30, 40, 50, 60])
                    if (ratio1 + ratio2 + ratio3 <= 100)
                        test(hasETH, ratio1, ratio2, ratio3);

    function test(hasETH, ...ratios) {
        it(`hasETH = ${hasETH}, ratios = [${ratios.join('%, ')}%]`, async () => {
            const [converter, smartToken] = await initLiquidityPool(hasETH, ...ratios);
            const reserveTokens = await Promise.all(ratios.map((ratio, i) => converter.reserveTokens(i)));

            let expected = [];
            const minDiff = ratios.reduce((a, b) => a + b, 0) == 100 ? "1" : "0.996";
            const maxDiff = ratios.reduce((a, b) => a + b, 0) == 100 ? "0" : "0.002";

            for (const liquidity of [1000000000, 1000000, 2000000, 3000000, 4000000]) {
                const reserveAmounts = reserveTokens.map((reserveToken, i) => web3.toBigNumber(liquidity).mul(100 + i).div(100));
                await Promise.all(reserveTokens.map((reserveToken, i) => approve(reserveToken, converter, reserveAmounts[i].mul(0))));
                await Promise.all(reserveTokens.map((reserveToken, i) => approve(reserveToken, converter, reserveAmounts[i].mul(1))));
                await converter.addLiquidity(reserveTokens, reserveAmounts, {value: hasETH ? reserveAmounts.slice(-1)[0] : 0});
                const allowances = await Promise.all(reserveTokens.map(reserveToken => getAllowance(reserveToken, converter)));
                const balances = await Promise.all(reserveTokens.map(reserveToken => getBalance(reserveToken, converter)));
                const supply = await smartToken.balanceOf(owner);

                for (let i = 0; i < allowances.length; i++) {
                    const diff = allowances[i].div(reserveAmounts[i]);
                    assert(diff.lessThanOrEqualTo(maxDiff), `allowance #${i + 1}: diff = ${diff.toFixed()}`);
                }

                const actual = balances.map(balance => balance.div(supply));
                for (let i = 0; i < expected.length; i++) {
                    const diff = expected[i].div(actual[i]);
                    assert(diff.greaterThanOrEqualTo(minDiff) && diff.lessThanOrEqualTo("1"), `balance #${i + 1}: diff = ${diff.toFixed()}`);
                }

                expected = actual;
            }
        });
    }

    async function approve(reserveToken, converter, amount) {
        if (reserveToken != utils.zeroAddress)
            return await ERC20Token.at(reserveToken).approve(converter.address, amount);
        return {};
    }

    async function getAllowance(reserveToken, converter) {
        if (reserveToken != utils.zeroAddress)
            return await ERC20Token.at(reserveToken).allowance(owner, converter.address);
        return web3.toBigNumber(0);
    }

    async function getBalance(reserveToken, converter) {
        if (reserveToken != utils.zeroAddress)
            return await ERC20Token.at(reserveToken).balanceOf(converter.address);
        return await web3.eth.getBalance(converter.address);
    }
});
