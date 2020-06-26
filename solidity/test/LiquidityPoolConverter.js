const { expect } = require('chai');
const { expectRevert, constants, BN } = require('@openzeppelin/test-helpers');

const { ETH_RESERVE_ADDRESS, registry } = require('./helpers/Constants');
const { ZERO_ADDRESS } = constants;

const BancorNetwork = artifacts.require('BancorNetwork');
const LiquidityPoolV1Converter = artifacts.require('LiquidityPoolV1Converter');
const LiquidityPoolV1ConverterFactory = artifacts.require('LiquidityPoolV1ConverterFactory');
const SmartToken = artifacts.require('SmartToken');
const BancorFormula = artifacts.require('BancorFormula');
const ContractRegistry = artifacts.require('ContractRegistry');
const ERC20Token = artifacts.require('ERC20Token');
const TestNonStandardToken = artifacts.require('TestNonStandardToken');
const ConverterFactory = artifacts.require('ConverterFactory');
const ConverterUpgrader = artifacts.require('ConverterUpgrader');
const Whitelist = artifacts.require('Whitelist');

contract('LiquidityPoolConverter', accounts => {
    const createConverter = async (tokenAddress, registryAddress = contractRegistry.address, maxConversionFee = 0) => {
        return LiquidityPoolV1Converter.new(tokenAddress, registryAddress, maxConversionFee);
    };

    const initConverter = async (activate, isETHReserve, maxConversionFee = 0) => {
        token = await SmartToken.new('Token1', 'TKN1', 2);
        tokenAddress = token.address;

        const converter = await createConverter(tokenAddress, contractRegistry.address, maxConversionFee);
        await converter.addReserve(getReserve1Address(isETHReserve), 250000);
        await converter.addReserve(reserveToken2.address, 150000);
        await reserveToken2.transfer(converter.address, 8000);
        await token.issue(owner, 20000);

        if (isETHReserve) {
            await converter.send(5000);
        } else {
            await reserveToken.transfer(converter.address, 5000);
        }

        if (activate) {
            await token.transferOwnership(converter.address);
            await converter.acceptTokenOwnership();
        }

        return converter;
    };

    const getReserve1Address = (isETH) => {
        return isETH ? ETH_RESERVE_ADDRESS : reserveToken.address;
    };

    const verifyReserve = (reserve, balance, weight, isSet) => {
        expect(reserve[0]).to.be.bignumber.equal(balance);
        expect(reserve[1]).to.be.bignumber.equal(weight);
        expect(reserve[4]).to.be.eql(isSet);
    };

    const convert = async (path, amount, minReturn, options) => {
        return bancorNetwork.convertByPath(path, amount, minReturn, ZERO_ADDRESS, ZERO_ADDRESS, 0, options);
    };

    const convertCall = async (path, amount, minReturn, options) => {
        return bancorNetwork.convertByPath.call(path, amount, minReturn, ZERO_ADDRESS, ZERO_ADDRESS, 0, options);
    };

    let bancorNetwork;
    let bancorFormula;
    let factory;
    let token;
    let tokenAddress;
    let contractRegistry;
    let reserveToken;
    let reserveToken2;
    let reserveToken3;
    let upgrader;
    const owner = accounts[0];
    const receiver = accounts[1];
    const beneficiary = accounts[2];

    const WEIGHT_10_PERCENT = new BN(100000);
    const WEIGHT_20_PERCENT = new BN(200000);
    const WEIGHT_50_PERCENT = new BN(500000);

    beforeEach(async () => {
        contractRegistry = await ContractRegistry.new();

        bancorFormula = await BancorFormula.new();
        await contractRegistry.registerAddress(registry.BANCOR_FORMULA, bancorFormula.address);

        bancorNetwork = await BancorNetwork.new(contractRegistry.address);
        await contractRegistry.registerAddress(registry.BANCOR_NETWORK, bancorNetwork.address);

        factory = await ConverterFactory.new();
        await contractRegistry.registerAddress(registry.CONVERTER_FACTORY, factory.address);

        await factory.registerTypedConverterFactory((await LiquidityPoolV1ConverterFactory.new()).address);

        upgrader = await ConverterUpgrader.new(contractRegistry.address, ZERO_ADDRESS);
        await contractRegistry.registerAddress(registry.CONVERTER_UPGRADER, upgrader.address);

        token = await SmartToken.new('Token1', 'TKN1', 2);
        tokenAddress = token.address;

        reserveToken = await ERC20Token.new('ERC Token 1', 'ERC1', 0, 1000000000);
        reserveToken2 = await TestNonStandardToken.new('ERC Token 2', 'ERC2', 0, 2000000000);
        reserveToken3 = await ERC20Token.new('ERC Token 3', 'ERC3', 0, 1500000000);
    });

    for (let isETHReserve = 0; isETHReserve < 2; isETHReserve++) {
        describe(`${isETHReserve === 0 ? '(with ERC20 reserves)' : '(with ETH reserve)'}:`, () => {
            it('verifies the reserve token count and reserve ratio before / after adding a reserve', async () => {
                const converter = await createConverter(tokenAddress, contractRegistry.address, 0);

                await converter.addReserve(getReserve1Address(isETHReserve), WEIGHT_10_PERCENT);
                let reserveTokenCount = await converter.reserveTokenCount.call();
                expect(reserveTokenCount).to.be.bignumber.equal(new BN(1));
                let reserveRatio = await converter.reserveRatio.call();
                expect(reserveRatio).to.be.bignumber.equal(WEIGHT_10_PERCENT);

                await converter.addReserve(reserveToken2.address, WEIGHT_20_PERCENT);
                reserveTokenCount = await converter.reserveTokenCount.call();
                expect(reserveTokenCount).to.be.bignumber.equal(new BN(2));
                reserveRatio = await converter.reserveRatio.call();
                expect(reserveRatio).to.be.bignumber.equal(WEIGHT_10_PERCENT.add(WEIGHT_20_PERCENT));
            });

            it('verifies that 2 reserves are added correctly', async () => {
                const converter = await createConverter(tokenAddress, contractRegistry.address, 200000);

                await converter.addReserve(getReserve1Address(isETHReserve), WEIGHT_10_PERCENT);
                const reserve = await converter.reserves.call(getReserve1Address(isETHReserve));
                verifyReserve(reserve, new BN(0), WEIGHT_10_PERCENT, true);

                await converter.addReserve(reserveToken2.address, WEIGHT_20_PERCENT);
                const reserve2 = await converter.reserves.call(reserveToken2.address);
                verifyReserve(reserve2, new BN(0), WEIGHT_20_PERCENT, true);
            });

            it('should revert when attempting to add a reserve when the converter is active', async () => {
                const converter = await initConverter(true, isETHReserve);

                await expectRevert(converter.addReserve(reserveToken3.address, WEIGHT_10_PERCENT), 'ERR_ACTIVE');
            });

            it('should revert when attempting to add a reserve that already exists', async () => {
                const converter = await createConverter(tokenAddress, contractRegistry.address, 0);
                await converter.addReserve(getReserve1Address(isETHReserve), WEIGHT_10_PERCENT);

                await expectRevert(converter.addReserve(getReserve1Address(isETHReserve), WEIGHT_20_PERCENT),
                    'ERR_INVALID_RESERVE');
            });

            it('should revert when attempting to add multiple reserves with total weight greater than 100%', async () => {
                const converter = await createConverter(tokenAddress, contractRegistry.address, 0);
                await converter.addReserve(getReserve1Address(isETHReserve), WEIGHT_50_PERCENT);

                await expectRevert(converter.addReserve(reserveToken2.address, WEIGHT_50_PERCENT.add(new BN(1))),
                    'ERR_INVALID_RESERVE_WEIGHT');
            });

            it('should revert when the owner attempts to accept the token ownership and only 1 reserve is defined', async () => {
                const converter = await createConverter(tokenAddress, contractRegistry.address, 0);
                await converter.addReserve(getReserve1Address(isETHReserve), WEIGHT_50_PERCENT);

                await expectRevert(converter.acceptTokenOwnership(), 'ERR_INVALID_RESERVE_COUNT');
            });

            it('verifies that targetAmountAndFee returns a valid amount', async () => {
                const converter = await initConverter(true, isETHReserve);

                const returnAmount = (await converter.targetAmountAndFee.call(getReserve1Address(isETHReserve),
                    reserveToken2.address, 500))[0];
                expect(returnAmount).to.be.bignumber.equal(new BN(1175));
            });

            it('should revert when attempting to get the target amount between the pool token and a reserve', async () => {
                const converter = await initConverter(true, isETHReserve);

                await expectRevert(converter.targetAmountAndFee.call(tokenAddress, getReserve1Address(isETHReserve),
                    500), 'ERR_INVALID_RESERVE');
            });

            it('should revert when attempting to get the target amount while the converter is not active', async () => {
                const converter = await initConverter(false, isETHReserve);

                await expectRevert(converter.targetAmountAndFee.call(getReserve1Address(isETHReserve),
                    reserveToken2.address, 500), 'ERR_INACTIVE');
            });

            it('should revert when attempting to convert with 0 minimum requested amount', async () => {
                await initConverter(true, isETHReserve);

                let value = 0;
                if (isETHReserve) {
                    value = 500;
                } else {
                    await reserveToken.approve(bancorNetwork.address, 500, { from: owner });
                }

                await expectRevert(convert([getReserve1Address(isETHReserve), tokenAddress, reserveToken2.address],
                    500, 0, { value }), 'ERR_ZERO_VALUE');
            });

            it('verifies that convert is allowed for a whitelisted account', async () => {
                const converter = await initConverter(true, isETHReserve);

                const whitelist = await Whitelist.new();
                await whitelist.addAddress(converter.address);
                await whitelist.addAddress(receiver);
                await converter.setConversionWhitelist(whitelist.address);
                await reserveToken.transfer(receiver, 1000);

                let value = 0;
                if (isETHReserve) {
                    value = 500;
                } else {
                    await reserveToken.approve(bancorNetwork.address, 500, { from: receiver });
                }

                await convert([getReserve1Address(isETHReserve), tokenAddress, reserveToken2.address], 500, 1,
                    { from: receiver, value });
            });

            it('should revert when calling convert from a non whitelisted account', async () => {
                const converter = await initConverter(true, isETHReserve);

                const whitelist = await Whitelist.new();
                await whitelist.addAddress(converter.address);
                await converter.setConversionWhitelist(whitelist.address);
                await reserveToken.transfer(receiver, 1000);

                let value = 0;
                if (isETHReserve) {
                    value = 500;
                } else {
                    await reserveToken.approve(bancorNetwork.address, 500, { from: receiver });
                }

                await expectRevert(convert([getReserve1Address(isETHReserve), tokenAddress, reserveToken2.address],
                    500, 1, { from: receiver, value }), 'ERR_NOT_WHITELISTED');
            });

            it('should revert when calling convert while the beneficiary is not whitelisted', async () => {
                const converter = await initConverter(true, isETHReserve);
                const whitelist = await Whitelist.new();
                await whitelist.addAddress(receiver);
                await converter.setConversionWhitelist(whitelist.address);
                await reserveToken.transfer(receiver, 1000);

                let value = 0;
                if (isETHReserve) {
                    value = 500;
                } else {
                    await reserveToken.approve(bancorNetwork.address, 500, { from: receiver });
                }

                await expectRevert(bancorNetwork.convertByPath([getReserve1Address(isETHReserve), tokenAddress,
                    reserveToken2.address], 500, 1, beneficiary, ZERO_ADDRESS, 0, { from: receiver, value }), 'ERR_NOT_WHITELISTED');
            });

            it('verifies that targetAmountAndFee returns the same amount as converting', async () => {
                const converter = await initConverter(true, isETHReserve);

                const returnAmount = (await converter.targetAmountAndFee.call(getReserve1Address(isETHReserve),
                    reserveToken2.address, 500))[0];

                let value = 0;
                if (isETHReserve) {
                    value = 500;
                } else {
                    await reserveToken.approve(bancorNetwork.address, 500, { from: owner });
                }

                const returnAmount2 = await convertCall([getReserve1Address(isETHReserve), tokenAddress,
                    reserveToken2.address], 500, 1, { value });

                expect(returnAmount2).to.be.bignumber.equal(returnAmount);
            });
        });
    }
});
