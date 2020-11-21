const { accounts, defaultSender, contract } = require('@openzeppelin/test-environment');
const { expectRevert, expectEvent, BN } = require('@openzeppelin/test-helpers');
const { expect } = require('../../chai-local');
const { ETH_RESERVE_ADDRESS, registry, roles } = require('./helpers/Constants');

const { ROLE_OWNER, ROLE_WHITELIST_ADMIN } = roles;

const BancorFormula = contract.fromArtifact('BancorFormula');
const BancorNetwork = contract.fromArtifact('BancorNetwork');
const ContractRegistry = contract.fromArtifact('ContractRegistry');
const ConverterRegistry = contract.fromArtifact('ConverterRegistry');
const ConverterRegistryData = contract.fromArtifact('ConverterRegistryData');
const ConverterFactory = contract.fromArtifact('ConverterFactory');
const DSToken = contract.fromArtifact('DSToken');
const LiquidityPoolV1ConverterFactory = contract.fromArtifact('TestLiquidityPoolV1ConverterFactory');
const LiquidityProtectionSettings = contract.fromArtifact('LiquidityProtectionSettings');

const PPM_RESOLUTION = new BN(1000000);

describe('LiquidityProtectionSettings', () => {
    const owner = defaultSender;
    const nonOwner = accounts[1];

    let contractRegistry;
    let converterRegistry;
    let networkToken;
    let poolToken;
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
        const converterFactory = await ConverterFactory.new();
        await converterFactory.registerTypedConverterFactory(liquidityPoolV1ConverterFactory.address);

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
    });

    beforeEach(async () => {
        settings = await LiquidityProtectionSettings.new(networkToken.address, contractRegistry.address);
    });

    it('should properly initialize roles', async () => {
        expect(await settings.getRoleMemberCount.call(ROLE_OWNER)).to.be.bignumber.equal(new BN(1));
        expect(await settings.getRoleMemberCount.call(ROLE_WHITELIST_ADMIN)).to.be.bignumber.equal(new BN(0));

        expect(await settings.getRoleAdmin.call(ROLE_OWNER)).to.eql(ROLE_OWNER);
        expect(await settings.getRoleAdmin.call(ROLE_WHITELIST_ADMIN)).to.eql(ROLE_OWNER);

        expect(await settings.hasRole.call(ROLE_OWNER, owner)).to.be.true();
        expect(await settings.hasRole.call(ROLE_WHITELIST_ADMIN, owner)).to.be.false();
    });

    describe('whitelisted pools basic verification', () => {
        const admin = accounts[2];

        beforeEach(async () => {
            await settings.grantRole(ROLE_WHITELIST_ADMIN, admin, { from: owner });
        });

        it('should revert when a non admin attempts to add a whitelisted pool', async () => {
            await expectRevert(settings.addPoolToWhitelist(poolToken.address, { from: nonOwner }), 'ERR_ACCESS_DENIED');
            expect(await settings.isPoolWhitelisted(poolToken.address)).to.be.false();
        });

        it('should revert when a non admin attempts to remove a whitelisted pool', async () => {
            await settings.addPoolToWhitelist(poolToken.address, { from: admin });
            await expectRevert(
                settings.removePoolFromWhitelist(poolToken.address, { from: nonOwner }),
                'ERR_ACCESS_DENIED'
            );
            expect(await settings.isPoolWhitelisted.call(poolToken.address)).to.be.true();
        });

        it('should revert when an admin attempts to add a whitelisted pool which is already whitelisted', async () => {
            await settings.addPoolToWhitelist(poolToken.address, { from: admin });
            await expectRevert(
                settings.addPoolToWhitelist(poolToken.address, { from: admin }),
                'ERR_POOL_ALREADY_WHITELISTED'
            );
        });

        it('should revert when an admin attempts to remove a whitelisted pool which is not yet whitelisted', async () => {
            await expectRevert(
                settings.removePoolFromWhitelist(poolToken.address, { from: admin }),
                'ERR_POOL_NOT_WHITELISTED'
            );
        });

        it('should succeed when an admin attempts to add a whitelisted pool', async () => {
            expect(await settings.isPoolWhitelisted.call(poolToken.address)).to.be.false();
            await settings.addPoolToWhitelist(poolToken.address, { from: admin });
            expect(await settings.isPoolWhitelisted.call(poolToken.address)).to.be.true();
        });

        it('should succeed when the owner attempts to remove a whitelisted pool', async () => {
            await settings.addPoolToWhitelist(poolToken.address, { from: admin });
            expect(await settings.isPoolWhitelisted.call(poolToken.address)).to.be.true();
            await settings.removePoolFromWhitelist(poolToken.address, { from: admin });
            expect(await settings.isPoolWhitelisted.call(poolToken.address)).to.be.false();
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

    describe('high tier pools', () => {
        it('should allow the owner to add a high tier pool', async () => {
            expect(await settings.isHighTierPool(poolToken.address)).to.be.false();
            await settings.addHighTierPool(poolToken.address, { from: owner });
            expect(await settings.isHighTierPool(poolToken.address)).to.be.true();
        });

        it('should allow the owner to remove a high tier pool', async () => {
            await settings.addHighTierPool(poolToken.address, { from: owner });
            expect(await settings.isHighTierPool.call(poolToken.address)).to.be.true();
            await settings.removeHighTierPool(poolToken.address, { from: owner });
            expect(await settings.isHighTierPool.call(poolToken.address)).to.be.false();
        });

        it('should revert when a non owner attempts to add a high tier pool', async () => {
            await expectRevert(settings.addHighTierPool(poolToken.address, { from: nonOwner }), 'ERR_ACCESS_DENIED');
            expect(await settings.isHighTierPool(poolToken.address)).to.be.false();
        });

        it('should revert when a non owner attempts to remove a high tier pool', async () => {
            await settings.addHighTierPool(poolToken.address, { from: owner });
            await expectRevert(settings.removeHighTierPool(poolToken.address, { from: nonOwner }), 'ERR_ACCESS_DENIED');
            expect(await settings.isHighTierPool(poolToken.address)).to.be.true();
        });

        it('should revert when the owner attempts to add a high tier pool that is already defined as high tier one', async () => {
            await settings.addHighTierPool(poolToken.address, { from: owner });
            await expectRevert(settings.addHighTierPool(poolToken.address, { from: owner }), 'ERR_POOL_ALREADY_EXISTS');
        });

        it('should revert when the owner attempts to remove a high tier pool that is not defined as a high tier one', async () => {
            await expectRevert(
                settings.removeHighTierPool(poolToken.address, { from: owner }),
                'ERR_POOL_DOES_NOT_EXIST'
            );
        });
    });

    describe('token limits', () => {
        it('verifies that the owner can set the system network token limits', async () => {
            const prevMaxSystemNetworkTokenAmount = await settings.maxSystemNetworkTokenAmount.call();
            const prevMaxSystemNetworkTokenRatio = await settings.maxSystemNetworkTokenRatio.call();
            const newMaxSystemNetworkTokenAmount = new BN(100);
            const newMaxSystemNetworkTokenRatio = new BN(200);

            const res = await settings.setSystemNetworkTokenLimits(
                newMaxSystemNetworkTokenAmount,
                newMaxSystemNetworkTokenRatio
            );

            expectEvent(res, 'SystemNetworkTokenLimitsUpdated', {
                _prevMaxSystemNetworkTokenAmount: prevMaxSystemNetworkTokenAmount,
                _newMaxSystemNetworkTokenAmount: newMaxSystemNetworkTokenAmount,
                _prevMaxSystemNetworkTokenRatio: prevMaxSystemNetworkTokenRatio,
                _newMaxSystemNetworkTokenRatio: newMaxSystemNetworkTokenRatio
            });

            const maxSystemNetworkTokenAmount = await settings.maxSystemNetworkTokenAmount.call();
            const maxSystemNetworkTokenRatio = await settings.maxSystemNetworkTokenRatio.call();

            expect(maxSystemNetworkTokenAmount).not.to.be.bignumber.equal(prevMaxSystemNetworkTokenAmount);
            expect(maxSystemNetworkTokenRatio).not.to.be.bignumber.equal(prevMaxSystemNetworkTokenRatio);

            expect(maxSystemNetworkTokenAmount).to.be.bignumber.equal(newMaxSystemNetworkTokenAmount);
            expect(maxSystemNetworkTokenRatio).to.be.bignumber.equal(newMaxSystemNetworkTokenRatio);
        });

        it('should revert when a non owner attempts to set the system network token limits', async () => {
            await expectRevert(
                settings.setSystemNetworkTokenLimits(100, 200, {
                    from: nonOwner
                }),
                'ERR_ACCESS_DENIED'
            );
        });

        it('should revert when the owner attempts to set a system network token ratio that is larger than 100%', async () => {
            await expectRevert(
                settings.setSystemNetworkTokenLimits(200, PPM_RESOLUTION.add(new BN(1))),
                'ERR_INVALID_PORTION'
            );
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
});
