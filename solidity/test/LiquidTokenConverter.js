const { expect } = require('chai');
const { expectRevert, expectEvent, constants, BN, balance } = require('@openzeppelin/test-helpers');

const { ETH_RESERVE_ADDRESS, registry } = require('./helpers/Constants');
const { ZERO_ADDRESS } = constants;

const BancorNetwork = artifacts.require('BancorNetwork');
const LiquidTokenConverter = artifacts.require('LiquidTokenConverter');
const LiquidTokenConverterFactory = artifacts.require('LiquidTokenConverterFactory');
const SmartToken = artifacts.require('SmartToken');
const BancorFormula = artifacts.require('BancorFormula');
const ContractRegistry = artifacts.require('ContractRegistry');
const ERC20Token = artifacts.require('ERC20Token');
const ConverterFactory = artifacts.require('ConverterFactory');
const ConverterUpgrader = artifacts.require('ConverterUpgrader');
const Whitelist = artifacts.require('Whitelist');

contract('LiquidTokenConverter', accounts => {
    const createConverter = async (tokenAddress, registryAddress = contractRegistry.address, maxConversionFee = 0) => {
        return LiquidTokenConverter.new(tokenAddress, registryAddress, maxConversionFee);
    };

    const initConverter = async (activate, isETHReserve, maxConversionFee = 0) => {
        token = await SmartToken.new('Token1', 'TKN1', 2);
        tokenAddress = token.address;

        const converter = await createConverter(tokenAddress, contractRegistry.address, maxConversionFee);
        await converter.addReserve(getReserve1Address(isETHReserve), 250000);
        await token.issue(sender, 20000);

        const amount = new BN(5000);
        if (isETHReserve) {
            await converter.send(amount);
        }
        else {
            await reserveToken.transfer(converter.address, amount);
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

    const getBalance = async (token, address, account) => {
        if (address === ETH_RESERVE_ADDRESS) {
            return balance.current(account);
        }

        return token.balanceOf.call(account);
    };

    const getTransactionCost = async (txResult) => {
        const transaction = await web3.eth.getTransaction(txResult.tx);
        return new BN(transaction.gasPrice).mul(new BN(txResult.receipt.cumulativeGasUsed));
    };

    const convert = async (path, amount, minReturn, options = {}) => {
        return bancorNetwork.convertByPath(path, amount, minReturn, ZERO_ADDRESS, ZERO_ADDRESS, 0,
            { from: sender, ...options });
    };

    const convertCall = async (path, amount, minReturn, options = {}) => {
        return bancorNetwork.convertByPath.call(path, amount, minReturn, ZERO_ADDRESS, ZERO_ADDRESS, 0,
            { from: sender, ...options });
    };

    let bancorNetwork;
    let token;
    let tokenAddress;
    let contractRegistry;
    let reserveToken;
    let erc20Token;
    let upgrader;
    const sender = accounts[0];
    const whitelisted = accounts[1];
    const beneficiary = accounts[2];

    const MIN_RETURN = new BN(1);
    const WEIGHT_10_PERCENT = new BN(100000);
    const WEIGHT_20_PERCENT = new BN(200000);
    const WEIGHT_100_PERCENT = new BN(1000000);

    before(async () => {
        // The following contracts are unaffected by the underlying tests, this can be shared.
        contractRegistry = await ContractRegistry.new();

        const bancorFormula = await BancorFormula.new();
        await bancorFormula.init();
        await contractRegistry.registerAddress(registry.BANCOR_FORMULA, bancorFormula.address);

        const factory = await ConverterFactory.new();
        await contractRegistry.registerAddress(registry.CONVERTER_FACTORY, factory.address);

        await factory.registerTypedConverterFactory((await LiquidTokenConverterFactory.new()).address);
    });

    beforeEach(async () => {
        bancorNetwork = await BancorNetwork.new(contractRegistry.address);
        await contractRegistry.registerAddress(registry.BANCOR_NETWORK, bancorNetwork.address);

        upgrader = await ConverterUpgrader.new(contractRegistry.address, ZERO_ADDRESS);
        await contractRegistry.registerAddress(registry.CONVERTER_UPGRADER, upgrader.address);

        const token = await SmartToken.new('Token1', 'TKN1', 2);
        tokenAddress = token.address;

        reserveToken = await ERC20Token.new('ERC Token 1', 'ERC1', 18, 1000000000);
        erc20Token = await ERC20Token.new('ERC Token 2', 'ERC2', 18, 1000000000);
    });

    it('verifies the Activation event after converter activation', async () => {
        const converter = await initConverter(false, false);
        await token.transferOwnership(converter.address);
        const res = await converter.acceptTokenOwnership();

        expectEvent(res, 'Activation', {
            _type: new BN(0),
            _anchor: tokenAddress,
            _activated: true
        });
    });

    // eslint-disable-next-line max-len
    it('should revert when attempting to buy without first approving the network to transfer from the buyer account in the reserve contract', async () => {
        await initConverter(true, false);

        const amount = new BN(500);
        await expectRevert.unspecified(convert([getReserve1Address(false), tokenAddress, tokenAddress], amount, MIN_RETURN));
    });

    for (let isETHReserve = 0; isETHReserve < 2; isETHReserve++) {
        describe(`${isETHReserve === 0 ? '(with ERC20 reserve)' : '(with ETH reserve)'}:`, () => {
            it('verifies the reserve token count and reserve ratio before / after adding a reserve', async () => {
                const converter = await createConverter(tokenAddress, contractRegistry.address, 0);

                let reserveTokenCount = await converter.reserveTokenCount.call();
                let reserveRatio = await converter.reserveRatio.call();
                expect(reserveTokenCount).to.be.bignumber.equal(new BN(0));
                expect(reserveRatio).to.be.bignumber.equal(new BN(0));

                await converter.addReserve(getReserve1Address(isETHReserve), WEIGHT_10_PERCENT);
                reserveTokenCount = await converter.reserveTokenCount.call();
                reserveRatio = await converter.reserveRatio.call();
                expect(reserveTokenCount).to.be.bignumber.equal(new BN(1));
                expect(reserveRatio).to.be.bignumber.equal(WEIGHT_10_PERCENT);
            });

            it('should revert when attempting to add 2nd reserve', async () => {
                const converter = await createConverter(tokenAddress, contractRegistry.address, 0);

                await converter.addReserve(getReserve1Address(isETHReserve), WEIGHT_10_PERCENT);

                const reserveToken2 = await ERC20Token.new('ERC Token 2', 'ERC2', 18, 1000000000);
                await expectRevert(converter.addReserve(reserveToken2.address, WEIGHT_20_PERCENT), 'ERR_INVALID_RESERVE_COUNT');
            });

            it('verifies that the converter can accept the token ownership when 1 reserve is defined', async () => {
                const converter = await initConverter(false, isETHReserve);

                await token.transferOwnership(converter.address);
                await converter.acceptTokenOwnership();
                expect(await token.owner.call()).to.eql(converter.address);
            });

            it('verifies that targetAmountAndFee returns a valid amount', async () => {
                const converter = await initConverter(true, isETHReserve);

                const amount = new BN(500);
                const returnAmount = (await converter.targetAmountAndFee.call(getReserve1Address(isETHReserve), tokenAddress, amount))[0];
                expect(returnAmount).to.be.bignumber.equal(new BN(482));
            });

            it('verifies that Conversion event is emitted after buying', async () => {
                const converter = await initConverter(true, isETHReserve, 5000);
                await converter.setConversionFee(3000);

                const amount = new BN(500);
                let value = 0;
                if (isETHReserve) {
                    value = amount;
                }
                else {
                    await reserveToken.approve(bancorNetwork.address, amount, { from: sender });
                }

                const purchaseAmount = (await converter.targetAmountAndFee.call(getReserve1Address(isETHReserve), tokenAddress, amount))[0];
                const res = await convert([getReserve1Address(isETHReserve), tokenAddress, tokenAddress], amount, MIN_RETURN, { value });

                expectEvent(res, 'Conversion', {
                    _smartToken: token.address,
                    _fromToken: getReserve1Address(isETHReserve),
                    _toToken: tokenAddress,
                    _fromAmount: amount,
                    _toAmount: purchaseAmount
                });
            });

            it('verifies that Conversion event is emitted after selling', async () => {
                const converter = await initConverter(true, isETHReserve, 5000);

                await converter.setConversionFee(3000);

                const amount = new BN(500);
                await token.approve(bancorNetwork.address, amount, { from: sender });

                const sellAmount = (await converter.targetAmountAndFee.call(tokenAddress, getReserve1Address(isETHReserve), amount))[0];
                const res = await convert([tokenAddress, tokenAddress, getReserve1Address(isETHReserve)], amount, MIN_RETURN);

                expectEvent(res, 'Conversion', {
                    _smartToken: token.address,
                    _fromToken: tokenAddress,
                    _toToken: getReserve1Address(isETHReserve),
                    _fromAmount: amount,
                    _toAmount: sellAmount
                });
            });

            it('should revert when attempting to get the purchase target amount while the converter is not active', async () => {
                const converter = await initConverter(false, isETHReserve);

                const amount = new BN(500);
                await expectRevert(converter.targetAmountAndFee.call(getReserve1Address(isETHReserve), tokenAddress, amount), 'ERR_INACTIVE');
            });

            it('should revert when attempting to get the sale target amount while the converter is not active', async () => {
                const converter = await initConverter(false, isETHReserve);

                const amount = new BN(500);
                await expectRevert(converter.targetAmountAndFee.call(tokenAddress, getReserve1Address(isETHReserve), amount), 'ERR_INACTIVE');
            });

            it('verifies that selling right after buying does not result in an amount greater than the original purchase amount', async () => {
                await initConverter(true, isETHReserve);

                const amount = new BN(500);
                let value = 0;
                if (isETHReserve) {
                    value = amount;
                }
                else {
                    await reserveToken.approve(bancorNetwork.address, amount, { from: sender });
                }

                const purchaseAmount = await convertCall([getReserve1Address(isETHReserve), tokenAddress, tokenAddress],
                    amount, MIN_RETURN, { value });
                await convert([getReserve1Address(isETHReserve), tokenAddress, tokenAddress], amount, MIN_RETURN, { value });

                await token.approve(bancorNetwork.address, amount, { from: sender });
                const saleAmount = await convertCall([tokenAddress, tokenAddress, getReserve1Address(isETHReserve)], purchaseAmount, MIN_RETURN);

                expect(saleAmount).to.be.bignumber.lte(amount);
            });

            it('verifies that buying right after selling does not result in an amount greater than the original sale amount', async () => {
                await initConverter(true, isETHReserve);

                const amount = new BN(500);
                await token.approve(bancorNetwork.address, amount, { from: sender });
                const saleAmount = await convertCall([tokenAddress, tokenAddress, getReserve1Address(isETHReserve)], amount, MIN_RETURN);
                await convert([tokenAddress, tokenAddress, getReserve1Address(isETHReserve)], amount, MIN_RETURN);

                let value = 0;
                if (isETHReserve) {
                    value = saleAmount;
                }
                else {
                    await reserveToken.approve(bancorNetwork.address, saleAmount, { from: sender });
                }

                const purchaseAmount = await convertCall([getReserve1Address(isETHReserve), tokenAddress, tokenAddress],
                    saleAmount, MIN_RETURN, { value });

                expect(purchaseAmount).to.be.bignumber.lte(amount);
            });

            it('verifies the TokenRateUpdate event after conversion', async () => {
                const converter = await initConverter(true, isETHReserve, 10000);

                const amount = new BN(500);
                await converter.setConversionFee(6000);
                let value = 0;
                if (isETHReserve) {
                    value = amount;
                }
                else {
                    await reserveToken.approve(bancorNetwork.address, amount, { from: sender });
                }

                const res = await convert([getReserve1Address(isETHReserve), tokenAddress, tokenAddress], amount,
                    MIN_RETURN, { value });

                const supply = await token.totalSupply.call();
                const reserveBalance = await converter.reserveBalance.call(getReserve1Address(isETHReserve));
                const reserveWeight = await converter.reserveWeight.call(getReserve1Address(isETHReserve));

                const events = await converter.getPastEvents('TokenRateUpdate', {
                    fromBlock: res.receipt.blockNumber,
                    toBlock: res.receipt.blockNumber
                });
                const { args: { _token1, _token2, _rateN, _rateD } } = events[0];
                expect(_token1).to.eql(tokenAddress);
                expect(_token2).to.eql(getReserve1Address(isETHReserve));
                expect(_rateN).to.be.bignumber.equal(reserveBalance.mul(WEIGHT_100_PERCENT));
                expect(_rateD).to.be.bignumber.equal(supply.mul(reserveWeight));
            });

            it('should revert when attempting to convert with 0 minimum requested amount', async () => {
                await initConverter(true, isETHReserve);

                const amount = new BN(500);
                let value = 0;
                if (isETHReserve) {
                    value = amount;
                }
                else {
                    await reserveToken.approve(bancorNetwork.address, amount, { from: sender });
                }

                await expectRevert(convert([getReserve1Address(isETHReserve), tokenAddress, tokenAddress], amount, 0,
                    { value }), 'ERR_ZERO_VALUE');
            });

            it('should revert when attempting to convert when the return is smaller than the minimum requested amount', async () => {
                await initConverter(true, isETHReserve);

                const amount = new BN(500);
                let value = 0;
                if (isETHReserve) {
                    value = amount;
                }
                else {
                    await reserveToken.approve(bancorNetwork.address, amount, { from: sender });
                }

                await expectRevert(convert([getReserve1Address(isETHReserve), tokenAddress, tokenAddress], amount, 2000,
                    { value }), 'ERR_RETURN_TOO_LOW');
            });

            it('verifies balances after buy', async () => {
                await initConverter(true, isETHReserve);

                const amount = new BN(500);
                let value = 0;
                if (isETHReserve) {
                    value = amount;
                }
                else {
                    await reserveToken.approve(bancorNetwork.address, amount, { from: sender });
                }

                const tokenPrevBalance = await token.balanceOf.call(sender);
                const reserveTokenPrevBalance = await getBalance(reserveToken, getReserve1Address(isETHReserve), sender);

                const purchaseAmount = await convertCall([getReserve1Address(isETHReserve), tokenAddress, tokenAddress],
                    amount, MIN_RETURN, { value });
                const res = await convert([getReserve1Address(isETHReserve), tokenAddress, tokenAddress], amount,
                    MIN_RETURN, { value });

                let transactionCost = new BN(0);
                if (isETHReserve) {
                    transactionCost = await getTransactionCost(res);
                }

                const reserveTokenNewBalance = await getBalance(reserveToken, getReserve1Address(isETHReserve), sender);
                expect(reserveTokenNewBalance).to.be.bignumber.equal(reserveTokenPrevBalance.sub(amount).sub(transactionCost));

                const tokenNewBalance = await token.balanceOf.call(sender);
                expect(tokenNewBalance).to.be.bignumber.equal(tokenPrevBalance.add(purchaseAmount));
            });

            it('should revert when attempting to buy while the converter is not active', async () => {
                await initConverter(false, isETHReserve);

                const amount = new BN(500);
                let value = 0;
                if (isETHReserve) {
                    value = amount;
                }
                else {
                    await reserveToken.approve(bancorNetwork.address, amount, { from: sender });
                }

                await expectRevert.unspecified(convert([getReserve1Address(isETHReserve), tokenAddress, tokenAddress], amount,
                    MIN_RETURN, { value }));
            });

            it('should revert when attempting to buy with a non reserve address', async () => {
                await initConverter(true, isETHReserve);

                const amount = new BN(500);
                let value = 0;
                if (isETHReserve) {
                    value = amount;
                }
                else {
                    await erc20Token.approve(bancorNetwork.address, amount, { from: sender });
                }

                await expectRevert(convert([erc20Token.address, tokenAddress, tokenAddress], amount, MIN_RETURN, { value }),
                    'ERR_INVALID_TOKEN');
            });

            it('should revert when attempting to buy while the purchase yields 0 return', async () => {
                await initConverter(true, isETHReserve);

                const amount = new BN(1);
                let value = 0;
                if (isETHReserve) {
                    value = amount;
                }
                else {
                    await reserveToken.approve(bancorNetwork.address, amount, { from: sender });
                }

                await expectRevert(convert([getReserve1Address(isETHReserve), tokenAddress, tokenAddress], amount,
                    MIN_RETURN, { value }), 'ERR_ZERO_TARGET_AMOUNT');
            });

            it('should revert when attempting to buy with 0 minimum requested amount', async () => {
                await initConverter(true, isETHReserve);

                const amount = new BN(500);
                let value = 0;
                if (isETHReserve) {
                    value = amount;
                }
                else {
                    await reserveToken.approve(bancorNetwork.address, amount, { from: sender });
                }

                await expectRevert(convert([getReserve1Address(isETHReserve), tokenAddress, tokenAddress], amount, 0,
                    { value }), 'ERR_ZERO_VALUE');
            });

            it('verifies balances after sell', async () => {
                await initConverter(true, isETHReserve);

                const amount = new BN(500);
                await token.approve(bancorNetwork.address, amount, { from: sender });

                const tokenPrevBalance = await token.balanceOf.call(sender);
                const reserveTokenPrevBalance = await getBalance(reserveToken, getReserve1Address(isETHReserve), sender);

                const saleAmount = await convertCall([tokenAddress, tokenAddress, getReserve1Address(isETHReserve)], amount, MIN_RETURN);
                const res = await convert([tokenAddress, tokenAddress, getReserve1Address(isETHReserve)], amount, MIN_RETURN);

                let transactionCost = new BN(0);
                if (isETHReserve) {
                    transactionCost = await getTransactionCost(res);
                }

                const reserveTokenNewBalance = await getBalance(reserveToken, getReserve1Address(isETHReserve), sender);
                expect(reserveTokenNewBalance).to.be.bignumber.equal(reserveTokenPrevBalance.add(saleAmount).sub(transactionCost));

                const tokenNewBalance = await token.balanceOf.call(sender);
                expect(tokenNewBalance).to.be.bignumber.equal(tokenPrevBalance.sub(amount));
            });

            it('should revert when attempting to sell while the converter is not active', async () => {
                await initConverter(false, isETHReserve);

                const amount = new BN(500);
                await token.approve(bancorNetwork.address, amount, { from: sender });

                await expectRevert.unspecified(convert([tokenAddress, tokenAddress, getReserve1Address(isETHReserve)], amount,
                    MIN_RETURN));
            });

            it('should revert when attempting to sell with a non reserve address', async () => {
                await initConverter(true, isETHReserve);

                const amount = new BN(500);
                await erc20Token.approve(bancorNetwork.address, amount, { from: sender });

                await expectRevert(convert([erc20Token.address, tokenAddress, tokenAddress], amount, MIN_RETURN),
                    'ERR_INVALID_TOKEN');
            });

            it('should revert when attempting to sell while the sale yields 0 return', async () => {
                await initConverter(true, isETHReserve);

                const amount = new BN(1);
                await token.approve(bancorNetwork.address, amount, { from: sender });

                await expectRevert(convert([tokenAddress, tokenAddress, getReserve1Address(isETHReserve)], amount, MIN_RETURN),
                    'ERR_ZERO_TARGET_AMOUNT');
            });

            it('should revert when attempting to sell with amount greater than the seller balance', async () => {
                await initConverter(true, isETHReserve);

                const amount = new BN(30000);
                await token.approve(bancorNetwork.address, amount, { from: sender });

                await expectRevert.unspecified(convert([tokenAddress, tokenAddress, getReserve1Address(isETHReserve)], amount, MIN_RETURN));
            });

            it('verifies that convert is allowed for a whitelisted account', async () => {
                const converter = await initConverter(true, isETHReserve);

                const whitelist = await Whitelist.new();
                await whitelist.addAddress(converter.address);
                await whitelist.addAddress(whitelisted);
                await converter.setConversionWhitelist(whitelist.address);

                const amount = new BN(500);
                let value = 0;
                if (isETHReserve) {
                    value = amount;
                }
                else {
                    await reserveToken.transfer(whitelisted, amount.mul(new BN(2)));
                    await reserveToken.approve(bancorNetwork.address, amount, { from: whitelisted });
                }

                await convert([getReserve1Address(isETHReserve), tokenAddress, tokenAddress], amount, MIN_RETURN,
                    { from: whitelisted, value });
            });

            it('should revert when calling convert from a non whitelisted account', async () => {
                const converter = await initConverter(true, isETHReserve);

                const whitelist = await Whitelist.new();
                await whitelist.addAddress(converter.address);
                await converter.setConversionWhitelist(whitelist.address);

                const amount = new BN(500);
                let value = 0;
                if (isETHReserve) {
                    value = amount;
                }
                else {
                    await reserveToken.transfer(whitelisted, amount.mul(new BN(2)));
                    await reserveToken.approve(bancorNetwork.address, amount, { from: whitelisted });
                }

                await expectRevert(convert([getReserve1Address(isETHReserve), tokenAddress, tokenAddress], amount, MIN_RETURN,
                    { from: whitelisted, value }), 'ERR_NOT_WHITELISTED');
            });

            it('verifies that convert is allowed for a whitelisted beneficiary', async () => {
                const converter = await initConverter(true, isETHReserve);

                const whitelist = await Whitelist.new();
                await whitelist.addAddress(converter.address);
                await whitelist.addAddress(whitelisted);
                await whitelist.addAddress(beneficiary);
                await converter.setConversionWhitelist(whitelist.address);

                const amount = new BN(500);
                let value = 0;
                if (isETHReserve) {
                    value = amount;
                }
                else {
                    await reserveToken.transfer(whitelisted, amount.mul(new BN(2)));
                    await reserveToken.approve(bancorNetwork.address, amount, { from: whitelisted });
                }

                await bancorNetwork.convertByPath([getReserve1Address(isETHReserve), tokenAddress, tokenAddress], amount, MIN_RETURN,
                    beneficiary, ZERO_ADDRESS, 0, { from: whitelisted, value });
            });

            it('should revert when calling convert while the beneficiary is not whitelisted', async () => {
                const converter = await initConverter(true, isETHReserve);
                const whitelist = await Whitelist.new();
                await whitelist.addAddress(whitelisted);
                await converter.setConversionWhitelist(whitelist.address);

                const amount = new BN(500);
                let value = 0;
                if (isETHReserve) {
                    value = amount;
                }
                else {
                    await reserveToken.transfer(whitelisted, amount.mul(new BN(2)));
                    await reserveToken.approve(bancorNetwork.address, amount, { from: whitelisted });
                }

                await expectRevert(bancorNetwork.convertByPath([getReserve1Address(isETHReserve), tokenAddress, tokenAddress], amount, MIN_RETURN,
                    beneficiary, ZERO_ADDRESS, 0, { from: whitelisted, value }), 'ERR_NOT_WHITELISTED');
            });

            it('verifies that targetAmountAndFee returns the same amount as converting', async () => {
                const converter = await initConverter(true, isETHReserve);

                const amount = new BN(500);
                const returnAmount = (await converter.targetAmountAndFee.call(getReserve1Address(isETHReserve), tokenAddress, amount))[0];

                let value = 0;
                if (isETHReserve) {
                    value = amount;
                }
                else {
                    await reserveToken.approve(bancorNetwork.address, amount, { from: sender });
                }

                const returnAmount2 = await convertCall([getReserve1Address(isETHReserve), tokenAddress, tokenAddress],
                    amount, MIN_RETURN, { value });

                expect(returnAmount2).to.be.bignumber.equal(returnAmount);
            });
        });
    };
});
