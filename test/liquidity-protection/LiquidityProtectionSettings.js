const chai = require('chai');
const { ethers } = require('hardhat');
const { BigNumber } = require('ethers');

const { NATIVE_TOKEN_ADDRESS, ZERO_ADDRESS, registry, roles } = require('../helpers/Constants');

const ConverterHelper = require('../helpers/ConverterHelper');
const Contracts = require('../../components/Contracts').default;

chai.use(require('chai-arrays'));
const { expect } = chai;

const PPM_RESOLUTION = BigNumber.from(1000000);

let contractRegistry;
let converterRegistry;
let networkToken;
let poolToken;
let baseToken;
let subscriber;
let settings;

let accounts;
let owner;
let nonOwner;

const STANDARD_CONVERTER_TYPE = 3;
const STANDARD_POOL_CONVERTER_WEIGHT = 500_000;
const STANDARD_POOL_CONVERTER_WEIGHTS = [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT];
const LEGACY_CONVERTER_TYPE = 1;
const LEGACY_CONVERTER_VERSION = 45;

const initLegacyConverter = async (reserveTokens, weights) => {
    const poolToken = await Contracts.DSToken.deploy('Token1', 'TKN1', 0);
    const converter = await ConverterHelper.new(
        LEGACY_CONVERTER_TYPE,
        LEGACY_CONVERTER_VERSION,
        poolToken.address,
        contractRegistry.address,
        PPM_RESOLUTION
    );

    for (let i = 0; i < reserveTokens.length; ++i) {
        await converter.addReserve(reserveTokens[i], weights[i]);
    }

    await poolToken.transferOwnership(converter.address);
    await converter.acceptTokenOwnership();

    await converterRegistry.addConverter(converter.address);

    return { poolToken };
};

