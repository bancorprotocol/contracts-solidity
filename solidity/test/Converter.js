const { expect } = require('chai');
const { expectRevert, expectEvent, constants, BN, balance } = require('@openzeppelin/test-helpers');

const { ETH_RESERVE_ADDRESS, registry } = require('./helpers/Constants');
const { ZERO_ADDRESS } = constants;

const BancorNetwork = artifacts.require('BancorNetwork');
const LiquidTokenConverter = artifacts.require('LiquidTokenConverter');
const LiquidityPoolV1Converter = artifacts.require('LiquidityPoolV1Converter');
const LiquidTokenConverterFactory = artifacts.require('LiquidTokenConverterFactory');
const LiquidityPoolV1ConverterFactory = artifacts.require('LiquidityPoolV1ConverterFactory');
const SmartToken = artifacts.require('SmartToken');
const BancorFormula = artifacts.require('BancorFormula');
const ContractRegistry = artifacts.require('ContractRegistry');
const ERC20Token = artifacts.require('ERC20Token');
const TestNonStandardToken = artifacts.require('TestNonStandardToken');
const ConverterFactory = artifacts.require('ConverterFactory');
const ConverterUpgrader = artifacts.require('ConverterUpgrader');

contract('Converter', accounts => {
    const createConverter = async (type, anchorAddress, registryAddress = contractRegistry.address, maxConversionFee = 0) => {
        if (type === 0) {
            return LiquidTokenConverter.new(anchorAddress, registryAddress, maxConversionFee);
        }

        if (type === 1) {
            return LiquidityPoolV1Converter.new(anchorAddress, registryAddress, maxConversionFee);
        }
    };

    const initConverter = async (type, accounts, activate, isETHReserve, maxConversionFee = 0) => {
        const converter = await createConverter(type, anchorAddress, contractRegistry.address, maxConversionFee);
        if (type === 0) {
            await converter.addReserve(getReserve1Address(isETHReserve), 250000);
        } else if (type === 1) {
            await converter.addReserve(getReserve1Address(isETHReserve), 250000);
            await converter.addReserve(reserveToken2.address, 150000);
            await reserveToken2.transfer(converter.address, 8000);
        }

        await anchor.issue(owner, 20000);
        if (isETHReserve) {
            await converter.send(5000);
        } else {
            await reserveToken.transfer(converter.address, 5000);
        }

        if (activate) {
            await anchor.transferOwnership(converter.address);
            await converter.acceptTokenOwnership();
        }

        return converter;
    };

    const getReserve1Address = (isETH) => {
        return isETH ? ETH_RESERVE_ADDRESS : reserveToken.address;
    };

    const getBalance = async (token, address, account) => {
        if (address === ETH_RESERVE_ADDRESS) {
            return balance.current(account);
        }

        return token.balanceOf.call(account);
    };

    const convert = async (path, amount, minReturn, options) => {
        return bancorNetwork.convertByPath.call(path, amount, minReturn, ZERO_ADDRESS, ZERO_ADDRESS, 0, options);
    };

    let bancorNetwork;
    let bancorFormula;
    let factory;
    let anchor;
    let anchorAddress;
    let contractRegistry;
    let reserveToken;
    let reserveToken2;
    let upgrader;
    const owner = accounts[0];
    const nonOwner = accounts[1];
    const receiver = accounts[3];

    const WEIGHT_10_PERCENT = new BN(100000);
    const MAX_CONVERSION_FEE = new BN(200000);

    beforeEach(async () => {
        contractRegistry = await ContractRegistry.new();

        bancorFormula = await BancorFormula.new();
        await contractRegistry.registerAddress(registry.BANCOR_FORMULA, bancorFormula.address);

        bancorNetwork = await BancorNetwork.new(contractRegistry.address);
        await contractRegistry.registerAddress(registry.BANCOR_NETWORK, bancorNetwork.address);

        factory = await ConverterFactory.new();
        await contractRegistry.registerAddress(registry.CONVERTER_FACTORY, factory.address);

        await factory.registerTypedConverterFactory((await LiquidTokenConverterFactory.new()).address);
        await factory.registerTypedConverterFactory((await LiquidityPoolV1ConverterFactory.new()).address);

        upgrader = await ConverterUpgrader.new(contractRegistry.address, ZERO_ADDRESS);
        await contractRegistry.registerAddress(registry.CONVERTER_UPGRADER, upgrader.address);

        anchor = await SmartToken.new('Token1', 'TKN1', 2);
        anchorAddress = anchor.address;

        reserveToken = await ERC20Token.new('ERC Token 1', 'ERC1', 0, 1000000000);
        reserveToken2 = await TestNonStandardToken.new('ERC Token 2', 'ERC2', 0, 2000000000);
    });

    for (let type = 0; type < 2; type++) {
        it('verifies that converterType returns the correct type', async () => {
            const converter = await initConverter(type, accounts, true, true);
            const converterType = await converter.converterType.call();
            expect(converterType).to.be.bignumber.equal(new BN(type));
        });

        it('verifies that sending ether to the converter succeeds if it has ETH reserve', async () => {
            const converter = await initConverter(type, accounts, true, true);
            await converter.send(100);
        });

        it('should revert when sending ether to the converter fails if it has no ETH reserve', async () => {
            const converter = await initConverter(type, accounts, true, false);
            await expectRevert(converter.send(100), 'ERR_INVALID_RESERVE');
        });

        for (let isETHReserve = 0; isETHReserve < 2; isETHReserve++) {
            describe(`${type === 0 ? 'LiquidTokenConverter' : 'LiquidityPoolV1Converter'}${isETHReserve === 0 ? '' : ' (with ETH reserve)'}:`, () => {
                it('verifies the converter data after construction', async () => {
                    const converter = await initConverter(type, accounts, false, isETHReserve);
                    const anchor = await converter.anchor.call();
                    expect(anchor).to.eql(anchorAddress);

                    const registry = await converter.registry.call();
                    expect(registry).to.eql(contractRegistry.address);

                    const maxConversionFee = await converter.maxConversionFee.call();
                    expect(maxConversionFee).to.be.bignumber.equal(new BN(0));
                });

                it('should revert when attempting to construct a converter with no anchor', async () => {
                    await expectRevert(createConverter(type, ZERO_ADDRESS), 'ERR_INVALID_ADDRESS');
                });

                it('should revert when attempting to construct a converter with no contract registry', async () => {
                    await expectRevert(createConverter(type, anchorAddress, ZERO_ADDRESS), 'ERR_INVALID_ADDRESS');
                });

                it('should revert when attempting to construct a converter with invalid conversion fee', async () => {
                    await expectRevert(createConverter(type, anchorAddress, contractRegistry.address, 1000001),
                        'ERR_INVALID_CONVERSION_FEE');
                });

                it('verifies that the owner can withdraw other tokens from the anchor', async () => {
                    const converter = await initConverter(type, accounts, true, isETHReserve);
                    const ercToken = await ERC20Token.new('ERC Token 1', 'ERC1', 0, 100000);

                    const prevBalance = await ercToken.balanceOf.call(owner);

                    const value = new BN(100);
                    await ercToken.transfer(anchorAddress, value);

                    let balance = await ercToken.balanceOf.call(owner);
                    expect(balance).to.be.bignumber.equal(prevBalance.sub(value));

                    await converter.withdrawFromAnchor(ercToken.address, owner, value);

                    balance = await ercToken.balanceOf.call(owner);
                    expect(balance).to.be.bignumber.equal(prevBalance);
                });

                it('should revert when the owner attempts to withdraw other tokens from the anchor while the converter is not active', async () => {
                    const converter = await initConverter(type, accounts, false, isETHReserve);
                    const ercToken = await ERC20Token.new('ERC Token 1', 'ERC1', 0, 100000);

                    const value = new BN(222);
                    await ercToken.transfer(anchor.address, value);

                    await expectRevert(converter.withdrawFromAnchor(ercToken.address, owner, value),
                        'ERR_ACCESS_DENIED');
                });

                it('should revert when a non owner attempts to withdraw other tokens from the anchor', async () => {
                    const converter = await initConverter(type, accounts, true, isETHReserve);
                    const ercToken = await ERC20Token.new('ERC Token 1', 'ERC1', 0, 100000);

                    const value = new BN(11);
                    await ercToken.transfer(anchor.address, value);

                    await expectRevert(converter.withdrawFromAnchor(ercToken.address, owner, value, { from: nonOwner }),
                        'ERR_ACCESS_DENIED');
                });

                it('verifies the owner can update the conversion whitelist contract address', async () => {
                    const converter = await createConverter(type, anchorAddress);
                    const prevWhitelist = await converter.conversionWhitelist.call();

                    await converter.setConversionWhitelist(receiver);

                    const newWhitelist = await converter.conversionWhitelist.call();
                    expect(prevWhitelist).not.to.eql(newWhitelist);
                });

                it('should revert when a non owner attempts update the conversion whitelist contract address', async () => {
                    const converter = await createConverter(type, anchorAddress);

                    await expectRevert(converter.setConversionWhitelist(receiver, { from: nonOwner }),
                        'ERR_ACCESS_DENIED');
                });

                it('verifies the owner can remove the conversion whitelist contract address', async () => {
                    const converter = await createConverter(type, anchorAddress);
                    await converter.setConversionWhitelist(receiver);

                    let whitelist = await converter.conversionWhitelist.call();
                    expect(whitelist).to.eql(receiver);

                    await converter.setConversionWhitelist(ZERO_ADDRESS);
                    whitelist = await converter.conversionWhitelist.call();

                    expect(whitelist).to.eql(ZERO_ADDRESS);
                });

                it('should revert when the owner attempts update the conversion whitelist contract address with the converter address', async () => {
                    const converter = await createConverter(type, anchorAddress);

                    await expectRevert(converter.setConversionWhitelist(converter.address), 'ERR_ADDRESS_IS_SELF');
                });

                it('verifies the owner can update the fee', async () => {
                    const converter = await createConverter(type, anchorAddress, contractRegistry.address,
                        MAX_CONVERSION_FEE);

                    const newFee = MAX_CONVERSION_FEE.sub(new BN(10));
                    await converter.setConversionFee(newFee);

                    const conversionFee = await converter.conversionFee.call();
                    expect(conversionFee).to.be.bignumber.equal(newFee);
                });

                it('should revert when attempting to update the fee to an invalid value', async () => {
                    const converter = await createConverter(type, anchorAddress, contractRegistry.address,
                        MAX_CONVERSION_FEE);

                    await expectRevert(converter.setConversionFee(MAX_CONVERSION_FEE.add(new BN(1))),
                        'ERR_INVALID_CONVERSION_FEE');
                });

                it('should revert when a non owner attempts to update the fee', async () => {
                    const converter = await createConverter(type, anchorAddress, contractRegistry.address,
                        MAX_CONVERSION_FEE);

                    const newFee = new BN(30000);
                    await expectRevert(converter.setConversionFee(newFee, { from: nonOwner }), 'ERR_ACCESS_DENIED');
                });

                it('verifies that an event is fired when the owner updates the fee', async () => {
                    const converter = await createConverter(type, anchorAddress, contractRegistry.address,
                        MAX_CONVERSION_FEE);

                    const newFee = new BN(30000);

                    const res = await converter.setConversionFee(newFee);
                    expectEvent(res, 'ConversionFeeUpdate', { _prevFee: new BN(0), _newFee: newFee });
                });

                it('verifies that an event is fired when the owner updates the fee multiple times', async () => {
                    const converter = await createConverter(type, anchorAddress, contractRegistry.address,
                        MAX_CONVERSION_FEE);

                    let prevFee = new BN(0);
                    for (let i = 1; i <= 10; ++i) {
                        const newFee = new BN(10000 * i);

                        const res = await converter.setConversionFee(newFee);
                        expectEvent(res, 'ConversionFeeUpdate', { _prevFee: prevFee, _newFee: newFee });

                        prevFee = newFee;
                    }
                });

                it('should revert when a non owner attempts to add a reserve', async () => {
                    const converter = await createConverter(type, anchorAddress);

                    await expectRevert(converter.addReserve(getReserve1Address(isETHReserve), WEIGHT_10_PERCENT,
                        { from: nonOwner }), 'ERR_ACCESS_DENIED');
                });

                it('should revert when attempting to add a reserve with invalid address', async () => {
                    const converter = await createConverter(type, anchorAddress);

                    await expectRevert(converter.addReserve(ZERO_ADDRESS, WEIGHT_10_PERCENT), 'ERR_INVALID_ADDRESS');
                });

                it('should revert when attempting to add a reserve with weight = 0', async () => {
                    const converter = await createConverter(type, anchorAddress);

                    await expectRevert(converter.addReserve(getReserve1Address(isETHReserve), 0),
                        'ERR_INVALID_RESERVE_WEIGHT');
                });

                it('should revert when attempting to add a reserve with weight greater than 100%', async () => {
                    const converter = await createConverter(type, anchorAddress);

                    await expectRevert(converter.addReserve(getReserve1Address(isETHReserve), 1000001),
                        'ERR_INVALID_RESERVE_WEIGHT');
                });

                it('should revert when attempting to add the anchor as a reserve', async () => {
                    const converter = await createConverter(type, anchorAddress);

                    await expectRevert(converter.addReserve(anchorAddress, WEIGHT_10_PERCENT), 'ERR_INVALID_RESERVE');
                });

                it('should revert when attempting to add the converter as a reserve', async () => {
                    const converter = await createConverter(type, anchorAddress);

                    await expectRevert(converter.addReserve(converter.address, WEIGHT_10_PERCENT),
                        'ERR_ADDRESS_IS_SELF');
                });

                it('verifies that the correct reserve weight is returned', async () => {
                    const converter = await createConverter(type, anchorAddress);
                    await converter.addReserve(getReserve1Address(isETHReserve), WEIGHT_10_PERCENT);

                    const reserveWeight = await converter.reserveWeight.call(getReserve1Address(isETHReserve));
                    expect(reserveWeight).to.be.bignumber.equal(WEIGHT_10_PERCENT);
                });

                it('should revert when attempting to retrieve the balance for a reserve that does not exist', async () => {
                    const converter = await createConverter(type, anchorAddress);
                    await converter.addReserve(getReserve1Address(isETHReserve), WEIGHT_10_PERCENT);

                    await expectRevert(converter.reserveBalance.call(reserveToken2.address), 'ERR_INVALID_RESERVE');
                });

                it('verifies that the converter can accept the anchor ownership', async () => {
                    const converter = await initConverter(type, accounts, false, isETHReserve);
                    await anchor.transferOwnership(converter.address);
                    await converter.acceptAnchorOwnership();

                    expect(await anchor.owner.call()).to.eql(converter.address);
                });

                it('verifies that the owner can transfer the anchor ownership if the owner is the upgrader contract', async () => {
                    const converter = await initConverter(type, accounts, true, isETHReserve);

                    await contractRegistry.registerAddress(registry.CONVERTER_UPGRADER, owner);

                    await converter.transferAnchorOwnership(nonOwner);

                    await contractRegistry.registerAddress(registry.CONVERTER_UPGRADER, upgrader.address);
                    const anchorAddress = await converter.anchor.call();
                    const token = await SmartToken.at(anchorAddress);
                    const newOwner = await token.newOwner.call();
                    expect(newOwner).to.eql(nonOwner);
                });

                it('should revert when the owner attempts to transfer the anchor ownership', async () => {
                    const converter = await initConverter(type, accounts, true, isETHReserve);

                    await expectRevert(converter.transferAnchorOwnership(nonOwner), 'ERR_ACCESS_DENIED');
                });

                it('should revert when a non owner attempts to transfer the anchor ownership', async () => {
                    const converter = await initConverter(type, accounts, true, isETHReserve);

                    await expectRevert(converter.transferAnchorOwnership(nonOwner, { from: nonOwner }),
                        'ERR_ACCESS_DENIED');
                });

                // eslint-disable-next-line max-len
                it('should revert when a the upgrader contract attempts to transfer the anchor ownership while the upgrader is not the owner', async () => {
                    const converter = await initConverter(type, accounts, true, isETHReserve);
                    await contractRegistry.registerAddress(registry.CONVERTER_UPGRADER, nonOwner);

                    await expectRevert(converter.transferAnchorOwnership(nonOwner, { from: nonOwner }),
                        'ERR_ACCESS_DENIED');
                });

                it('verifies that isActive returns true when the converter is active', async () => {
                    const converter = await initConverter(type, accounts, true, isETHReserve);
                    const isActive = await converter.isActive.call();
                    expect(isActive).to.be.true();
                });

                it('verifies that isActive returns false when the converter is inactive', async () => {
                    const converter = await initConverter(type, accounts, false, isETHReserve);
                    const isActive = await converter.isActive.call();
                    expect(isActive).to.be.false();
                });

                it('verifies that the owner can withdraw a non reserve token from the converter while the converter is not active', async () => {
                    const converter = await initConverter(type, accounts, false, isETHReserve);

                    const token = await ERC20Token.new('ERC Token 3', 'ERC3', 0, 100000);

                    const value = new BN(1000);
                    await token.transfer(converter.address, value);

                    let converterBalance = await token.balanceOf.call(converter.address);
                    expect(converterBalance).to.be.bignumber.equal(value);

                    const value2 = new BN(10);
                    await converter.withdrawTokens(token.address, receiver, value2);

                    converterBalance = await token.balanceOf.call(converter.address);
                    expect(converterBalance).to.be.bignumber.equal(value.sub(value2));

                    const receivedBalance = await token.balanceOf.call(receiver);
                    expect(receivedBalance).to.be.bignumber.equal(value2);
                });

                it('verifies that the owner can withdraw a reserve token from the converter while the converter is not active', async () => {
                    const converter = await initConverter(type, accounts, false, isETHReserve);

                    const prevBalance = await getBalance(reserveToken, getReserve1Address(isETHReserve), receiver);
                    const converterBalance = await getBalance(reserveToken, getReserve1Address(isETHReserve), converter.address);
                    if (isETHReserve) {
                        await converter.withdrawETH(receiver);
                    } else {
                        await converter.withdrawTokens(getReserve1Address(isETHReserve), receiver, converterBalance);
                    }

                    const balance = await getBalance(reserveToken, getReserve1Address(isETHReserve), receiver);
                    expect(balance).to.be.bignumber.equal(prevBalance.add(converterBalance));
                });

                it('verifies that the owner can withdraw a non reserve token from the converter while the converter is active', async () => {
                    const converter = await initConverter(type, accounts, true, isETHReserve);

                    const token = await ERC20Token.new('ERC Token 3', 'ERC3', 0, 100000);
                    const value = new BN(1000);
                    await token.transfer(converter.address, value);

                    const prevBalance = await token.balanceOf.call(receiver);
                    const value2 = new BN(1);
                    await converter.withdrawTokens(token.address, receiver, value2);

                    const balance = await token.balanceOf.call(receiver);
                    expect(balance).to.be.bignumber.equal(prevBalance.add(value2));
                });

                it('should revert when the owner attempts to withdraw a reserve token while the converter is active', async () => {
                    const converter = await initConverter(type, accounts, true, isETHReserve);

                    const value = new BN(1);
                    if (isETHReserve) {
                        await expectRevert(converter.withdrawETH(receiver), 'ERR_ACCESS_DENIED');
                    } else {
                        await expectRevert(converter.withdrawTokens(getReserve1Address(isETHReserve), receiver, value),
                            'ERR_ACCESS_DENIED');
                    }
                });

                it('should revert when a non owner attempts to withdraw a non reserve token while the converter is not active', async () => {
                    const converter = await initConverter(type, accounts, false, isETHReserve);

                    const token = await ERC20Token.new('ERC Token 3', 'ERC3', 0, 100000);

                    const value = new BN(255);
                    await token.transfer(converter.address, value);

                    const balance = await token.balanceOf.call(converter.address);
                    expect(balance).to.be.bignumber.equal(value);

                    const value2 = new BN(5);
                    await expectRevert(converter.withdrawTokens(token.address, receiver, value2, { from: nonOwner }),
                        'ERR_ACCESS_DENIED.');
                });

                it('should revert when a non owner attempts to withdraw a reserve token while the converter is not active', async () => {
                    const converter = await initConverter(type, accounts, false, isETHReserve);

                    if (isETHReserve) {
                        await expectRevert(converter.withdrawETH(receiver, { from: nonOwner }), 'ERR_ACCESS_DENIED');
                    } else {
                        await expectRevert(converter.withdrawTokens(getReserve1Address(isETHReserve), receiver, 50,
                            { from: nonOwner }), 'ERR_ACCESS_DENIED');
                    }
                });

                it('should revert when a non owner attempts to withdraw a reserve token while the converter is active', async () => {
                    const converter = await initConverter(type, accounts, true, isETHReserve);

                    if (isETHReserve) {
                        await expectRevert(converter.withdrawETH(receiver, { from: nonOwner }), 'ERR_ACCESS_DENIED');
                    } else {
                        await expectRevert(converter.withdrawTokens(getReserve1Address(isETHReserve), receiver, 50,
                            { from: nonOwner }), 'ERR_ACCESS_DENIED');
                    }
                });

                it('verifies that the owner can upgrade the converter while the converter is active', async () => {
                    const converter = await initConverter(type, accounts, true, isETHReserve);
                    await converter.upgrade();
                });

                it('verifies that the owner can upgrade the converter while the converter is not active', async () => {
                    const converter = await initConverter(type, accounts, false, isETHReserve);
                    await converter.upgrade();
                });

                it('verifies that the owner can upgrade the converter while the converter using the legacy upgrade function', async () => {
                    const converter = await initConverter(type, accounts, true, isETHReserve);
                    await converter.transferOwnership(upgrader.address);
                    await upgrader.upgradeOld(converter.address, web3.utils.utf8ToHex('0.9'));
                });

                it('should revert when a non owner attempts to upgrade the converter', async () => {
                    const converter = await initConverter(type, accounts, true, isETHReserve);

                    await expectRevert(converter.upgrade({ from: nonOwner }), 'ERR_ACCESS_DENIED');
                });

                it('should revert when attempting to get the target amount with an invalid source token adress', async () => {
                    const converter = await initConverter(type, accounts, true, isETHReserve);

                    await expectRevert(converter.targetAmountAndFee.call(ZERO_ADDRESS,
                        getReserve1Address(isETHReserve), 500), type === 0 ? 'ERR_INVALID_TOKEN' : 'ERR_INVALID_RESERVE');
                });

                it('should revert when attempting to get the target amount with an invalid target token address', async () => {
                    const converter = await initConverter(type, accounts, true, isETHReserve);

                    await expectRevert(converter.targetAmountAndFee.call(getReserve1Address(isETHReserve),
                        ZERO_ADDRESS, 500), type === 0 ? 'ERR_INVALID_TOKEN' : 'ERR_INVALID_RESERVE');
                });

                it('should revert when attempting to get the target amount with identical source/target addresses', async () => {
                    const converter = await initConverter(type, accounts, true, isETHReserve);

                    await expectRevert(converter.targetAmountAndFee.call(getReserve1Address(isETHReserve),
                        getReserve1Address(isETHReserve), 500), type === 0 ? 'ERR_INVALID_TOKEN' : 'ERR_SAME_SOURCE_TARGET');
                });

                it('should revert when attempting to convert with an invalid source token address', async () => {
                    await initConverter(type, accounts, true, isETHReserve);
                    await expectRevert(convert([ZERO_ADDRESS, anchorAddress, getReserve1Address(isETHReserve)], 500, 1),
                        type === 0 ? 'ERR_INVALID_TOKEN' : 'ERR_INVALID_RESERVE');
                });

                it('should revert when attempting to convert with an invalid target token address', async () => {
                    await initConverter(type, accounts, true, isETHReserve);
                    await reserveToken.approve(bancorNetwork.address, 500, { from: owner });

                    if (isETHReserve) {
                        await expectRevert.unspecified(convert([getReserve1Address(isETHReserve), anchorAddress,
                            ZERO_ADDRESS], 500, 1));
                    } else {
                        await expectRevert(convert([getReserve1Address(isETHReserve), anchorAddress,
                            ZERO_ADDRESS], 500, 1), type === 0 ? 'ERR_INVALID_TOKEN' : 'ERR_INVALID_RESERVE');
                    }
                });

                it('should revert when attempting to convert with identical source/target addresses', async () => {
                    await initConverter(type, accounts, true, isETHReserve);
                    await reserveToken.approve(bancorNetwork.address, 500, { from: owner });

                    if (isETHReserve) {
                        await expectRevert.unspecified(convert([getReserve1Address(isETHReserve), anchorAddress,
                            getReserve1Address(isETHReserve)], 500, 1));
                    } else {
                        await expectRevert(convert([getReserve1Address(isETHReserve), anchorAddress,
                            getReserve1Address(isETHReserve)], 500, 1), 'ERR_SAME_SOURCE_TARGET');
                    }
                });
            });
        };
    };
});
