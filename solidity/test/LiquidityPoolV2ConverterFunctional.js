const expect = require('chai').expect;
const Decimal = require('decimal.js');
const registry = require('./helpers/Constants').registry;
const commands = require('./helpers/V2Sequence').commands;

const MIN_RETURN = new web3.utils.BN(1);
const ZERO_ADDRESS = '0x'.padEnd(42, '0');

const Whitelist = artifacts.require('Whitelist');
const ERC20Token = artifacts.require('ERC20Token');
const BancorNetwork = artifacts.require('BancorNetwork');
const BancorFormula = artifacts.require('BancorFormula');
const ContractRegistry = artifacts.require('ContractRegistry');
const ConverterFactory = artifacts.require('ConverterFactory');
const PoolTokensContainer = artifacts.require('PoolTokensContainer');
const ChainlinkPriceOracle = artifacts.require('TestChainlinkPriceOracle');
const LiquidityPoolV2Converter = artifacts.require('TestLiquidityPoolV2Converter');
const LiquidityPoolV2ConverterFactory = artifacts.require('LiquidityPoolV2ConverterFactory');
const LiquidityPoolV2ConverterAnchorFactory = artifacts.require('LiquidityPoolV2ConverterAnchorFactory');
const LiquidityPoolV2ConverterCustomFactory = artifacts.require('LiquidityPoolV2ConverterCustomFactory');

