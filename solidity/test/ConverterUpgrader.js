const { expect } = require('chai');
const { expectRevert, constants, BN, time } = require('@openzeppelin/test-helpers');

const ConverterHelper = require('./helpers/Converter');

const { ETH_RESERVE_ADDRESS, registry } = require('./helpers/Constants');

const { latest } = time;
const { ZERO_ADDRESS } = constants;

const BancorFormula = artifacts.require('BancorFormula');
const EtherToken = artifacts.require('EtherToken');
const ERC20Token = artifacts.require('ERC20Token');
const ContractRegistry = artifacts.require('ContractRegistry');
const ConverterFactory = artifacts.require('ConverterFactory');
const ConverterUpgrader = artifacts.require('ConverterUpgrader');

const LiquidTokenConverterFactory = artifacts.require('LiquidTokenConverterFactory');
const LiquidityPoolV1ConverterFactory = artifacts.require('LiquidityPoolV1ConverterFactory');
const LiquidityPoolV2ConverterFactory = artifacts.require('LiquidityPoolV2ConverterFactory');
const LiquidityPoolV2ConverterAnchorFactory = artifacts.require('LiquidityPoolV2ConverterAnchorFactory');
const LiquidityPoolV2ConverterCustomFactory = artifacts.require('LiquidityPoolV2ConverterCustomFactory');
const LiquidityPoolV2Converter = artifacts.require('LiquidityPoolV2Converter');
const SmartToken = artifacts.require('SmartToken');
const PoolTokensContainer = artifacts.require('PoolTokensContainer');
const ChainlinkPriceOracle = artifacts.require('TestChainlinkPriceOracle');
const PriceOracle = artifacts.require('PriceOracle');
const Whitelist = artifacts.require('Whitelist');

const CONVERSION_FEE = new BN(1000);
const MAX_CONVERSION_FEE = new BN(30000);
const RESERVE1_BALANCE = new BN(5000);
const RESERVE2_BALANCE = new BN(8000);
const TOKEN_TOTAL_SUPPLY = new BN(20000);
const MIN_RETURN = new BN(1);

const VERSIONS = [9, 10, 11, 23];

