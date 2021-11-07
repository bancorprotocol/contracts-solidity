const chai = require('chai');
const { ethers } = require('hardhat');
const { BigNumber } = require('ethers');

const { roles } = require('../helpers/Constants');
const Contracts = require('../../components/Contracts').default;

chai.use(require('chai-arrays'));
const { expect } = chai;

let liquidityProtectionStats;

let owner;
let seeder;
let provider;
let poolToken;
let reserveToken;
let accounts;

describe('LiquidityProtectionStats', () => {
    before(async () => {
        accounts = await ethers.getSigners();

        owner = accounts[1];
        seeder = accounts[2];
        provider = accounts[3];
        poolToken = accounts[4];
        reserveToken = accounts[5];
    });

    beforeEach(async () => {
        liquidityProtectionStats = await Contracts.LiquidityProtectionStats.deploy();
        await liquidityProtectionStats.grantRole(roles.ROLE_OWNER, owner.address);
        await liquidityProtectionStats.grantRole(roles.ROLE_SEEDER, seeder.address);
    });

    it('should revert when a non owner attempts to increase total amounts', async () => {
        await expect(
            liquidityProtectionStats.increaseTotalAmounts(
                provider.address,
                poolToken.address,
                reserveToken.address,
                1,
                2
            )
        ).to.be.revertedWith('ERR_ACCESS_DENIED');
        expect(await liquidityProtectionStats.totalPoolAmount(poolToken.address)).to.equal(BigNumber.from(0));
        expect(await liquidityProtectionStats.totalReserveAmount(poolToken.address, reserveToken.address)).to.equal(
            BigNumber.from(0)
        );
        expect(
            await liquidityProtectionStats.totalProviderAmount(
                provider.address,
                poolToken.address,
                reserveToken.address
            )
        ).to.equal(BigNumber.from(0));
    });

    it('should revert when a non owner attempts to decrease total amounts', async () => {
        await liquidityProtectionStats
            .connect(owner)
            .increaseTotalAmounts(provider.address, poolToken.address, reserveToken.address, 1, 2);
        await expect(
            liquidityProtectionStats.decreaseTotalAmounts(
                provider.address,
                poolToken.address,
                reserveToken.address,
                1,
                2
            )
        ).to.be.revertedWith('ERR_ACCESS_DENIED');
        expect(await liquidityProtectionStats.totalPoolAmount(poolToken.address)).to.equal(BigNumber.from(1));
        expect(await liquidityProtectionStats.totalReserveAmount(poolToken.address, reserveToken.address)).to.equal(
            BigNumber.from(2)
        );
        expect(
            await liquidityProtectionStats.totalProviderAmount(
                provider.address,
                poolToken.address,
                reserveToken.address
            )
        ).to.equal(BigNumber.from(2));
    });

    it('should revert when a non owner attempts to add a provider pool', async () => {
        await expect(liquidityProtectionStats.addProviderPool(provider.address, poolToken.address)).to.be.revertedWith(
            'ERR_ACCESS_DENIED'
        );
        expect(await liquidityProtectionStats.providerPools(provider.address)).to.empty;
    });

    it('should revert when a non owner attempts to remove a provider pool', async () => {
        await liquidityProtectionStats.connect(owner).addProviderPool(provider.address, poolToken.address);
        await expect(
            liquidityProtectionStats.removeProviderPool(provider.address, poolToken.address)
        ).to.be.revertedWith('ERR_ACCESS_DENIED');
        expect(await liquidityProtectionStats.providerPools(provider.address)).to.equalTo([poolToken.address]);
    });

    it('should revert when a non seeder attempts to seed pool amounts', async () => {
        await expect(liquidityProtectionStats.seedPoolAmounts([poolToken.address], [1])).to.be.revertedWith(
            'ERR_ACCESS_DENIED'
        );
        expect(await liquidityProtectionStats.totalPoolAmount(poolToken.address)).to.equal(BigNumber.from(0));
    });

    it('should revert when a non seeder attempts to seed reserve amounts', async () => {
        await expect(
            liquidityProtectionStats.seedReserveAmounts([poolToken.address], [reserveToken.address], [1])
        ).to.be.revertedWith('ERR_ACCESS_DENIED');
        expect(await liquidityProtectionStats.totalReserveAmount(poolToken.address, reserveToken.address)).to.equal(
            BigNumber.from(0)
        );
    });

    it('should revert when a non seeder attempts to seed provider amounts', async () => {
        await expect(
            liquidityProtectionStats.seedProviderAmounts(
                [provider.address],
                [poolToken.address],
                [reserveToken.address],
                [1]
            )
        ).to.be.revertedWith('ERR_ACCESS_DENIED');
        expect(
            await liquidityProtectionStats.totalProviderAmount(
                provider.address,
                poolToken.address,
                reserveToken.address
            )
        ).to.equal(BigNumber.from(0));
    });

    it('should revert when a non seeder attempts to seed provider pools', async () => {
        await expect(
            liquidityProtectionStats.seedProviderPools([provider.address], [poolToken.address])
        ).to.be.revertedWith('ERR_ACCESS_DENIED');
        expect(await liquidityProtectionStats.providerPools(provider.address)).to.empty;
    });

    it('should revert when a non seeder attempts to seed pool amounts', async () => {
        await expect(liquidityProtectionStats.seedPoolAmounts([poolToken.address], [1])).to.be.revertedWith(
            'ERR_ACCESS_DENIED'
        );
        expect(await liquidityProtectionStats.totalPoolAmount(poolToken.address)).to.equal(BigNumber.from(0));
    });

    it('should succeed when the owner attempts to increase total amounts', async () => {
        expect(await liquidityProtectionStats.totalPoolAmount(poolToken.address)).to.equal(BigNumber.from(0));
        expect(await liquidityProtectionStats.totalReserveAmount(poolToken.address, reserveToken.address)).to.equal(
            BigNumber.from(0)
        );
        expect(
            await liquidityProtectionStats.totalProviderAmount(
                provider.address,
                poolToken.address,
                reserveToken.address
            )
        ).to.equal(BigNumber.from(0));
        await liquidityProtectionStats
            .connect(owner)
            .increaseTotalAmounts(provider.address, poolToken.address, reserveToken.address, 1, 2);
        expect(await liquidityProtectionStats.totalPoolAmount(poolToken.address)).to.equal(BigNumber.from(1));
        expect(await liquidityProtectionStats.totalReserveAmount(poolToken.address, reserveToken.address)).to.equal(
            BigNumber.from(2)
        );
        expect(
            await liquidityProtectionStats.totalProviderAmount(
                provider.address,
                poolToken.address,
                reserveToken.address
            )
        ).to.equal(BigNumber.from(2));
    });

    it('should succeed when the owner attempts to decrease total amounts', async () => {
        await liquidityProtectionStats
            .connect(owner)
            .increaseTotalAmounts(provider.address, poolToken.address, reserveToken.address, 1, 2);
        expect(await liquidityProtectionStats.totalPoolAmount(poolToken.address)).to.equal(BigNumber.from(1));
        expect(await liquidityProtectionStats.totalReserveAmount(poolToken.address, reserveToken.address)).to.equal(
            BigNumber.from(2)
        );
        expect(
            await liquidityProtectionStats.totalProviderAmount(
                provider.address,
                poolToken.address,
                reserveToken.address
            )
        ).to.equal(BigNumber.from(2));
        await liquidityProtectionStats
            .connect(owner)
            .decreaseTotalAmounts(provider.address, poolToken.address, reserveToken.address, 1, 2);
        expect(await liquidityProtectionStats.totalPoolAmount(poolToken.address)).to.equal(BigNumber.from(0));
        expect(await liquidityProtectionStats.totalReserveAmount(poolToken.address, reserveToken.address)).to.equal(
            BigNumber.from(0)
        );
        expect(
            await liquidityProtectionStats.totalProviderAmount(
                provider.address,
                poolToken.address,
                reserveToken.address
            )
        ).to.equal(BigNumber.from(0));
    });

    it('should succeed when the owner attempts to add a provider pool', async () => {
        expect(await liquidityProtectionStats.providerPools(provider.address)).to.empty;
        await liquidityProtectionStats.connect(owner).addProviderPool(provider.address, poolToken.address);
        expect(await liquidityProtectionStats.providerPools(provider.address)).to.equalTo([poolToken.address]);
    });

    it('should succeed when the owner attempts to remove a provider pool', async () => {
        await liquidityProtectionStats.connect(owner).addProviderPool(provider.address, poolToken.address);
        expect(await liquidityProtectionStats.providerPools(provider.address)).to.equalTo([poolToken.address]);
        await liquidityProtectionStats.connect(owner).removeProviderPool(provider.address, poolToken.address);
        expect(await liquidityProtectionStats.providerPools(provider.address)).to.empty;
    });

    it('should succeed when a seeder attempts to seed pool amounts', async () => {
        expect(await liquidityProtectionStats.totalPoolAmount(poolToken.address)).to.equal(BigNumber.from(0));
        await liquidityProtectionStats.connect(seeder).seedPoolAmounts([poolToken.address], [1]);
        expect(await liquidityProtectionStats.totalPoolAmount(poolToken.address)).to.equal(BigNumber.from(1));
    });

    it('should succeed when a seeder attempts to seed reserve amounts', async () => {
        expect(await liquidityProtectionStats.totalReserveAmount(poolToken.address, reserveToken.address)).to.equal(
            BigNumber.from(0)
        );
        await liquidityProtectionStats
            .connect(seeder)
            .seedReserveAmounts([poolToken.address], [reserveToken.address], [1]);
        expect(await liquidityProtectionStats.totalReserveAmount(poolToken.address, reserveToken.address)).to.equal(
            BigNumber.from(1)
        );
    });

    it('should succeed when a seeder attempts to seed provider amounts', async () => {
        expect(
            await liquidityProtectionStats.totalProviderAmount(
                provider.address,
                poolToken.address,
                reserveToken.address
            )
        ).to.equal(BigNumber.from(0));

        await liquidityProtectionStats
            .connect(seeder)
            .seedProviderAmounts([provider.address], [poolToken.address], [reserveToken.address], [1]);

        expect(
            await liquidityProtectionStats.totalProviderAmount(
                provider.address,
                poolToken.address,
                reserveToken.address
            )
        ).to.equal(BigNumber.from(1));
    });

    it('should succeed when a seeder attempts to seed provider pools', async () => {
        expect(await liquidityProtectionStats.providerPools(provider.address)).to.empty;

        await liquidityProtectionStats.connect(seeder).seedProviderPools([provider.address], [poolToken.address]);

        expect(await liquidityProtectionStats.providerPools(provider.address)).to.equalTo([poolToken.address]);
    });
});
