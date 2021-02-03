const { accounts, defaultSender, contract } = require('@openzeppelin/test-environment');
const { expectRevert, expectEvent, BN } = require('@openzeppelin/test-helpers');
const { expect } = require('../../chai-local');
const { ETH_RESERVE_ADDRESS, registry, roles } = require('./helpers/Constants');

const { ROLE_OWNER } = roles;

const BancorFormula = contract.fromArtifact('BancorFormula');
const BancorNetwork = contract.fromArtifact('BancorNetwork');
const ContractRegistry = contract.fromArtifact('ContractRegistry');
const ConverterRegistry = contract.fromArtifact('ConverterRegistry');
const ConverterRegistryData = contract.fromArtifact('ConverterRegistryData');
const ConverterFactory = contract.fromArtifact('ConverterFactory');
const DSToken = contract.fromArtifact('DSToken');
const LiquidityPoolV1ConverterFactory = contract.fromArtifact('TestLiquidityPoolV1ConverterFactory');
const StandardPoolConverterFactory = contract.fromArtifact('TestStandardPoolConverterFactory');
const LiquidityProtectionEventsSubscriber = contract.fromArtifact('TestLiquidityProtectionEventsSubscriber');
const LiquidityProtectionSettings = contract.fromArtifact('LiquidityProtectionSettings');

const PPM_RESOLUTION = new BN(1000000);

