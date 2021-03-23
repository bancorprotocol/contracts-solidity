const { expect } = require('chai');

const { BigNumber } = require('ethers');
const { NATIVE_TOKEN_ADDRESS, ZERO_ADDRESS, registry } = require('./helpers/Constants');

const BancorNetwork = ethers.getContractFactory('BancorNetwork');
const BancorFormula = ethers.getContractFactory('BancorFormula');
const ContractRegistry = ethers.getContractFactory('ContractRegistry');
const TestStandardToken = ethers.getContractFactory('TestStandardToken');
const TestNonStandardToken = ethers.getContractFactory('TestNonStandardToken');
const ConverterFactory = ethers.getContractFactory('ConverterFactory');
const ConverterUpgrader = ethers.getContractFactory('ConverterUpgrader');
const Whitelist = ethers.getContractFactory('Whitelist');

const LiquidityPoolV1Converter = ethers.getContractFactory('LiquidityPoolV1Converter');
const LiquidityPoolV1ConverterFactory = ethers.getContractFactory('LiquidityPoolV1ConverterFactory');
const DSToken = ethers.getContractFactory('DSToken');

let bancorNetwork;
let anchor;
let anchorAddress;
let contractRegistry;
let reserveToken;
let reserveToken2;
let reserveToken3;
let upgrader;
let sender;
let whitelisted;
let beneficiary;

const CONVERTER_TYPES = [1];
const MIN_RETURN = BigNumber.from(1);
const WEIGHT_10_PERCENT = BigNumber.from(100000);
const WEIGHT_20_PERCENT = BigNumber.from(200000);
const WEIGHT_50_PERCENT = BigNumber.from(500000);

