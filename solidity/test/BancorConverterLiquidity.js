const utils = require('./helpers/Utils');
const ContractRegistryClient = require('./helpers/ContractRegistryClient');

const BancorConverter = artifacts.require('BancorConverter');
const SmartToken = artifacts.require('SmartToken');
const ERC20Token = artifacts.require('ERC20Token');
const BancorFormula = artifacts.require('BancorFormula');
const ContractFeatures = artifacts.require('ContractFeatures');
const ContractRegistry = artifacts.require('ContractRegistry');

const MAXVAL = web3.toBigNumber(-1);

async function initLiquidityPool(owner, reserveSettings) {
    const smartToken = await SmartToken.new('name', 'symbol', 0);
    const converter = await BancorConverter.new(smartToken.address, contractRegistry.address, 0, utils.zeroAddress, 0);

    for (const reserveSetting of reserveSettings) {
        if (reserveSetting.isETH) {
            await converter.addETHReserve(reserveSetting.ratio);
        }
        else {
            const reserveToken = await ERC20Token.new('name', 'symbol', 0, MAXVAL);
            await converter.addReserve(reserveToken.address, reserveSetting.ratio);
        }
    }

    await smartToken.transferOwnership(converter.address);
    await converter.acceptTokenOwnership();

    return [converter, smartToken];
}

contract('BancorConverterLiquidity', accounts => {
    before(async () => {
        contractRegistry = await ContractRegistry.new();

        const bancorFormula = await BancorFormula.new();
        const contractFeatures = await ContractFeatures.new();

        await contractRegistry.registerAddress(ContractRegistryClient.BANCOR_FORMULA, bancorFormula.address);
        await contractRegistry.registerAddress(ContractRegistryClient.CONTRACT_FEATURES, contractFeatures.address);
    });

    for (const isETH of [false]) {
        for (const ratio of [10, 20, 30, 40, 50, 60, 70, 80, 90]) {
            it(`isETH = ${isETH}, ratio1 = ${ratio}%, ratio2 = ${100 - ratio}%`, async () => {
                const reserveSettings = [
                    {isETH: false, ratio: ratio * 10000},
                    {isETH: isETH, ratio: (100 - ratio) * 10000},
                ];

                const [converter, smartToken] = await initLiquidityPool(accounts[0], reserveSettings);
                const reserveTokens = await Promise.all(reserveSettings.map((reserveSetting, i) => converter.reserveTokens(i)));
                await Promise.all(reserveTokens.map(reserveToken => ERC20Token.at(reserveToken).approve(converter.address, MAXVAL)));

                let total = 0;

                for (const liquidity of [1000000000, 1000000, 2000000, 3000000, 4000000]) {
                    await converter.addLiquidity(reserveTokens, reserveTokens.map(reserveToken => liquidity), {value: liquidity * isETH});
                    const balances = await Promise.all(reserveTokens.map(reserveToken => getReserveBalance(reserveToken, converter)));
                    const balance = await smartToken.balanceOf(accounts[0]);

                    total += liquidity;
                    assert(balance.equals(total), `owner balance in the smart token: expected ${total} but got ${balance}`);
                    for (let i = 0; i < balances.length; i++)
                        assert(balance.equals(total), `converter balance in reserve token #${i + 1}: expected ${total} but got ${balances[i]}`);
                }
            });
        }
    }

    for (const isETH of [false]) {
        for (const ratio1 of [10, 20, 30, 40]) {
            for (const ratio2 of [10, 20, 30, 40]) {
                it(`isETH = ${isETH}, ratio1 = ${ratio1}%, ratio2 = ${ratio2}%, ratio3 = ${100 - ratio1 - ratio2}%`, async () => {
                    const reserveSettings = [
                        {isETH: false, ratio: ratio1 * 10000},
                        {isETH: false, ratio: ratio2 * 10000},
                        {isETH: isETH, ratio: (100 - ratio1 - ratio2) * 10000},
                    ];

                    const [converter, smartToken] = await initLiquidityPool(accounts[0], reserveSettings);
                    const reserveTokens = await Promise.all(reserveSettings.map((reserveSetting, i) => converter.reserveTokens(i)));
                    await Promise.all(reserveTokens.map(reserveToken => ERC20Token.at(reserveToken).approve(converter.address, MAXVAL)));

                    let total = 0;

                    for (const liquidity of [1000000000, 1000000, 2000000, 3000000, 4000000]) {
                        await converter.addLiquidity(reserveTokens, reserveTokens.map(reserveToken => liquidity), {value: liquidity * isETH});
                        const balances = await Promise.all(reserveTokens.map(reserveToken => getReserveBalance(reserveToken, converter)));
                        const balance = await smartToken.balanceOf(accounts[0]);

                        total += liquidity;
                        assert(balance.equals(total), `owner balance in the smart token: expected ${total} but got ${balance}`);
                        for (let i = 0; i < balances.length; i++)
                            assert(balance.equals(total), `converter balance in reserve token #${i + 1}: expected ${total} but got ${balances[i]}`);
                    }
                });
            }
        }
    }

    async function getReserveBalance(reserveToken, converter) {
        if (reserveToken == utils.zeroAddress)
            return await web3.eth.getBalance(converter.address);
        return await ERC20Token.at(reserveToken).balanceOf(converter.address);
    }
});