contract('LiquidityPoolV2ConverterFunctional', accounts => {
    let whitelist;
    let converter;
    let container;
    let bancorNetwork;
    let reserveTokens;
    let priceOracles;
    let poolTokens;

    let timestamp = 0;
    async function timeIncrease(delta) {
        timestamp += delta;
        await converter.setTime(timestamp);
    }

    function decimalToInteger(value, decimals) {
        const parts = [...value.split('.'), ''];
        return parts[0] + parts[1].padEnd(decimals, '0');
    }

    function percentageToPPM(value) {
        return decimalToInteger(value.replace('%', ''), 4);
    }

    function assertAlmostEqual(actual, expected) {
        if (!actual.eq(expected)) {
            const error = Decimal(actual.toString()).div(expected.toString()).sub(1).abs();
            expect(error.lte('0.01')).to.be.true(`error = ${error.mul(100).toFixed(2)}%`);
        }
    }

    before(async () => {
        const contractRegistry = await ContractRegistry.new();
        const converterFactory = await ConverterFactory.new();
        const bancorFormula = await BancorFormula.new();

        whitelist = await Whitelist.new();
        container = await PoolTokensContainer.new('pool', 'pool', 0);
        converter = await LiquidityPoolV2Converter.new(container.address, contractRegistry.address, 0);
        bancorNetwork = await BancorNetwork.new(contractRegistry.address);

        await timeIncrease(1);
        await bancorFormula.init();

        await contractRegistry.registerAddress(registry.BANCOR_FORMULA, bancorFormula.address);
        await contractRegistry.registerAddress(registry.CONVERTER_FACTORY, converterFactory.address);
        await contractRegistry.registerAddress(registry.BANCOR_NETWORK, bancorNetwork.address);
        await contractRegistry.registerAddress(registry.CHAINLINK_ORACLE_WHITELIST, whitelist.address);

        await converterFactory.registerTypedConverterFactory((await LiquidityPoolV2ConverterFactory.new()).address);
        await converterFactory.registerTypedConverterAnchorFactory((await LiquidityPoolV2ConverterAnchorFactory.new()).address);
        await converterFactory.registerTypedConverterCustomFactory((await LiquidityPoolV2ConverterCustomFactory.new()).address);
    });

    for (const command of commands) {
        it(JSON.stringify(command), async () => {
            await timeIncrease(command.elapsed);
            switch (command.operation) {
            case 'newPool':
                await newPool(command.pTokenId, command.sTokenId, command.numOfUsers);
                break;
            case 'setRates':
                await setRates(command.pTokenRate, command.sTokenRate);
                break;
            case 'setFeeFactors':
                await setFeeFactors(command.lowFeeFactor, command.highFeeFactor);
                break;
            case 'addLiquidity':
                await addLiquidity(command.tokenId, command.userId, command.inputAmount, command.outputAmount);
                break;
            case 'remLiquidity':
                await remLiquidity(command.tokenId, command.userId, command.inputAmount, command.outputAmount);
                break;
            case 'convert':
                await convert(command.sourceTokenId, command.targetTokenId, command.userId, command.inputAmount, command.outputAmount);
                break;
            default:
                throw new Error(`operation '${command.operation}' not supported`);
            }
        });
    }

    async function newPool(pTokenId, sTokenId, numOfUsers) {
        const totalSupply = web3.utils.toBN('0x'.padEnd(66, 'f'));
        const initBalance = totalSupply.div(web3.utils.toBN(numOfUsers));

        reserveTokens = {
            [pTokenId]: await ERC20Token.new(pTokenId, pTokenId, 0, totalSupply),
            [sTokenId]: await ERC20Token.new(sTokenId, sTokenId, 0, totalSupply),
        };

        priceOracles = [];
        for (let i = 0; i < 2; i++) {
            priceOracles[i] = await ChainlinkPriceOracle.new();
            await whitelist.addAddress(priceOracles[i].address);
        }

        await converter.addReserve(reserveTokens[pTokenId].address, percentageToPPM('50%'));
        await converter.addReserve(reserveTokens[sTokenId].address, percentageToPPM('50%'));
        await container.transferOwnership(converter.address);
        await converter.acceptAnchorOwnership();
        await converter.activate(reserveTokens[pTokenId].address, priceOracles[0].address, priceOracles[1].address);

        for (const account of accounts.slice(1, numOfUsers + 1)) {
            reserveTokens[pTokenId].transfer(account, initBalance);
            reserveTokens[sTokenId].transfer(account, initBalance);
        }

        poolTokens = {
            [pTokenId]: await ERC20Token.at(await converter.poolToken(reserveTokens[pTokenId].address)),
            [sTokenId]: await ERC20Token.at(await converter.poolToken(reserveTokens[sTokenId].address)),
        };
    }

    async function setRates(pTokenRate, sTokenRate) {
        await priceOracles[0].setAnswer(pTokenRate);
        await priceOracles[1].setAnswer(sTokenRate);
        await priceOracles[0].setTimestamp(timestamp);
        await priceOracles[1].setTimestamp(timestamp);
    }

    async function setFeeFactors(lowFeeFactor, highFeeFactor) {
        await converter.setFeeFactors(percentageToPPM(lowFeeFactor), percentageToPPM(highFeeFactor));
    }

    async function addLiquidity(tokenId, userId, inputAmount, outputAmount) {
        await reserveTokens[tokenId].approve(converter.address, inputAmount, {from: accounts[userId]});
        const response = await converter.addLiquidity(reserveTokens[tokenId].address, inputAmount, MIN_RETURN, {from: accounts[userId]});
        assertAlmostEqual(response.logs.filter(log => log.event == 'LiquidityAdded')[0].args._amount, outputAmount);
    }

    async function remLiquidity(tokenId, userId, inputAmount, outputAmount) {
        inputAmount = inputAmount != 'all' ? inputAmount : await poolTokens[tokenId].balanceOf(accounts[userId]);
        await reserveTokens[tokenId].approve(converter.address, inputAmount, {from: accounts[userId]});
        const response = await converter.removeLiquidity(poolTokens[tokenId].address, inputAmount, MIN_RETURN, {from: accounts[userId]});
        assertAlmostEqual(response.logs.filter(log => log.event == 'LiquidityRemoved')[0].args._amount, outputAmount);
    }

    async function convert(sourceTokenId, targetTokenId, userId, inputAmount, outputAmount) {
        const path = [reserveTokens[sourceTokenId].address, container.address, reserveTokens[targetTokenId].address];
        await reserveTokens[sourceTokenId].approve(bancorNetwork.address, inputAmount, {from: accounts[userId]});
        const response = await bancorNetwork.convertByPath(path, inputAmount, MIN_RETURN, ZERO_ADDRESS, ZERO_ADDRESS, 0, {from: accounts[userId]});
        assertAlmostEqual(response.logs.filter(log => log.event == 'Conversion')[0].args._toAmount, outputAmount);
    }
});