describe('LiquidityPoolConverter', () => {
    const createConverter = async (
        type,
        anchorAddress,
        registryAddress = contractRegistry.address,
        maxConversionFee = 0
    ) => {
        switch (type) {
            case 1:
                return await (await LiquidityPoolV1Converter).deploy(anchorAddress, registryAddress, maxConversionFee);
        }
    };

    const createAnchor = async (type) => {
        switch (type) {
            case 1:
                return await (await DSToken).deploy('Pool1', 'POOL1', 2);
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
                await reserveToken.connect(sender).approve(converter.address, 10000);
            }
            await reserveToken2.connect(sender).approve(converter.address, 12000);

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
        return isETH ? NATIVE_TOKEN_ADDRESS : reserveToken.address;
    };

    const verifyReserve = (reserve, balance, weight, isSet) => {
        expect(reserve[0]).to.be.equal(balance);
        expect(reserve[1]).to.be.equal(weight);
        expect(reserve[4]).to.be.eql(isSet);
    };

    const convert = async (path, amount, minReturn, options = {}, from = null) => {
        if (from != null) {
            return bancorNetwork
                .connect(from)
                .convertByPath2(path, amount, minReturn, ethers.constants.AddressZero, options);
        }
        return bancorNetwork.convertByPath2(path, amount, minReturn, ethers.constants.AddressZero, options);
    };

    const convertCall = async (path, amount, minReturn, options = {}) => {
        // This is a static call
        // https://docs.ethers.io/v5/api/contract/contract/#contract-callStatic
        return bancorNetwork.callStatic.convertByPath2(path, amount, minReturn, ethers.constants.AddressZero, options);
    };

    before(async () => {
        accounts = await ethers.getSigners();

        sender = accounts[0];
        whitelisted = accounts[1];
        beneficiary = accounts[2];

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

        reserveToken = await (await TestStandardToken).deploy('ERC Token 1', 'ERC1', 18, 1000000000);
        reserveToken2 = await (await TestNonStandardToken).deploy('ERC Token 2', 'ERC2', 18, 2000000000);
        reserveToken3 = await (await TestStandardToken).deploy('ERC Token 3', 'ERC3', 18, 1500000000);
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
                    let reserveTokenCount = await converter.reserveTokenCount();
                    let reserveRatio = await converter.reserveRatio();
                    expect(reserveTokenCount).to.be.equal(BigNumber.from(1));
                    expect(reserveRatio).to.be.equal(WEIGHT_10_PERCENT);

                    await converter.addReserve(reserveToken2.address, WEIGHT_20_PERCENT);
                    reserveTokenCount = await converter.reserveTokenCount();
                    reserveRatio = await converter.reserveRatio();
                    expect(reserveTokenCount).to.be.equal(BigNumber.from(2));
                    expect(reserveRatio).to.be.equal(WEIGHT_10_PERCENT.add(WEIGHT_20_PERCENT));
                });

                it('verifies that 2 reserves are added correctly', async () => {
                    const anchor = await createAnchor(type);
                    const converter = await createConverter(type, anchor.address, contractRegistry.address, 200000);

                    await converter.addReserve(getReserve1Address(isETHReserve), WEIGHT_10_PERCENT);
                    const reserve = await converter.reserves(getReserve1Address(isETHReserve));
                    verifyReserve(reserve, BigNumber.from(0), WEIGHT_10_PERCENT, true);

                    await converter.addReserve(reserveToken2.address, WEIGHT_20_PERCENT);
                    const reserve2 = await converter.reserves(reserveToken2.address);
                    verifyReserve(reserve2, BigNumber.from(0), WEIGHT_20_PERCENT, true);
                });

                if (type === 1) {
                    it('should revert when attempting to add a reserve when the converter is active', async () => {
                        const converter = await initConverter(type, true, true, isETHReserve);

                        await expect(converter.addReserve(reserveToken3.address, WEIGHT_10_PERCENT)).to.be.revertedWith(
                            'ERR_ACTIVE'
                        );
                    });
                } else {
                    it('should revert when attempting to add an additional reserve when the converter is active', async () => {
                        const converter = await initConverter(type, true, true, isETHReserve);

                        await expect(converter.addReserve(reserveToken3.address, WEIGHT_10_PERCENT)).to.be.revertedWith(
                            'ERR_INVALID_RESERVE_COUNT'
                        );
                    });
                }

                it('should revert when attempting to add a reserve that already exists', async () => {
                    const anchor = await createAnchor(type);
                    const converter = await createConverter(type, anchor.address, contractRegistry.address, 0);
                    await converter.addReserve(getReserve1Address(isETHReserve), WEIGHT_10_PERCENT);

                    await expect(
                        converter.addReserve(getReserve1Address(isETHReserve), WEIGHT_20_PERCENT)
                    ).to.be.revertedWith('ERR_INVALID_RESERVE');
                });

                it('should revert when attempting to add multiple reserves with total weight greater than 100%', async () => {
                    const anchor = await createAnchor(type);
                    const converter = await createConverter(type, anchor.address, contractRegistry.address, 0);
                    await converter.addReserve(getReserve1Address(isETHReserve), WEIGHT_50_PERCENT);

                    await expect(
                        converter.addReserve(reserveToken2.address, WEIGHT_50_PERCENT.add(BigNumber.from(1)))
                    ).to.be.revertedWith('ERR_INVALID_RESERVE_WEIGHT');
                });

                it('should revert when the owner attempts to accept the anchor ownership and only 1 reserve is defined', async () => {
                    const anchor = await createAnchor(type);
                    const converter = await createConverter(type, anchor.address, contractRegistry.address, 0);
                    await converter.addReserve(getReserve1Address(isETHReserve), WEIGHT_50_PERCENT);

                    await expect(converter.acceptAnchorOwnership()).to.be.revertedWith('ERR_INVALID_RESERVE_COUNT');
                });

                it('verifies that targetAmountAndFee returns a valid amount', async () => {
                    const converter = await initConverter(type, true, true, isETHReserve);

                    const amount = BigNumber.from(500);
                    const returnAmount = (
                        await converter.targetAmountAndFee(
                            getReserve1Address(isETHReserve),
                            reserveToken2.address,
                            amount
                        )
                    )[0];
                    expect(returnAmount).to.be.gt(BigNumber.from(0));
                });

                it('should revert when attempting to get the target amount between the pool anchor and a reserve', async () => {
                    const converter = await initConverter(type, true, true, isETHReserve);

                    const amount = BigNumber.from(500);
                    await expect(
                        converter.targetAmountAndFee(anchorAddress, getReserve1Address(isETHReserve), amount)
                    ).to.be.revertedWith('ERR_INVALID_RESERVE');
                });

                it('should revert when attempting to get the target amount while the converter is not active', async () => {
                    const converter = await initConverter(type, false, false, isETHReserve);

                    const amount = BigNumber.from(500);
                    await expect(
                        converter.targetAmountAndFee(getReserve1Address(isETHReserve), reserveToken2.address, amount)
                    ).to.be.revertedWith('ERR_INACTIVE');
                });

                it('should revert when attempting to convert with 0 minimum requested amount', async () => {
                    await initConverter(type, true, true, isETHReserve);

                    const amount = BigNumber.from(500);
                    let value = 0;
                    if (isETHReserve) {
                        value = amount;
                    } else {
                        await reserveToken.connect(sender).approve(bancorNetwork.address, amount);
                    }

                    await expect(
                        convert([getReserve1Address(isETHReserve), anchorAddress, reserveToken2.address], amount, 0, {
                            value: value
                        })
                    ).to.be.revertedWith('ERR_ZERO_VALUE');
                });

                it('should revert when attempting to convert when the return is smaller than the minimum requested amount', async () => {
                    await initConverter(type, true, true, isETHReserve);

                    const amount = BigNumber.from(500);
                    let value = 0;
                    if (isETHReserve) {
                        value = amount;
                    } else {
                        await reserveToken.connect(sender).approve(bancorNetwork.address, amount);
                    }

                    await expect(
                        convert(
                            [getReserve1Address(isETHReserve), anchorAddress, reserveToken2.address],
                            amount,
                            2000,
                            { value }
                        )
                    ).to.be.revertedWith('ERR_RETURN_TOO_LOW');
                });

                it('verifies that convert is allowed for a whitelisted account', async () => {
                    const converter = await initConverter(type, true, true, isETHReserve);

                    const whitelist = await (await Whitelist).deploy();
                    await whitelist.addAddress(converter.address);
                    await whitelist.addAddress(whitelisted.address);
                    await converter.setConversionWhitelist(whitelist.address);

                    const amount = BigNumber.from(500);
                    let value = 0;
                    if (isETHReserve) {
                        value = amount;
                    } else {
                        await reserveToken.transfer(whitelisted.address, amount.mul(BigNumber.from(2)));
                        await reserveToken.connect(whitelisted).approve(bancorNetwork.address, amount);
                    }

                    await convert(
                        [getReserve1Address(isETHReserve), anchorAddress, reserveToken2.address],
                        amount,
                        MIN_RETURN,
                        { value: value },
                        whitelisted
                    );
                });

                it('should revert when calling convert from a non whitelisted account', async () => {
                    const converter = await initConverter(type, true, true, isETHReserve);

                    const whitelist = await (await Whitelist).deploy();
                    await whitelist.addAddress(converter.address);
                    await converter.setConversionWhitelist(whitelist.address);

                    const amount = BigNumber.from(500);
                    let value = 0;
                    if (isETHReserve) {
                        value = amount;
                    } else {
                        await reserveToken.transfer(whitelisted.address, amount.mul(BigNumber.from(2)));
                        await reserveToken.connect(whitelisted).approve(bancorNetwork.address, amount);
                    }

                    await expect(
                        convert(
                            [getReserve1Address(isETHReserve), anchorAddress, reserveToken2.address],
                            amount,
                            MIN_RETURN,
                            { value: value },
                            whitelisted
                        )
                    ).to.be.revertedWith('ERR_NOT_WHITELISTED');
                });

                it('should revert when calling convert while the beneficiary is not whitelisted', async () => {
                    const converter = await initConverter(type, true, true, isETHReserve);
                    const whitelist = await (await Whitelist).deploy();
                    await whitelist.addAddress(whitelisted.address);
                    await converter.setConversionWhitelist(whitelist.address);

                    const amount = BigNumber.from(500);
                    let value = 0;
                    if (isETHReserve) {
                        value = amount;
                    } else {
                        await reserveToken.transfer(whitelisted.address, amount.mul(BigNumber.from(2)));
                        await reserveToken.connect(whitelisted).approve(bancorNetwork.address, amount);
                    }

                    await expect(
                        bancorNetwork
                            .connect(whitelisted)
                            .convertByPath2(
                                [getReserve1Address(isETHReserve), anchorAddress, reserveToken2.address],
                                amount,
                                MIN_RETURN,
                                beneficiary.address,
                                { value: value }
                            )
                    ).to.be.revertedWith('ERR_NOT_WHITELISTED');
                });

                it('verifies that targetAmountAndFee returns the same amount as converting', async () => {
                    const converter = await initConverter(type, true, true, isETHReserve);

                    const amount = BigNumber.from(500);
                    const returnAmount = (
                        await converter.targetAmountAndFee(
                            getReserve1Address(isETHReserve),
                            reserveToken2.address,
                            amount
                        )
                    )[0];

                    let value = 0;
                    if (isETHReserve) {
                        value = amount;
                    } else {
                        await reserveToken.connect(sender).approve(bancorNetwork.address, amount);
                    }

                    const returnAmount2 = await convertCall(
                        [getReserve1Address(isETHReserve), anchorAddress, reserveToken2.address],
                        amount,
                        MIN_RETURN,
                        { value: value }
                    );

                    expect(returnAmount2).to.be.equal(returnAmount);
                });
            });
        }
    }
});