describe('LiquidityProtectionSettings', () => {
    const owner = defaultSender;
    const nonOwner = accounts[1];

    let contractRegistry;
    let converterRegistry;
    let networkToken;
    let poolToken;
    let subscriber;
    let settings;

    before(async () => {
        contractRegistry = await ContractRegistry.new();
        networkToken = await DSToken.new('BNT', 'BNT', 18);

        const baseToken = await DSToken.new('RSV1', 'RSV1', 18);
        const weights = [500000, 500000];

        converterRegistry = await ConverterRegistry.new(contractRegistry.address);
        const converterRegistryData = await ConverterRegistryData.new(contractRegistry.address);
        const bancorNetwork = await BancorNetwork.new(contractRegistry.address);

        const liquidityPoolV1ConverterFactory = await LiquidityPoolV1ConverterFactory.new();
        const standardPoolConverterFactory = await StandardPoolConverterFactory.new();
        const converterFactory = await ConverterFactory.new();
        await converterFactory.registerTypedConverterFactory(liquidityPoolV1ConverterFactory.address);
        await converterFactory.registerTypedConverterFactory(standardPoolConverterFactory.address);

        const bancorFormula = await BancorFormula.new();
        await bancorFormula.init();

        await contractRegistry.registerAddress(registry.CONVERTER_FACTORY, converterFactory.address);
        await contractRegistry.registerAddress(registry.CONVERTER_REGISTRY, converterRegistry.address);
        await contractRegistry.registerAddress(registry.CONVERTER_REGISTRY_DATA, converterRegistryData.address);
        await contractRegistry.registerAddress(registry.BANCOR_FORMULA, bancorFormula.address);
        await contractRegistry.registerAddress(registry.BANCOR_NETWORK, bancorNetwork.address);

        await converterRegistry.newConverter(
            1,
            'PT',
            'PT',
            18,
            PPM_RESOLUTION,
            [baseToken.address, networkToken.address],
            weights
        );
        const anchorCount = await converterRegistry.getAnchorCount.call();
        const poolTokenAddress = await converterRegistry.getAnchor.call(anchorCount - 1);
        poolToken = await DSToken.at(poolTokenAddress);

        subscriber = await LiquidityProtectionEventsSubscriber.new();
    });

    beforeEach(async () => {
        settings = await LiquidityProtectionSettings.new(networkToken.address, contractRegistry.address);
    });

    it('should properly initialize roles', async () => {
        expect(await settings.getRoleMemberCount.call(ROLE_OWNER)).to.be.bignumber.equal(new BN(1));

        expect(await settings.getRoleAdmin.call(ROLE_OWNER)).to.eql(ROLE_OWNER);

        expect(await settings.hasRole.call(ROLE_OWNER, owner)).to.be.true();
    });

    describe('whitelisted pools', () => {
        it('should revert when a non owner attempts to add a whitelisted pool', async () => {
            await expectRevert(settings.addPoolToWhitelist(poolToken.address, { from: nonOwner }), 'ERR_ACCESS_DENIED');
            expect(await settings.isPoolWhitelisted.call(poolToken.address)).to.be.false();
        });

        it('should revert when a non owner attempts to remove a whitelisted pool', async () => {
            await settings.addPoolToWhitelist(poolToken.address, { from: owner });
            await expectRevert(
                settings.removePoolFromWhitelist(poolToken.address, { from: nonOwner }),
                'ERR_ACCESS_DENIED'
            );
            expect(await settings.isPoolWhitelisted.call(poolToken.address)).to.be.true();
        });

        it('should revert when an owner attempts to add a whitelisted pool which is already whitelisted', async () => {
            await settings.addPoolToWhitelist(poolToken.address, { from: owner });
            await expectRevert(
                settings.addPoolToWhitelist(poolToken.address, { from: owner }),
                'ERR_POOL_ALREADY_WHITELISTED'
            );
        });

        it('should revert when an owner attempts to remove a whitelisted pool which is not yet whitelisted', async () => {
            await expectRevert(
                settings.removePoolFromWhitelist(poolToken.address, { from: owner }),
                'ERR_POOL_NOT_WHITELISTED'
            );
        });

        it('should succeed when an owner attempts to add a whitelisted pool', async () => {
            expect(await settings.isPoolWhitelisted.call(poolToken.address)).to.be.false();
            expect(await settings.poolWhitelist.call()).to.be.equalTo([]);

            await settings.addPoolToWhitelist(poolToken.address, { from: owner });

            expect(await settings.isPoolWhitelisted.call(poolToken.address)).to.be.true();
            expect(await settings.poolWhitelist.call()).to.be.equalTo([poolToken.address]);

            const poolToken2 = accounts[3];

            await settings.addPoolToWhitelist(poolToken2, { from: owner });

            expect(await settings.isPoolWhitelisted.call(poolToken2)).to.be.true();
            expect(await settings.poolWhitelist.call()).to.be.equalTo([poolToken.address, poolToken2]);
        });

        it('should succeed when the owner attempts to remove a whitelisted pool', async () => {
            await settings.addPoolToWhitelist(poolToken.address, { from: owner });

            expect(await settings.isPoolWhitelisted.call(poolToken.address)).to.be.true();
            expect(await settings.poolWhitelist.call()).to.be.equalTo([poolToken.address]);

            await settings.removePoolFromWhitelist(poolToken.address, { from: owner });

            expect(await settings.isPoolWhitelisted.call(poolToken.address)).to.be.false();
            expect(await settings.poolWhitelist.call()).to.be.equalTo([]);
        });
    });

    describe('listed subscribers', () => {
        it('should revert when a non owner attempts to add a listed subscriber', async () => {
            await expectRevert(settings.addSubscriberToList(subscriber.address, { from: nonOwner }), 'ERR_ACCESS_DENIED');
            expect(await settings.subscriberList.call()).to.be.equalTo([]);
        });

        it('should revert when a non owner attempts to remove a listed subscriber', async () => {
            await settings.addSubscriberToList(subscriber.address, { from: owner });
            await expectRevert(
                settings.removeSubscriberFromList(subscriber.address, { from: nonOwner }),
                'ERR_ACCESS_DENIED'
            );
            expect(await settings.subscriberList.call()).to.be.equalTo([subscriber.address]);
        });

        it('should revert when an owner attempts to add a listed subscriber which is already listed', async () => {
            await settings.addSubscriberToList(subscriber.address, { from: owner });
            await expectRevert(
                settings.addSubscriberToList(subscriber.address, { from: owner }),
                'ERR_SUBSCRIBER_ALREADY_LISTED'
            );
        });

        it('should revert when an owner attempts to remove a listed subscriber which is not yet listed', async () => {
            await expectRevert(
                settings.removeSubscriberFromList(subscriber.address, { from: owner }),
                'ERR_SUBSCRIBER_NOT_LISTED'
            );
        });

        it('should succeed when an owner attempts to add a listed subscriber', async () => {
            expect(await settings.subscriberList.call()).to.be.equalTo([]);

            await settings.addSubscriberToList(subscriber.address, { from: owner });

            expect(await settings.subscriberList.call()).to.be.equalTo([subscriber.address]);

            const subscriber2 = accounts[3];

            await settings.addSubscriberToList(subscriber2, { from: owner });

            expect(await settings.subscriberList.call()).to.be.equalTo([subscriber.address, subscriber2]);
        });

        it('should succeed when the owner attempts to remove a listed subscriber', async () => {
            await settings.addSubscriberToList(subscriber.address, { from: owner });

            expect(await settings.subscriberList.call()).to.be.equalTo([subscriber.address]);

            await settings.removeSubscriberFromList(subscriber.address, { from: owner });

            expect(await settings.subscriberList.call()).to.be.equalTo([]);
        });
    });

    describe('supported pools', () => {
        it('verifies that isPoolSupported returns true for a standard pool', async () => {
            expect(await settings.isPoolSupported.call(poolToken.address)).to.be.true();
        });

        it('should revert when calling isPoolSupported with an address that is not an anchor in the registry', async () => {
            await expectRevert(settings.isPoolSupported(accounts[2]), 'ERR_INVALID_ANCHOR');
        });

        it('verifies that isPoolSupported returns false for a pool with 3 reserves', async () => {
            const reserveToken = await DSToken.new('RSV1', 'RSV1', 18);
            await converterRegistry.newConverter(
                1,
                'PT',
                'PT',
                18,
                5000,
                [ETH_RESERVE_ADDRESS, networkToken.address, reserveToken.address],
                [100000, 100000, 100000]
            );
            const anchorCount = await converterRegistry.getAnchorCount.call();
            const poolTokenAddress = await converterRegistry.getAnchor.call(anchorCount - 1);

            expect(await settings.isPoolSupported.call(poolTokenAddress)).to.be.false();
        });

        it('verifies that isPoolSupported returns false for a pool that does not have the network token as reserve', async () => {
            const reserveToken = await DSToken.new('RSV1', 'RSV1', 18);
            await converterRegistry.newConverter(
                1,
                'PT',
                'PT',
                18,
                5000,
                [ETH_RESERVE_ADDRESS, reserveToken.address],
                [500000, 500000]
            );
            const anchorCount = await converterRegistry.getAnchorCount.call();
            const poolTokenAddress = await converterRegistry.getAnchor.call(anchorCount - 1);

            expect(await settings.isPoolSupported.call(poolTokenAddress)).to.be.false();
        });

        it('verifies that isPoolSupported returns false for a pool with reserve weights that are not 50%/50%', async () => {
            await converterRegistry.newConverter(
                1,
                'PT',
                'PT',
                18,
                5000,
                [ETH_RESERVE_ADDRESS, networkToken.address],
                [450000, 550000]
            );
            const anchorCount = await converterRegistry.getAnchorCount.call();
            const poolTokenAddress = await converterRegistry.getAnchor.call(anchorCount - 1);

            expect(await settings.isPoolSupported.call(poolTokenAddress)).to.be.false();
        });
    });

    describe('pool limits', () => {
        const admin = accounts[2];

        it('verifies that the owner can set the minimum network token liquidity for minting', async () => {
            const prevMin = await settings.minNetworkTokenLiquidityForMinting.call();
            const newMin = new BN(100);

            const res = await settings.setMinNetworkTokenLiquidityForMinting(newMin);

            expectEvent(res, 'MinNetworkTokenLiquidityForMintingUpdated', {
                _prevMin: prevMin,
                _newMin: newMin
            });

            const minimum = await settings.minNetworkTokenLiquidityForMinting.call();

            expect(minimum).not.to.be.bignumber.equal(prevMin);
            expect(minimum).to.be.bignumber.equal(newMin);
        });

        it('should revert when a non owner attempts to set the minimum network token liquidity for minting', async () => {
            await expectRevert(settings.setMinNetworkTokenLiquidityForMinting(100, { from: nonOwner }), 'ERR_ACCESS_DENIED');
        });

        it('verifies that the owner can set the default network token minting limit', async () => {
            const prevDefault = await settings.defaultNetworkTokenMintingLimit.call();
            const newDefault = new BN(100);

            const res = await settings.setDefaultNetworkTokenMintingLimit(newDefault);

            expectEvent(res, 'DefaultNetworkTokenMintingLimitUpdated', {
                _prevDefault: prevDefault,
                _newDefault: newDefault
            });

            const defaultLimit = await settings.defaultNetworkTokenMintingLimit.call();

            expect(defaultLimit).not.to.be.bignumber.equal(prevDefault);
            expect(defaultLimit).to.be.bignumber.equal(newDefault);
        });

        it('should revert when a non owner attempts to set the default network token minting limit', async () => {
            await expectRevert(settings.setDefaultNetworkTokenMintingLimit(100, { from: nonOwner }), 'ERR_ACCESS_DENIED');
        });

        it('verifies that the owner can set the network token minting limit for a pool', async () => {
            const prevPoolLimit = await settings.networkTokenMintingLimits.call(poolToken.address);
            const newPoolLimit = new BN(100);

            const res = await settings.setNetworkTokenMintingLimit(poolToken.address, newPoolLimit);

            expectEvent(res, 'NetworkTokenMintingLimitUpdated', {
                _prevLimit: prevPoolLimit,
                _newLimit: newPoolLimit
            });

            const poolLimit = await settings.networkTokenMintingLimits.call(poolToken.address);

            expect(poolLimit).not.to.be.bignumber.equal(prevPoolLimit);
            expect(poolLimit).to.be.bignumber.equal(newPoolLimit);
        });

        it('should revert when a non owner attempts to set the network token minting limit for a pool', async () => {
            await expectRevert(settings.setNetworkTokenMintingLimit(poolToken.address, 100, { from: nonOwner }), 'ERR_ACCESS_DENIED');
        });
    });

    describe('protection delays', () => {
        it('verifies that the owner can set the protection delays', async () => {
            const prevMinProtectionDelay = await settings.minProtectionDelay.call();
            const prevMaxProtectionDelay = await settings.maxProtectionDelay.call();
            const newMinProtectionDelay = new BN(100);
            const newMaxProtectionDelay = new BN(200);

            const res = await settings.setProtectionDelays(newMinProtectionDelay, 200);

            expectEvent(res, 'ProtectionDelaysUpdated', {
                _prevMinProtectionDelay: prevMinProtectionDelay,
                _newMinProtectionDelay: newMinProtectionDelay,
                _prevMaxProtectionDelay: prevMaxProtectionDelay,
                _newMaxProtectionDelay: newMaxProtectionDelay
            });

            const minProtectionDelay = await settings.minProtectionDelay.call();
            const maxProtectionDelay = await settings.maxProtectionDelay.call();

            expect(minProtectionDelay).not.to.be.bignumber.equal(prevMinProtectionDelay);
            expect(maxProtectionDelay).not.to.be.bignumber.equal(prevMaxProtectionDelay);

            expect(minProtectionDelay).to.be.bignumber.equal(newMinProtectionDelay);
            expect(maxProtectionDelay).to.be.bignumber.equal(newMaxProtectionDelay);
        });

        it('should revert when a non owner attempts to set the protection delays', async () => {
            await expectRevert(settings.setProtectionDelays(100, 200, { from: nonOwner }), 'ERR_ACCESS_DENIED');
        });

        it('should revert when the owner attempts to set a minimum protection delay that is larger than the maximum delay', async () => {
            await expectRevert(settings.setProtectionDelays(200, 100), 'ERR_INVALID_PROTECTION_DELAY');
        });
    });

    describe('minimum network compensation', () => {
        it('verifies that the owner can set the minimum network compensation', async () => {
            const prevMinNetworkCompensation = await settings.minNetworkCompensation.call();
            const newMinNetworkCompensation = new BN(100);

            const res = await settings.setMinNetworkCompensation(newMinNetworkCompensation);

            expectEvent(res, 'MinNetworkCompensationUpdated', {
                _prevMinNetworkCompensation: prevMinNetworkCompensation,
                _newMinNetworkCompensation: newMinNetworkCompensation
            });

            const minNetworkCompensation = await settings.minNetworkCompensation.call();

            expect(minNetworkCompensation).not.to.be.bignumber.equal(prevMinNetworkCompensation);
            expect(minNetworkCompensation).to.be.bignumber.equal(newMinNetworkCompensation);
        });

        it('should revert when a non owner attempts to set the minimum network compensation', async () => {
            await expectRevert(settings.setMinNetworkCompensation(100, { from: nonOwner }), 'ERR_ACCESS_DENIED');
        });
    });

    describe('lock duration', () => {
        it('verifies that the owner can set the lock duration', async () => {
            const prevLockDuration = await settings.lockDuration.call();
            const newLockDuration = new BN(100);

            const res = await settings.setLockDuration(newLockDuration);
            expectEvent(res, 'LockDurationUpdated', {
                _prevLockDuration: prevLockDuration,
                _newLockDuration: newLockDuration
            });

            const lockDuration = await settings.lockDuration.call();

            expect(lockDuration).not.to.be.bignumber.equal(prevLockDuration);
            expect(lockDuration).to.be.bignumber.equal(new BN(100));
        });

        it('should revert when a non owner attempts to set the lock duration', async () => {
            await expectRevert(settings.setLockDuration(new BN(100), { from: nonOwner }), 'ERR_ACCESS_DENIED');
        });
    });

    describe('maximum deviation of the average rate', () => {
        it('verifies that the owner can set the maximum deviation of the average rate from the actual rate', async () => {
            expect(await settings.averageRateMaxDeviation.call()).to.be.bignumber.equal(new BN(5000));

            const res = await settings.setAverageRateMaxDeviation(new BN(30000));
            expectEvent(res, 'AverageRateMaxDeviationUpdated', {
                _prevAverageRateMaxDeviation: new BN(5000),
                _newAverageRateMaxDeviation: new BN(30000)
            });

            expect(await settings.averageRateMaxDeviation.call()).to.be.bignumber.equal(new BN(30000));
        });

        it('should revert when a non owner attempts to set the maximum deviation of the average rate from the actual rate', async () => {
            await expectRevert(
                settings.setAverageRateMaxDeviation(new BN(30000), { from: nonOwner }),
                'ERR_ACCESS_DENIED'
            );
        });
    });

    describe('add liquidity', () => {
        it('verifies that the owner can disable add liquidity', async () => {
            expect(await settings.addLiquidityDisabled.call(poolToken.address, networkToken.address)).to.be.false();
            const res = await settings.disableAddLiquidity(poolToken.address, networkToken.address, true);
            expect(await settings.addLiquidityDisabled.call(poolToken.address, networkToken.address)).to.be.true();
            expectEvent(res, 'AddLiquidityDisabled', {
                _poolAnchor: poolToken.address,
                _reserveToken: networkToken.address,
                _state: true
            });
        });

        it('verifies that the owner can enable add liquidity', async () => {
            await settings.disableAddLiquidity(poolToken.address, networkToken.address, true);
            expect(await settings.addLiquidityDisabled.call(poolToken.address, networkToken.address)).to.be.true();
            const res = await settings.disableAddLiquidity(poolToken.address, networkToken.address, false);
            expect(await settings.addLiquidityDisabled.call(poolToken.address, networkToken.address)).to.be.false();
            expectEvent(res, 'AddLiquidityDisabled', {
                _poolAnchor: poolToken.address,
                _reserveToken: networkToken.address,
                _state: false
            });
        });

        it('should revert when a non owner attempts to disable add liquidity', async () => {
            await expectRevert(settings.disableAddLiquidity(poolToken.address, networkToken.address, true, { from: nonOwner }), 'ERR_ACCESS_DENIED');
        });

        it('should revert when a non owner attempts to enable add liquidity', async () => {
            await expectRevert(settings.disableAddLiquidity(poolToken.address, networkToken.address, false, { from: nonOwner }), 'ERR_ACCESS_DENIED');
        });
    });
});