describe('LiquidityProtectionSettings', () => {
    before(async () => {
        accounts = await ethers.getSigners();

        owner = accounts[0];
        nonOwner = accounts[1];

        contractRegistry = await Contracts.ContractRegistry.deploy();
        networkToken = await Contracts.DSToken.deploy('BNT', 'BNT', 18);

        baseToken = await Contracts.DSToken.deploy('RSV1', 'RSV1', 18);

        const converterFactory = await Contracts.ConverterFactory.deploy();
        await converterFactory.registerTypedConverterFactory(
            (
                await Contracts.TestStandardPoolConverterFactory.deploy()
            ).address
        );

        const bancorNetwork = await Contracts.BancorNetwork.deploy(contractRegistry.address);

        await contractRegistry.registerAddress(registry.BANCOR_NETWORK, bancorNetwork.address);

        await contractRegistry.registerAddress(registry.CONVERTER_FACTORY, converterFactory.address);

        subscriber = await Contracts.TestLiquidityProvisionEventsSubscriber.deploy();
    });

    beforeEach(async () => {
        converterRegistry = await Contracts.ConverterRegistry.deploy(contractRegistry.address);

        const converterRegistryData = await Contracts.ConverterRegistryData.deploy(contractRegistry.address);

        await contractRegistry.registerAddress(registry.CONVERTER_REGISTRY, converterRegistry.address);
        await contractRegistry.registerAddress(registry.CONVERTER_REGISTRY_DATA, converterRegistryData.address);

        await converterRegistry.newConverter(
            STANDARD_CONVERTER_TYPE,
            'PT',
            'PT',
            18,
            PPM_RESOLUTION,
            [baseToken.address, networkToken.address],
            STANDARD_POOL_CONVERTER_WEIGHTS
        );
        const anchorCount = await converterRegistry.getAnchorCount();
        const poolTokenAddress = await converterRegistry.getAnchor(anchorCount - 1);
        poolToken = await Contracts.DSToken.attach(poolTokenAddress);

        settings = await Contracts.LiquidityProtectionSettings.deploy(networkToken.address, contractRegistry.address);
    });

    it('should properly initialize roles', async () => {
        expect(await settings.getRoleMemberCount(roles.ROLE_OWNER)).to.equal(BigNumber.from(1));

        expect(await settings.getRoleAdmin(roles.ROLE_OWNER)).to.equal(roles.ROLE_OWNER);

        expect(await settings.hasRole(roles.ROLE_OWNER, owner.address)).to.be.true;
    });

    describe('whitelisted pools', () => {
        it('should revert when a non owner attempts to add a whitelisted pool', async () => {
            await expect(settings.connect(nonOwner).addPoolToWhitelist(poolToken.address)).to.be.revertedWith(
                'ERR_ACCESS_DENIED'
            );
            expect(await settings.isPoolWhitelisted(poolToken.address)).to.be.false;
        });

        it('should revert when a non owner attempts to remove a whitelisted pool', async () => {
            await settings.connect(owner).addPoolToWhitelist(poolToken.address);
            await expect(settings.connect(nonOwner).removePoolFromWhitelist(poolToken.address)).to.be.revertedWith(
                'ERR_ACCESS_DENIED'
            );
            expect(await settings.isPoolWhitelisted(poolToken.address)).to.be.true;
        });

        it('should revert when an owner attempts to add a whitelisted pool which is already whitelisted', async () => {
            await settings.connect(owner).addPoolToWhitelist(poolToken.address);
            await expect(settings.connect(owner).addPoolToWhitelist(poolToken.address)).to.be.revertedWith(
                'ERR_POOL_ALREADY_WHITELISTED'
            );
        });

        it('should revert when an owner attempts to remove a whitelisted pool which is not yet whitelisted', async () => {
            await expect(settings.connect(owner).removePoolFromWhitelist(poolToken.address)).to.be.revertedWith(
                'ERR_POOL_NOT_WHITELISTED'
            );
        });

        it('should revert when an owner attempts to whitelist a zero address pool', async () => {
            await expect(settings.addPoolToWhitelist(ZERO_ADDRESS)).to.be.revertedWith('ERR_INVALID_EXTERNAL_ADDRESS');
        });

        it('should revert when an owner attempts to whitelist the settings contract itself', async () => {
            await expect(settings.addPoolToWhitelist(settings.address)).to.be.revertedWith(
                'ERR_INVALID_EXTERNAL_ADDRESS'
            );
        });

        it('should succeed when an owner attempts to add a whitelisted pool', async () => {
            expect(await settings.isPoolWhitelisted(poolToken.address)).to.be.false;
            expect(await settings.poolWhitelist()).to.be.empty;

            await settings.connect(owner).addPoolToWhitelist(poolToken.address);

            expect(await settings.isPoolWhitelisted(poolToken.address)).to.be.true;
            expect(await settings.poolWhitelist()).to.equalTo([poolToken.address]);

            const poolToken2 = accounts[3].address;

            await settings.connect(owner).addPoolToWhitelist(poolToken2);

            expect(await settings.isPoolWhitelisted(poolToken2)).to.be.true;
            expect(await settings.poolWhitelist()).to.equalTo([poolToken.address, poolToken2]);
        });

        it('should succeed when the owner attempts to remove a whitelisted pool', async () => {
            await settings.connect(owner).addPoolToWhitelist(poolToken.address);

            expect(await settings.isPoolWhitelisted(poolToken.address)).to.be.true;
            expect(await settings.poolWhitelist()).to.equalTo([poolToken.address]);

            await settings.connect(owner).removePoolFromWhitelist(poolToken.address);

            expect(await settings.isPoolWhitelisted(poolToken.address)).to.be.false;
            expect(await settings.poolWhitelist()).to.be.empty;
        });
    });

    describe('subscribers', () => {
        it('should revert when a non owner attempts to add a subscriber', async () => {
            await expect(settings.connect(nonOwner).addSubscriber(subscriber.address)).to.be.revertedWith(
                'ERR_ACCESS_DENIED'
            );
            expect(await settings.subscribers()).to.be.empty;
        });

        it('should revert when a non owner attempts to remove a subscriber', async () => {
            await settings.connect(owner).addSubscriber(subscriber.address);
            await expect(settings.connect(nonOwner).removeSubscriber(subscriber.address)).to.be.revertedWith(
                'ERR_ACCESS_DENIED'
            );
            expect(await settings.subscribers()).to.equalTo([subscriber.address]);
        });

        it('should revert when an owner attempts to add a subscriber which is already set', async () => {
            await settings.connect(owner).addSubscriber(subscriber.address);
            await expect(settings.connect(owner).addSubscriber(subscriber.address)).to.be.revertedWith(
                'ERR_SUBSCRIBER_ALREADY_SET'
            );
        });

        it('should revert when an owner attempts to remove an invalid subscriber', async () => {
            await expect(settings.connect(owner).removeSubscriber(subscriber.address)).to.be.revertedWith(
                'ERR_INVALID_SUBSCRIBER'
            );
        });

        it('should succeed when an owner attempts to add a subscriber', async () => {
            expect(await settings.subscribers()).to.be.empty;

            const res = await settings.connect(owner).addSubscriber(subscriber.address);
            await expect(res).to.emit(settings, 'SubscriberUpdated').withArgs(subscriber.address, true);

            expect(await settings.subscribers()).to.equalTo([subscriber.address]);

            const subscriber2 = accounts[3].address;

            const res2 = await settings.connect(owner).addSubscriber(subscriber2);
            await expect(res2).to.emit(settings, 'SubscriberUpdated').withArgs(subscriber2, true);

            expect(await settings.subscribers()).to.equalTo([subscriber.address, subscriber2]);
        });

        it('should succeed when the owner attempts to remove a subscriber', async () => {
            await settings.connect(owner).addSubscriber(subscriber.address);

            expect(await settings.subscribers()).to.equalTo([subscriber.address]);

            const res = await settings.connect(owner).removeSubscriber(subscriber.address);
            await expect(res).to.emit(settings, 'SubscriberUpdated').withArgs(subscriber.address, false);

            expect(await settings.subscribers()).to.be.empty;
        });
    });

    describe('supported pools', () => {
        it('verifies that isPoolSupported returns true for a standard pool', async () => {
            expect(await settings.isPoolSupported(poolToken.address)).to.be.true;
        });

        it('should revert when calling isPoolSupported with an address that is not an anchor in the registry', async () => {
            await expect(settings.isPoolSupported(accounts[2].address)).to.be.revertedWith('ERR_INVALID_ANCHOR');
        });

        it('verifies that isPoolSupported returns false for a pool with 3 reserves', async () => {
            const reserveToken = await Contracts.DSToken.deploy('RSV1', 'RSV1', 18);

            const { poolToken } = await initLegacyConverter(
                [NATIVE_TOKEN_ADDRESS, networkToken.address, reserveToken.address],
                [100000, 100000, 100000]
            );

            expect(await settings.isPoolSupported(poolToken.address)).to.be.false;
        });

        it('verifies that isPoolSupported returns false for a pool that does not have the network token as reserve', async () => {
            const reserveToken = await Contracts.DSToken.deploy('RSV1', 'RSV1', 18);

            const { poolToken } = await initLegacyConverter(
                [NATIVE_TOKEN_ADDRESS, reserveToken.address],
                [500000, 500000]
            );

            expect(await settings.isPoolSupported(poolToken.address)).to.be.false;
        });

        it('verifies that isPoolSupported returns false for a pool with reserve weights that are not 50%/50%', async () => {
            const { poolToken } = await initLegacyConverter(
                [NATIVE_TOKEN_ADDRESS, networkToken.address],
                [450000, 550000]
            );

            expect(await settings.isPoolSupported(poolToken.address)).to.be.false;
        });
    });

    describe('pool limits', () => {
        it('verifies that the owner can set the minimum network token liquidity for minting', async () => {
            const prevMin = await settings.minNetworkTokenLiquidityForMinting();
            const newMin = BigNumber.from(100);

            await expect(await settings.setMinNetworkTokenLiquidityForMinting(newMin))
                .to.emit(settings, 'MinNetworkTokenLiquidityForMintingUpdated')
                .withArgs(prevMin, newMin);

            const minimum = await settings.minNetworkTokenLiquidityForMinting();

            expect(minimum).not.to.equal(prevMin);
            expect(minimum).to.equal(newMin);
        });

        it('should revert when a non owner attempts to set the minimum network token liquidity for minting', async () => {
            await expect(settings.connect(nonOwner).setMinNetworkTokenLiquidityForMinting(100)).to.be.revertedWith(
                'ERR_ACCESS_DENIED'
            );
        });

        it('verifies that the owner can set the default network token minting limit', async () => {
            const prevDefault = await settings.defaultNetworkTokenMintingLimit();
            const newDefault = BigNumber.from(100);

            await expect(await settings.setDefaultNetworkTokenMintingLimit(newDefault))
                .to.emit(settings, 'DefaultNetworkTokenMintingLimitUpdated')
                .withArgs(prevDefault, newDefault);

            const defaultLimit = await settings.defaultNetworkTokenMintingLimit();

            expect(defaultLimit).not.to.equal(prevDefault);
            expect(defaultLimit).to.equal(newDefault);
        });

        it('should revert when a non owner attempts to set the default network token minting limit', async () => {
            await expect(settings.connect(nonOwner).setDefaultNetworkTokenMintingLimit(100)).to.be.revertedWith(
                'ERR_ACCESS_DENIED'
            );
        });

        it('verifies that the owner can set the network token minting limit for a pool', async () => {
            const prevLimit = await settings.networkTokenMintingLimits(poolToken.address);
            const newLimit = BigNumber.from(100);

            await expect(await settings.setNetworkTokenMintingLimit(poolToken.address, newLimit))
                .to.emit(settings, 'NetworkTokenMintingLimitUpdated')
                .withArgs(poolToken.address, prevLimit, newLimit);

            const limit = await settings.networkTokenMintingLimits(poolToken.address);

            expect(limit).not.to.equal(prevLimit);
            expect(limit).to.equal(newLimit);
        });

        it('should revert when a non owner attempts to set the network token minting limit for a pool', async () => {
            await expect(
                settings.connect(nonOwner).setNetworkTokenMintingLimit(poolToken.address, 100)
            ).to.be.revertedWith('ERR_ACCESS_DENIED');
        });
    });

    describe('protection delays', () => {
        it('verifies that the owner can set the protection delays', async () => {
            const prevMinProtectionDelay = await settings.minProtectionDelay();
            const prevMaxProtectionDelay = await settings.maxProtectionDelay();
            const newMinProtectionDelay = BigNumber.from(100);
            const newMaxProtectionDelay = BigNumber.from(200);

            await expect(await settings.setProtectionDelays(newMinProtectionDelay, 200))
                .to.emit(settings, 'ProtectionDelaysUpdated')
                .withArgs(prevMinProtectionDelay, newMinProtectionDelay, prevMaxProtectionDelay, newMaxProtectionDelay);

            const minProtectionDelay = await settings.minProtectionDelay();
            const maxProtectionDelay = await settings.maxProtectionDelay();

            expect(minProtectionDelay).not.to.equal(prevMinProtectionDelay);
            expect(maxProtectionDelay).not.to.equal(prevMaxProtectionDelay);

            expect(minProtectionDelay).to.equal(newMinProtectionDelay);
            expect(maxProtectionDelay).to.equal(newMaxProtectionDelay);
        });

        it('should revert when a non owner attempts to set the protection delays', async () => {
            await expect(settings.connect(nonOwner).setProtectionDelays(100, 200)).to.be.revertedWith(
                'ERR_ACCESS_DENIED'
            );
        });

        it('should revert when the owner attempts to set a minimum protection delay that is larger than the maximum delay', async () => {
            await expect(settings.setProtectionDelays(200, 100)).to.be.revertedWith('ERR_INVALID_PROTECTION_DELAY');
        });
    });

    describe('minimum network compensation', () => {
        it('verifies that the owner can set the minimum network compensation', async () => {
            const prevMinNetworkCompensation = await settings.minNetworkCompensation();
            const newMinNetworkCompensation = BigNumber.from(100);

            await expect(await settings.setMinNetworkCompensation(newMinNetworkCompensation))
                .to.emit(settings, 'MinNetworkCompensationUpdated')
                .withArgs(prevMinNetworkCompensation, newMinNetworkCompensation);

            const minNetworkCompensation = await settings.minNetworkCompensation();

            expect(minNetworkCompensation).not.to.equal(prevMinNetworkCompensation);
            expect(minNetworkCompensation).to.equal(newMinNetworkCompensation);
        });

        it('should revert when a non owner attempts to set the minimum network compensation', async () => {
            await expect(settings.connect(nonOwner).setMinNetworkCompensation(100)).to.be.revertedWith(
                'ERR_ACCESS_DENIED'
            );
        });
    });

    describe('lock duration', () => {
        it('verifies that the owner can set the lock duration', async () => {
            const prevLockDuration = await settings.lockDuration();
            const newLockDuration = BigNumber.from(100);

            await expect(await settings.setLockDuration(newLockDuration))
                .to.emit(settings, 'LockDurationUpdated')
                .withArgs(prevLockDuration, newLockDuration);

            const lockDuration = await settings.lockDuration();

            expect(lockDuration).not.to.equal(prevLockDuration);
            expect(lockDuration).to.equal(BigNumber.from(100));
        });

        it('should revert when a non owner attempts to set the lock duration', async () => {
            await expect(settings.connect(nonOwner).setLockDuration(BigNumber.from(100))).to.be.revertedWith(
                'ERR_ACCESS_DENIED'
            );
        });
    });

    describe('maximum deviation of the average rate', () => {
        it('verifies that the owner can set the maximum deviation of the average rate from the actual rate', async () => {
            expect(await settings.averageRateMaxDeviation()).to.equal(BigNumber.from(5000));

            await expect(await settings.setAverageRateMaxDeviation(BigNumber.from(30000)))
                .to.emit(settings, 'AverageRateMaxDeviationUpdated')
                .withArgs(BigNumber.from(5000), BigNumber.from(30000));

            expect(await settings.averageRateMaxDeviation()).to.equal(BigNumber.from(30000));
        });

        it('should revert when a non owner attempts to set the maximum deviation of the average rate from the actual rate', async () => {
            await expect(
                settings.connect(nonOwner).setAverageRateMaxDeviation(BigNumber.from(30000))
            ).to.be.revertedWith('ERR_ACCESS_DENIED');
        });
    });

    describe('add liquidity', () => {
        it('verifies that the owner can disable add liquidity', async () => {
            expect(await settings.addLiquidityDisabled(poolToken.address, networkToken.address)).to.be.false;
            await expect(await settings.disableAddLiquidity(poolToken.address, networkToken.address, true))
                .to.emit(settings, 'AddLiquidityDisabled')
                .withArgs(poolToken.address, networkToken.address, true);
            expect(await settings.addLiquidityDisabled(poolToken.address, networkToken.address)).to.be.true;
        });

        it('verifies that the owner can enable add liquidity', async () => {
            await settings.disableAddLiquidity(poolToken.address, networkToken.address, true);
            expect(await settings.addLiquidityDisabled(poolToken.address, networkToken.address)).to.be.true;
            await expect(await settings.disableAddLiquidity(poolToken.address, networkToken.address, false))
                .to.emit(settings, 'AddLiquidityDisabled')
                .withArgs(poolToken.address, networkToken.address, false);
            expect(await settings.addLiquidityDisabled(poolToken.address, networkToken.address)).to.be.false;
        });

        it('should revert when a non owner attempts to disable add liquidity', async () => {
            await expect(
                settings.connect(nonOwner).disableAddLiquidity(poolToken.address, networkToken.address, true)
            ).to.be.revertedWith('ERR_ACCESS_DENIED');
        });

        it('should revert when a non owner attempts to enable add liquidity', async () => {
            await expect(
                settings.connect(nonOwner).disableAddLiquidity(poolToken.address, networkToken.address, false)
            ).to.be.revertedWith('ERR_ACCESS_DENIED');
        });
    });
});
