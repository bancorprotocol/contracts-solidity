const utils = require('./helpers/Utils');
const ContractRegistryClient = require('./helpers/ContractRegistryClient');

const BancorConverter = artifacts.require('BancorConverter');
const SmartToken = artifacts.require('SmartToken');
const ERC20Token = artifacts.require('ERC20Token');
const BancorFormula = artifacts.require('BancorFormula');
const ContractFeatures = artifacts.require('ContractFeatures');
const ContractRegistry = artifacts.require('ContractRegistry');

const MAX = web3.toBigNumber(-1);
const LIQUIDITIES = [1000000000, 1000000, 2000000, 3000000, 4000000];

async function initLiquidityPool(hasETH, ...ratios) {
    const smartToken = await SmartToken.new('name', 'symbol', 0);
    const converter = await BancorConverter.new(smartToken.address, contractRegistry.address, 0, utils.zeroAddress, 0);

    for (let i = 0; i < ratios.length; i++) {
        if (hasETH && i == ratios.length - 1) {
            await converter.addETHReserve(ratios[i] * 10000);
        }
        else {
            const reserveToken = await ERC20Token.new('name', 'symbol', 0, MAX);
            await converter.addReserve(reserveToken.address, ratios[i] * 10000);
        }
    }

    await smartToken.transferOwnership(converter.address);
    await converter.acceptTokenOwnership();

    return [converter, smartToken];
}

contract('BancorConverterLiquidity', accounts => {
    before(async () => {
        bancorFormula = await BancorFormula.new();
        contractFeatures = await ContractFeatures.new();
        contractRegistry = await ContractRegistry.new();

        await contractRegistry.registerAddress(ContractRegistryClient.BANCOR_FORMULA, bancorFormula.address);
        await contractRegistry.registerAddress(ContractRegistryClient.CONTRACT_FEATURES, contractFeatures.address);
    });

    for (const hasETH of [false])
        for (const ratio1 of [10, 20, 30, 40, 50, 60, 70, 80, 90])
            test(hasETH, ratio1, 100 - ratio1);

    for (const hasETH of [false])
        for (const ratio1 of [10, 20, 30, 40])
            for (const ratio2 of [10, 20, 30, 40])
                test(hasETH, ratio1, ratio2, 100 - ratio1 - ratio2);

    function test(hasETH, ...ratios) {
        it(`hasETH = ${hasETH}, ratios = [${ratios.join('%, ')}%]`, async () => {
            const [converter, smartToken] = await initLiquidityPool(hasETH, ...ratios);
            const reserveTokens = await Promise.all(ratios.map((ratio, i) => converter.reserveTokens(i)));
            await Promise.all(reserveTokens.map(reserveToken => ERC20Token.at(reserveToken).approve(converter.address, MAX)));

            let total = 0;

            for (const liquidity of LIQUIDITIES) {
                await converter.addLiquidity(reserveTokens, reserveTokens.map(reserveToken => liquidity), {value: liquidity * hasETH});
                const balances = await Promise.all(reserveTokens.map(reserveToken => getReserveBalance(reserveToken, converter)));
                const balance = await smartToken.balanceOf(accounts[0]);

                if (total == 0)
                    total = liquidity;
                else
                    total += Math.floor(liquidity * Math.min(...ratios) / 100);

                assert(balance.equals(total), `owner balance in the smart token: expected ${total} but got ${balance}`);
                for (let i = 0; i < balances.length; i++)
                    assert(balance.equals(total), `converter balance in reserve token #${i + 1}: expected ${total} but got ${balances[i]}`);
            }
        });
    }

    async function getReserveBalance(reserveToken, converter) {
        if (reserveToken == utils.zeroAddress)
            return await web3.eth.getBalance(converter.address);
        return await ERC20Token.at(reserveToken).balanceOf(converter.address);
    }
});