contract('ConverterUpgrader', accounts => {
    const initWith1Reserve = async (deployer, version, activate) => {
        const smartToken = await SmartToken.new('Smart Token', 'TKN1', 0);
        const converter = await ConverterHelper.new(0, smartToken.address, contractRegistry.address, MAX_CONVERSION_FEE,
            reserveToken1.address, 500000, version);
        const upgrader = await ConverterUpgrader.new(contractRegistry.address, ZERO_ADDRESS);

        await contractRegistry.registerAddress(registry.CONVERTER_UPGRADER, upgrader.address);

        await converter.setConversionFee(CONVERSION_FEE);
        await smartToken.issue(deployer, TOKEN_TOTAL_SUPPLY);
        await reserveToken1.transfer(converter.address, RESERVE1_BALANCE);

        if (activate) {
            await smartToken.transferOwnership(converter.address);
            await converter.acceptTokenOwnership();
        }

        return [upgrader, converter];
    };

    const initWith2Reserves = async (deployer, version, activate) => {
        const smartToken = await SmartToken.new('Smart Token', 'TKN1', 0);
        const converter = await ConverterHelper.new(1, smartToken.address, contractRegistry.address, MAX_CONVERSION_FEE,
            reserveToken1.address, 500000, version);
        const upgrader = await ConverterUpgrader.new(contractRegistry.address, ZERO_ADDRESS);

        await contractRegistry.registerAddress(registry.CONVERTER_UPGRADER, upgrader.address);
        if (version) {
            await converter.addConnector(reserveToken2.address, 500000, false);
        } else {
            await converter.addReserve(reserveToken2.address, 500000);
        }

        await converter.setConversionFee(CONVERSION_FEE);
        await smartToken.issue(deployer, TOKEN_TOTAL_SUPPLY);
        await reserveToken1.transfer(converter.address, RESERVE1_BALANCE);
        await reserveToken2.transfer(converter.address, RESERVE2_BALANCE);

        if (activate) {
            await smartToken.transferOwnership(converter.address);
            await converter.acceptTokenOwnership();
        }

        return [upgrader, converter];
    };

    const initLPV2 = async (deployer, version, activate) => {
        const anchor = await PoolTokensContainer.new('Pool', 'POOL', 0);
        await anchor.createToken();
        await anchor.createToken();

        const upgrader = await ConverterUpgrader.new(contractRegistry.address, ZERO_ADDRESS);
        await contractRegistry.registerAddress(registry.CONVERTER_UPGRADER, upgrader.address);

        const converter = await ConverterHelper.new(2, anchor.address, contractRegistry.address, MAX_CONVERSION_FEE, reserveToken1.address, 500000);
        await converter.addReserve(reserveToken2.address, 500000);
        await converter.setConversionFee(CONVERSION_FEE);

        if (activate) {
            await anchor.transferOwnership(converter.address);
            await converter.acceptAnchorOwnership();
            await converter.activate(reserveToken1.address, chainlinkPriceOracleA.address, chainlinkPriceOracleB.address);

            await reserveToken1.approve(converter.address, RESERVE1_BALANCE);
            await reserveToken2.approve(converter.address, RESERVE2_BALANCE);
            await converter.addLiquidity(reserveToken1.address, RESERVE1_BALANCE, MIN_RETURN);
            await converter.addLiquidity(reserveToken2.address, RESERVE2_BALANCE, MIN_RETURN);
        }

        return [upgrader, converter];
    };

    const initWithoutReserves = async (deployer, version, activate) => {
        const smartToken = await SmartToken.new('Smart Token', 'TKN1', 0);
        const converter = await ConverterHelper.new(0, smartToken.address, contractRegistry.address, MAX_CONVERSION_FEE,
            ZERO_ADDRESS, 0, version);
        const upgrader = await ConverterUpgrader.new(contractRegistry.address, ZERO_ADDRESS);

        await contractRegistry.registerAddress(registry.CONVERTER_UPGRADER, upgrader.address);

        await converter.setConversionFee(CONVERSION_FEE);

        if (activate) {
            throw new Error('Converter with no reserves cannot be activated');
        }

        return [upgrader, converter];
    };

    const initWithEtherReserve = async (deployer, version, activate) => {
        const smartToken = await SmartToken.new('Smart Token', 'TKN1', 0);
        const converter = await ConverterHelper.new(1, smartToken.address, contractRegistry.address, MAX_CONVERSION_FEE,
            etherToken.address, 500000, version);
        const upgrader = await ConverterUpgrader.new(contractRegistry.address, etherToken.address);

        await contractRegistry.registerAddress(registry.CONVERTER_UPGRADER, upgrader.address);
        if (version) {
            await converter.addConnector(reserveToken2.address, 500000, false);
        } else {
            await converter.addReserve(reserveToken2.address, 500000);
        }

        await converter.setConversionFee(CONVERSION_FEE);
        await smartToken.issue(deployer, TOKEN_TOTAL_SUPPLY);
        await etherToken.deposit({ value: RESERVE1_BALANCE });
        await etherToken.transfer(converter.address, RESERVE1_BALANCE);
        await reserveToken2.transfer(converter.address, RESERVE2_BALANCE);

        if (activate) {
            await smartToken.transferOwnership(converter.address);
            await converter.acceptTokenOwnership();
        }

        return [upgrader, converter];
    };

    const initWithETHReserve = async (deployer, version, activate) => {
        if (version) {
            throw new Error(`Converter version ${version} does not support ETH-reserve`);
        }

        const smartToken = await SmartToken.new('Smart Token', 'TKN1', 0);
        const converter = await ConverterHelper.new(1, smartToken.address, contractRegistry.address, MAX_CONVERSION_FEE,
            reserveToken1.address, 500000);
        const upgrader = await ConverterUpgrader.new(contractRegistry.address, ZERO_ADDRESS);

        await contractRegistry.registerAddress(registry.CONVERTER_UPGRADER, upgrader.address);
        await converter.addReserve(ETH_RESERVE_ADDRESS, 500000);
        await converter.setConversionFee(CONVERSION_FEE);
        await smartToken.issue(deployer, TOKEN_TOTAL_SUPPLY);
        await reserveToken1.transfer(converter.address, RESERVE1_BALANCE);
        await converter.send(RESERVE2_BALANCE, { from: deployer });

        if (activate) {
            await smartToken.transferOwnership(converter.address);
            await converter.acceptTokenOwnership();
        }

        return [upgrader, converter];
    };

    const upgradeConverter = async (upgrader, converter, options = {}) => {
        let res;

        // For versions 11 or higher, we just call upgrade on the converter.
        if (converter.upgrade) {
            res = await converter.upgrade({ from: accounts[0], ...options });
        } else {
            // For previous versions we transfer ownership to the upgrader, then call upgradeOld on the upgrader,
            // then accept ownership of the new and old converter. The end results should be the same.
            await converter.transferOwnership(upgrader.address);
            res = await upgrader.upgradeOld(converter.address, web3.utils.asciiToHex(''),
                { from: accounts[0], ...options });
            await converter.acceptOwnership();
        }

        const logs = res.logs.filter(log => log.event === 'ConverterUpgrade');
        expect(logs.length).to.be.at.most(1);

        if (logs.length === 1) {
            return ConverterHelper.at(logs[0].args._newConverter);
        }

        const events = await upgrader.getPastEvents('ConverterUpgrade', {
            fromBlock: res.receipt.blockNumber,
            toBlock: res.receipt.blockNumber
        });

        return ConverterHelper.at(events[0].args._newConverter);
    };

    const getConverterState = async (converter) => {
        const token = await converter.token.call();
        const smartToken = await SmartToken.at(token);
        const state = {
            owner: await converter.owner.call(),
            token,
            tokenOwner: await smartToken.owner.call(),
            newOwner: await converter.newOwner.call(),
            conversionFee: await converter.conversionFee.call(),
            maxConversionFee: await converter.maxConversionFee.call(),
            reserveTokenCount: await converter.connectorTokenCount.call(),
            reserveTokens: []
        };

        for (let i = 0; i < state.reserveTokenCount.toNumber(); i++) {
            const token = await converter.connectorTokens.call(i);
            state.reserveTokens[i] = {
                token,
                balance: await converter.getConnectorBalance.call(token)
            };
        }
        // Fetch additional info for V2.
        const converterType = await converter.converterType.call();
        if (BN.isBN(converterType) && converterType.eq(new BN(2))) {
            const priceOracleAddres = await converter.priceOracle.call();
            if (priceOracleAddres === ZERO_ADDRESS) {
                state.tokenAOracle = ZERO_ADDRESS;
                state.tokenBOracle = ZERO_ADDRESS;
            } else {
                const priceOracle = await PriceOracle.at(priceOracleAddres);
                state.tokenAOracle = await priceOracle.tokenAOracle.call();
                state.tokenBOracle = await priceOracle.tokenBOracle.call();
            }

            for (let i = 0; i < state.reserveTokenCount.toNumber(); i++) {
                state.reserveTokens[i].stakedBalance = await converter.reserveStakedBalance.call(state.reserveTokens[i].token);
            }
        }

        return state;
    };

    const createChainlinkOracle = async (answer) => {
        const chainlinkOracle = await ChainlinkPriceOracle.new();
        await chainlinkOracle.setAnswer(answer);
        await chainlinkOracle.setTimestamp(await latest());

        return chainlinkOracle;
    };

    let contractRegistry;
    let converterFactory;
    let chainlinkPriceOracleA;
    let chainlinkPriceOracleB;
    const deployer = accounts[0];
    let reserveToken1;
    let reserveToken2;
    let etherToken;

    before(async () => {
        // The following contracts are unaffected by the underlying tests, this can be shared.
        contractRegistry = await ContractRegistry.new();

        const bancorFormula = await BancorFormula.new();
        await bancorFormula.init();
        await contractRegistry.registerAddress(registry.BANCOR_FORMULA, bancorFormula.address);

        converterFactory = await ConverterFactory.new();
        await contractRegistry.registerAddress(registry.CONVERTER_FACTORY, converterFactory.address);

        await converterFactory.registerTypedConverterFactory((await LiquidTokenConverterFactory.new()).address);
        await converterFactory.registerTypedConverterFactory((await LiquidityPoolV1ConverterFactory.new()).address);
        await converterFactory.registerTypedConverterFactory((await LiquidityPoolV2ConverterFactory.new()).address);

        await converterFactory.registerTypedConverterAnchorFactory((await LiquidityPoolV2ConverterAnchorFactory.new()).address);
        await converterFactory.registerTypedConverterCustomFactory((await LiquidityPoolV2ConverterCustomFactory.new()).address);

        const oracleWhitelist = await Whitelist.new();
        await contractRegistry.registerAddress(registry.CHAINLINK_ORACLE_WHITELIST, oracleWhitelist.address);

        chainlinkPriceOracleA = await createChainlinkOracle(10000);
        chainlinkPriceOracleB = await createChainlinkOracle(20000);

        await oracleWhitelist.addAddress(chainlinkPriceOracleA.address);
        await oracleWhitelist.addAddress(chainlinkPriceOracleB.address);
    });

    beforeEach(async () => {
        reserveToken1 = await ERC20Token.new('ERC Token 1', 'ERC1', 0, RESERVE1_BALANCE);
        reserveToken2 = await ERC20Token.new('ERC Token 2', 'ERC2', 0, RESERVE2_BALANCE);
        etherToken = await EtherToken.new('Ether Token', 'ETH');
    });

    const f = (a, b) => [].concat(...a.map(d => b.map(e => [].concat(d, e))));
    const cartesian = (a, b, ...c) => (b ? cartesian(f(a, b), ...c) : a);
    const product = cartesian([initWithoutReserves, initWith1Reserve, initWith2Reserves, initLPV2, initWithEtherReserve, initWithETHReserve],
        [...VERSIONS, null], [false, true]);
    const combinations = product.filter(([init, version, active]) => !(init === initWithoutReserves && active) &&
        !(init === initWithETHReserve && version));

    for (const [init, version, activate] of combinations) {
        describe(`${init.name}(version = ${version || 'latest'}, activate = ${activate}):`, () => {
            it('should upgrade successfully', async () => {
                let reserveTokens;
                let upgradedReserveTokens;

                if (init === initWithEtherReserve) {
                    reserveTokens = [etherToken.address, reserveToken2.address];

                    // An EtherToken reserve is always upgraded to ETH_RESERVE_ADDRESS.
                    upgradedReserveTokens = [ETH_RESERVE_ADDRESS, reserveToken2.address];
                } else if (init === initWithETHReserve) {
                    reserveTokens = [reserveToken1.address, ETH_RESERVE_ADDRESS];
                    upgradedReserveTokens = reserveTokens;
                } else {
                    reserveTokens = [reserveToken1.address, reserveToken2.address];
                    upgradedReserveTokens = reserveTokens;
                }

                // Initial reserve balances are synced when the converter is being activated or during transfer to
                // the EtherToken/ERC20 reserve, for older converters.
                const v2 = init === initLPV2;
                const olderConverter = version && version < 28 && !v2;
                const reserveBalances = [
                    activate || olderConverter ? RESERVE1_BALANCE : new BN(0),
                    activate || olderConverter ? RESERVE2_BALANCE : new BN(0)
                ];

                // Token balances are always migrated during an upgrade, regardless of the reported reserve balance by
                // the original converter.
                const upgradedReserveBalances = [
                    activate ? RESERVE1_BALANCE : new BN(0),
                    activate ? RESERVE2_BALANCE : new BN(0)
                ];

                const stakedBalances = [
                    activate ? RESERVE1_BALANCE : new BN(0),
                    activate ? RESERVE2_BALANCE : new BN(0)
                ];

                const [upgrader, oldConverter] = await init(deployer, version, activate);

                const oldConverterInitialState = await getConverterState(oldConverter);
                expect(oldConverterInitialState.owner).to.be.eql(deployer);
                expect(oldConverterInitialState.newOwner).to.be.eql(ZERO_ADDRESS);
                expect(oldConverterInitialState.tokenOwner).to.be.eql(activate ? oldConverter.address : deployer);
                expect(oldConverterInitialState.conversionFee).to.be.bignumber.equal(CONVERSION_FEE);
                expect(oldConverterInitialState.maxConversionFee).to.be.bignumber.equal(MAX_CONVERSION_FEE);

                for (let i = 0; i < oldConverterInitialState.reserveTokenCount.toNumber(); ++i) {
                    expect(oldConverterInitialState.reserveTokens[i].token).to.be.eql(reserveTokens[i]);
                    expect(oldConverterInitialState.reserveTokens[i].balance).to.be.bignumber.equal(reserveBalances[i]);

                    if (v2) {
                        expect(oldConverterInitialState.reserveTokens[i].stakedBalance).to.be.bignumber.equal(stakedBalances[i]);
                    }
                }

                if (v2) {
                    if (activate) {
                        expect(oldConverterInitialState.tokenAOracle).to.be.eql(chainlinkPriceOracleA.address);
                        expect(oldConverterInitialState.tokenBOracle).to.be.eql(chainlinkPriceOracleB.address);
                    }
                }

                let newConverter = await upgradeConverter(upgrader, oldConverter);
                if (v2) {
                    newConverter = await LiquidityPoolV2Converter.at(newConverter.address);
                }

                const oldConverterCurrentState = await getConverterState(oldConverter);
                expect(oldConverterCurrentState.owner).to.be.eql(deployer);
                expect(oldConverterCurrentState.newOwner).to.be.eql(ZERO_ADDRESS);
                expect(oldConverterCurrentState.token).to.be.eql(oldConverterInitialState.token);
                expect(oldConverterCurrentState.tokenOwner).to.be.eql(activate ? newConverter.address : deployer);
                expect(oldConverterCurrentState.conversionFee).to.be.bignumber.equal(CONVERSION_FEE);
                expect(oldConverterCurrentState.maxConversionFee).to.be.bignumber.equal(MAX_CONVERSION_FEE);
                expect(oldConverterCurrentState.reserveTokenCount).to.be.bignumber.equal(oldConverterInitialState.reserveTokenCount);

                for (let i = 0; i < oldConverterCurrentState.reserveTokenCount.toNumber(); ++i) {
                    expect(oldConverterCurrentState.reserveTokens[i].token).to.be.eql(oldConverterInitialState.reserveTokens[i].token);
                    expect(oldConverterCurrentState.reserveTokens[i].balance).to.be.bignumber.equal(new BN(0));

                    if (v2) {
                        expect(oldConverterCurrentState.reserveTokens[i].stakedBalance).to.be.bignumber
                            .equal(oldConverterInitialState.reserveTokens[i].stakedBalance);
                    }
                }

                if (v2) {
                    expect(oldConverterCurrentState.tokenAOracle).to.be.eql(oldConverterInitialState.tokenAOracle);
                    expect(oldConverterCurrentState.tokenBOracle).to.be.eql(oldConverterInitialState.tokenBOracle);
                }

                const newConverterCurrentState = await getConverterState(newConverter);
                expect(newConverterCurrentState.owner).to.be.eql(upgrader.address);
                expect(newConverterCurrentState.newOwner).to.be.eql(deployer);
                expect(newConverterCurrentState.token).to.be.eql(oldConverterInitialState.token);
                expect(newConverterCurrentState.tokenOwner).to.be.eql(activate ? newConverter.address : deployer);
                expect(newConverterCurrentState.conversionFee).to.be.bignumber.equal(CONVERSION_FEE);
                expect(newConverterCurrentState.maxConversionFee).to.be.bignumber.equal(MAX_CONVERSION_FEE);
                expect(newConverterCurrentState.reserveTokenCount).to.be.bignumber.equal(oldConverterInitialState.reserveTokenCount);

                for (let i = 0; i < newConverterCurrentState.reserveTokenCount.toNumber(); ++i) {
                    expect(newConverterCurrentState.reserveTokens[i].balance).to.be.bignumber.equal(upgradedReserveBalances[i]);
                    expect(newConverterCurrentState.reserveTokens[i].token).to.be.eql(upgradedReserveTokens[i]);

                    if (v2) {
                        expect(newConverterCurrentState.reserveTokens[i].stakedBalance).to.be.bignumber
                            .equal(oldConverterInitialState.reserveTokens[i].stakedBalance);
                    }
                }

                if (v2) {
                    expect(newConverterCurrentState.tokenAOracle).to.be.eql(oldConverterInitialState.tokenAOracle);
                    expect(newConverterCurrentState.tokenBOracle).to.be.eql(oldConverterInitialState.tokenBOracle);
                }
            });

            it('should fail if the transaction did not receive enough gas', async () => {
                const lowGas = 2000000;
                const [upgrader, oldConverter] = await init(deployer, version, activate);
                await expectRevert.unspecified(upgradeConverter(upgrader, oldConverter, { gas: lowGas }));
            });

            it('should fail if the upgrader did not receive ownership', async () => {
                const [upgrader, oldConverter] = await init(deployer, version, activate);
                await expectRevert.unspecified(upgrader.upgradeOld(oldConverter.address, web3.utils.asciiToHex('')));
            });
        });
    }
});
