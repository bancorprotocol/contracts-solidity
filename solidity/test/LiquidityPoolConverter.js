const { accounts, defaultSender, contract } = require('@openzeppelin/test-environment');
const { expectRevert, constants, BN } = require('@openzeppelin/test-helpers');
const { expect } = require('../../chai-local');

const { ETH_RESERVE_ADDRESS, registry } = require('./helpers/Constants');

const { ZERO_ADDRESS } = constants;

const BancorNetwork = contract.fromArtifact('BancorNetwork');
const BancorFormula = contract.fromArtifact('BancorFormula');
const ContractRegistry = contract.fromArtifact('ContractRegistry');
const ERC20Token = contract.fromArtifact('ERC20Token');
const TestNonStandardToken = contract.fromArtifact('TestNonStandardToken');
const ConverterFactory = contract.fromArtifact('ConverterFactory');
const ConverterUpgrader = contract.fromArtifact('ConverterUpgrader');
const Whitelist = contract.fromArtifact('Whitelist');

const LiquidityPoolV1Converter = contract.fromArtifact('LiquidityPoolV1Converter');
const LiquidityPoolV1ConverterFactory = contract.fromArtifact('LiquidityPoolV1ConverterFactory');
const DSToken = contract.fromArtifact('DSToken');

describe('LiquidityPoolConverter', () => {
    const createConverter = async (
        type,
        anchorAddress,
        registryAddress = contractRegistry.address,
        maxConversionFee = 0
    ) => {
        switch (type) {
            case 1:
                return LiquidityPoolV1Converter.new(anchorAddress, registryAddress, maxConversionFee);
        }
    };

    const createAnchor = async (type) => {
        switch (type) {
            case 1:
                return await DSToken.new('Pool1', 'POOL1', 2);
        }
    };

    const initConverter = async (type, activate, addLiquidity, isETHReserve, maxConversionFee = 0) => {
        anchor = await createAnchor(type);
        anchorAddress = anchor.address;

        const converter = await createConverter(type, anchorAddress, contractRegistry.address, maxConversionFee);
        switch (type) {
            case 1:
                await converter.addReserve(getReserve1Address(isETHReserve), 250000);
                await converter.addReserve(reserveToken2.address, 150000);
                break;
        }

        if (activate) {
            await anchor.transferOwnership(converter.address);
            await converter.acceptAnchorOwnership();
        }

        if (addLiquidity) {
            if (!isETHReserve) {
                await reserveToken.approve(converter.address, 10000, { from: sender });
            }
            await reserveToken2.approve(converter.address, 12000, { from: sender });

            switch (type) {
                case 1:
                    await converter.addLiquidity(
                        [getReserve1Address(isETHReserve), reserveToken2.address],
                        [10000, 12000],
                        1,
                        { value: isETHReserve ? 10000 : 0 }
                    );
                    break;
            }
        }

        return converter;
    };

    const getConverterName = (type) => {
        switch (type) {
            case 1:
                return 'LiquidityPoolV1Converter';
        }

        return 'Unknown';
    };

    const getReserve1Address = (isETH) => {
        return isETH ? ETH_RESERVE_ADDRESS : reserveToken.address;
    };

    const verifyReserve = (reserve, balance, weight, isSet) => {
        expect(reserve[0]).to.be.bignumber.equal(balance);
        expect(reserve[1]).to.be.bignumber.equal(weight);
        expect(reserve[4]).to.be.eql(isSet);
    };

    const convert = async (path, amount, minReturn, options = {}) => {
        return bancorNetwork.convertByPath(path, amount, minReturn, ZERO_ADDRESS, ZERO_ADDRESS, 0, options);
    };

    const convertCall = async (path, amount, minReturn, options = {}) => {
        return bancorNetwork.convertByPath.call(path, amount, minReturn, ZERO_ADDRESS, ZERO_ADDRESS, 0, options);
    };

    let bancorNetwork;
    let anchor;
    let anchorAddress;
    let contractRegistry;
    let reserveToken;
    let reserveToken2;
    let reserveToken3;
    let upgrader;
    const sender = defaultSender;
    const whitelisted = accounts[1];
    const beneficiary = accounts[2];

    const CONVERTER_TYPES = [1];
    const MIN_RETURN = new BN(1);
    const WEIGHT_10_PERCENT = new BN(100000);
    const WEIGHT_20_PERCENT = new BN(200000);
    const WEIGHT_50_PERCENT = new BN(500000);

    before(async () => {
        // The following contracts are unaffected by the underlying tests, this can be shared.
        const bancorFormula = await BancorFormula.new();
        await bancorFormula.init();
        contractRegistry = await ContractRegistry.new();

        await contractRegistry.registerAddress(registry.BANCOR_FORMULA, bancorFormula.address);

        const factory = await ConverterFactory.new();
        await contractRegistry.registerAddress(registry.CONVERTER_FACTORY, factory.address);

        await factory.registerTypedConverterFactory((await LiquidityPoolV1ConverterFactory.new()).address);
    });

    beforeEach(async () => {
        bancorNetwork = await BancorNetwork.new(contractRegistry.address);
        await contractRegistry.registerAddress(registry.BANCOR_NETWORK, bancorNetwork.address);

        upgrader = await ConverterUpgrader.new(contractRegistry.address, ZERO_ADDRESS);
        await contractRegistry.registerAddress(registry.CONVERTER_UPGRADER, upgrader.address);

        reserveToken = await ERC20Token.new('ERC Token 1', 'ERC1', 18, 1000000000);
        reserveToken2 = await TestNonStandardToken.new('ERC Token 2', 'ERC2', 18, 2000000000);
        reserveToken3 = await ERC20Token.new('ERC Token 3', 'ERC3', 18, 1500000000);
    });
    for (const type of CONVERTER_TYPES) {
        for (let isETHReserve = 0; isETHReserve < 2; isETHReserve++) {
            describe(`${getConverterName(type)}${
                isETHReserve === 0 ? '(with ERC20 reserves)' : '(with ETH reserve)'
            }:`, () => {
                it('verifies the reserve anchor count and reserve ratio before / after adding a reserve', async () => {
                    const anchor = await createAnchor(type);
                    const converter = await createConverter(type, anchor.address, contractRegistry.address, 0);

                    await converter.addReserve(getReserve1Address(isETHReserve), WEIGHT_10_PERCENT);
                    let reserveTokenCount = await converter.reserveTokenCount.call();
                    let reserveRatio = await converter.reserveRatio.call();
                    expect(reserveTokenCount).to.be.bignumber.equal(new BN(1));
                    expect(reserveRatio).to.be.bignumber.equal(WEIGHT_10_PERCENT);

                    await converter.addReserve(reserveToken2.address, WEIGHT_20_PERCENT);
                    reserveTokenCount = await converter.reserveTokenCount.call();
                    reserveRatio = await converter.reserveRatio.call();
                    expect(reserveTokenCount).to.be.bignumber.equal(new BN(2));
                    expect(reserveRatio).to.be.bignumber.equal(WEIGHT_10_PERCENT.add(WEIGHT_20_PERCENT));
                });

                it('verifies that 2 reserves are added correctly', async () => {
                    const anchor = await createAnchor(type);
                    const converter = await createConverter(type, anchor.address, contractRegistry.address, 200000);

                    await converter.addReserve(getReserve1Address(isETHReserve), WEIGHT_10_PERCENT);
                    const reserve = await converter.reserves.call(getReserve1Address(isETHReserve));
                    verifyReserve(reserve, new BN(0), WEIGHT_10_PERCENT, true);

                    await converter.addReserve(reserveToken2.address, WEIGHT_20_PERCENT);
                    const reserve2 = await converter.reserves.call(reserveToken2.address);
                    verifyReserve(reserve2, new BN(0), WEIGHT_20_PERCENT, true);
                });

                if (type === 1) {
                    it('should revert when attempting to add a reserve when the converter is active', async () => {
                        const converter = await initConverter(type, true, true, isETHReserve);

                        await expectRevert(
                            converter.addReserve(reserveToken3.address, WEIGHT_10_PERCENT),
                            'ERR_ACTIVE'
                        );
                    });
                } else {
                    it('should revert when attempting to add an additional reserve when the converter is active', async () => {
                        const converter = await initConverter(type, true, true, isETHReserve);

                        await expectRevert(
                            converter.addReserve(reserveToken3.address, WEIGHT_10_PERCENT),
                            'ERR_INVALID_RESERVE_COUNT'
                        );
                    });
                }

                it('should revert when attempting to add a reserve that already exists', async () => {
                    const anchor = await createAnchor(type);
                    const converter = await createConverter(type, anchor.address, contractRegistry.address, 0);
                    await converter.addReserve(getReserve1Address(isETHReserve), WEIGHT_10_PERCENT);

                    await expectRevert(
                        converter.addReserve(getReserve1Address(isETHReserve), WEIGHT_20_PERCENT),
                        'ERR_INVALID_RESERVE'
                    );
                });

                it('should revert when attempting to add multiple reserves with total weight greater than 100%', async () => {
                    const anchor = await createAnchor(type);
                    const converter = await createConverter(type, anchor.address, contractRegistry.address, 0);
                    await converter.addReserve(getReserve1Address(isETHReserve), WEIGHT_50_PERCENT);

                    await expectRevert(
                        converter.addReserve(reserveToken2.address, WEIGHT_50_PERCENT.add(new BN(1))),
                        'ERR_INVALID_RESERVE_WEIGHT'
                    );
                });

                it('should revert when the owner attempts to accept the anchor ownership and only 1 reserve is defined', async () => {
                    const anchor = await createAnchor(type);
                    const converter = await createConverter(type, anchor.address, contractRegistry.address, 0);
                    await converter.addReserve(getReserve1Address(isETHReserve), WEIGHT_50_PERCENT);

                    await expectRevert(converter.acceptAnchorOwnership(), 'ERR_INVALID_RESERVE_COUNT');
                });

                it('verifies that targetAmountAndFee returns a valid amount', async () => {
                    const converter = await initConverter(type, true, true, isETHReserve);

                    const amount = new BN(500);
                    const returnAmount = (
                        await converter.targetAmountAndFee.call(
                            getReserve1Address(isETHReserve),
                            reserveToken2.address,
                            amount
                        )
                    )[0];
                    expect(returnAmount).to.be.bignumber.gt(new BN(0));
                });

                it('should revert when attempting to get the target amount between the pool anchor and a reserve', async () => {
                    const converter = await initConverter(type, true, true, isETHReserve);

                    const amount = new BN(500);
                    await expectRevert(
                        converter.targetAmountAndFee.call(anchorAddress, getReserve1Address(isETHReserve), amount),
                        'ERR_INVALID_RESERVE'
                    );
                });

                it('should revert when attempting to get the target amount while the converter is not active', async () => {
                    const converter = await initConverter(type, false, false, isETHReserve);

                    const amount = new BN(500);
                    await expectRevert(
                        converter.targetAmountAndFee.call(
                            getReserve1Address(isETHReserve),
                            reserveToken2.address,
                            amount
                        ),
                        'ERR_INACTIVE'
                    );
                });

                it('should revert when attempting to convert with 0 minimum requested amount', async () => {
                    await initConverter(type, true, true, isETHReserve);

                    const amount = new BN(500);
                    let value = 0;
                    if (isETHReserve) {
                        value = amount;
                    } else {
                        await reserveToken.approve(bancorNetwork.address, amount, { from: sender });
                    }

                    await expectRevert(
                        convert([getReserve1Address(isETHReserve), anchorAddress, reserveToken2.address], amount, 0, {
                            value
                        }),
                        'ERR_ZERO_VALUE'
                    );
                });

                it('should revert when attempting to convert when the return is smaller than the minimum requested amount', async () => {
                    await initConverter(type, true, true, isETHReserve);

                    const amount = new BN(500);
                    let value = 0;
                    if (isETHReserve) {
                        value = amount;
                    } else {
                        await reserveToken.approve(bancorNetwork.address, amount, { from: sender });
                    }

                    await expectRevert(
                        convert(
                            [getReserve1Address(isETHReserve), anchorAddress, reserveToken2.address],
                            amount,
                            2000,
                            { value }
                        ),
                        'ERR_RETURN_TOO_LOW'
                    );
                });

                it('verifies that convert is allowed for a whitelisted account', async () => {
                    const converter = await initConverter(type, true, true, isETHReserve);

                    const whitelist = await Whitelist.new();
                    await whitelist.addAddress(converter.address);
                    await whitelist.addAddress(whitelisted);
                    await converter.setConversionWhitelist(whitelist.address);

                    const amount = new BN(500);
                    let value = 0;
                    if (isETHReserve) {
                        value = amount;
                    } else {
                        await reserveToken.transfer(whitelisted, amount.mul(new BN(2)));
                        await reserveToken.approve(bancorNetwork.address, amount, { from: whitelisted });
                    }

                    await convert(
                        [getReserve1Address(isETHReserve), anchorAddress, reserveToken2.address],
                        amount,
                        MIN_RETURN,
                        { from: whitelisted, value }
                    );
                });

                it('should revert when calling convert from a non whitelisted account', async () => {
                    const converter = await initConverter(type, true, true, isETHReserve);

                    const whitelist = await Whitelist.new();
                    await whitelist.addAddress(converter.address);
                    await converter.setConversionWhitelist(whitelist.address);

                    const amount = new BN(500);
                    let value = 0;
                    if (isETHReserve) {
                        value = amount;
                    } else {
                        await reserveToken.transfer(whitelisted, amount.mul(new BN(2)));
                        await reserveToken.approve(bancorNetwork.address, amount, { from: whitelisted });
                    }

                    await expectRevert(
                        convert(
                            [getReserve1Address(isETHReserve), anchorAddress, reserveToken2.address],
                            amount,
                            MIN_RETURN,
                            { from: whitelisted, value }
                        ),
                        'ERR_NOT_WHITELISTED'
                    );
                });

                it('should revert when calling convert while the beneficiary is not whitelisted', async () => {
                    const converter = await initConverter(type, true, true, isETHReserve);
                    const whitelist = await Whitelist.new();
                    await whitelist.addAddress(whitelisted);
                    await converter.setConversionWhitelist(whitelist.address);

                    const amount = new BN(500);
                    let value = 0;
                    if (isETHReserve) {
                        value = amount;
                    } else {
                        await reserveToken.transfer(whitelisted, amount.mul(new BN(2)));
                        await reserveToken.approve(bancorNetwork.address, amount, { from: whitelisted });
                    }

                    await expectRevert(
                        bancorNetwork.convertByPath(
                            [getReserve1Address(isETHReserve), anchorAddress, reserveToken2.address],
                            amount,
                            MIN_RETURN,
                            beneficiary,
                            ZERO_ADDRESS,
                            0,
                            { from: whitelisted, value }
                        ),
                        'ERR_NOT_WHITELISTED'
                    );
                });

                it('verifies that targetAmountAndFee returns the same amount as converting', async () => {
                    const converter = await initConverter(type, true, true, isETHReserve);

                    const amount = new BN(500);
                    const returnAmount = (
                        await converter.targetAmountAndFee.call(
                            getReserve1Address(isETHReserve),
                            reserveToken2.address,
                            amount
                        )
                    )[0];

                    let value = 0;
                    if (isETHReserve) {
                        value = amount;
                    } else {
                        await reserveToken.approve(bancorNetwork.address, amount, { from: sender });
                    }

                    const returnAmount2 = await convertCall(
                        [getReserve1Address(isETHReserve), anchorAddress, reserveToken2.address],
                        amount,
                        MIN_RETURN,
                        { value }
                    );

                    expect(returnAmount2).to.be.bignumber.equal(returnAmount);
                });
            });
        }
    }
});
