const { expect } = require('chai');
const { ethers } = require('hardhat');
const { BigNumber } = require('ethers');

const { roles } = require('../helpers/Constants');

const Contracts = require('../../components/Contracts').default;

let liquidityProtectionSystemStore;

let owner;
let token;
let anchor;
let accounts;

describe('LiquidityProtectionSystemStore', () => {
    before(async () => {
        accounts = await ethers.getSigners();

        owner = accounts[1];
        token = accounts[2];
        anchor = accounts[3];
    });

    beforeEach(async () => {
        liquidityProtectionSystemStore = await Contracts.LiquidityProtectionSystemStore.deploy();
        await liquidityProtectionSystemStore.grantRole(roles.ROLE_OWNER, owner.address);
    });

    it('should revert when a non owner attempts to increase system balance', async () => {
        await expect(liquidityProtectionSystemStore.incSystemBalance(token.address, 1)).to.be.revertedWith(
            'ERR_ACCESS_DENIED'
        );
        expect(await liquidityProtectionSystemStore.systemBalance(token.address)).to.equal(BigNumber.from(0));
    });

    it('should revert when a non owner attempts to decrease system balance', async () => {
        await liquidityProtectionSystemStore.connect(owner).incSystemBalance(token.address, 1);
        await expect(liquidityProtectionSystemStore.decSystemBalance(token.address, 1)).to.be.revertedWith(
            'ERR_ACCESS_DENIED'
        );
        expect(await liquidityProtectionSystemStore.systemBalance(token.address)).to.equal(BigNumber.from(1));
    });

    it('should succeed when an owner attempts to increase system balance', async () => {
        await expect(await liquidityProtectionSystemStore.connect(owner).incSystemBalance(token.address, 1))
            .to.emit(liquidityProtectionSystemStore, 'SystemBalanceUpdated')
            .withArgs(token.address, '0', '1');
        expect(await liquidityProtectionSystemStore.systemBalance(token.address)).to.equal(BigNumber.from(1));
    });

    it('should succeed when an owner attempts to decrease system balance', async () => {
        await liquidityProtectionSystemStore.connect(owner).incSystemBalance(token.address, 1);
        expect(await liquidityProtectionSystemStore.systemBalance(token.address)).to.equal(BigNumber.from(1));
        await expect(await liquidityProtectionSystemStore.connect(owner).decSystemBalance(token.address, 1))
            .to.emit(liquidityProtectionSystemStore, 'SystemBalanceUpdated')
            .withArgs(token.address, '1', '0');
        expect(await liquidityProtectionSystemStore.systemBalance(token.address)).to.equal(BigNumber.from(0));
    });

    it('should revert when a non owner attempts to increase network tokens minted', async () => {
        await expect(liquidityProtectionSystemStore.incNetworkTokensMinted(anchor.address, 1)).to.be.revertedWith(
            'ERR_ACCESS_DENIED'
        );
        expect(await liquidityProtectionSystemStore.networkTokensMinted(anchor.address)).to.equal(BigNumber.from(0));
    });

    it('should revert when a non owner attempts to decrease network tokens minted', async () => {
        await liquidityProtectionSystemStore.connect(owner).incNetworkTokensMinted(anchor.address, 1);
        await expect(liquidityProtectionSystemStore.decNetworkTokensMinted(anchor.address, 1)).to.be.revertedWith(
            'ERR_ACCESS_DENIED'
        );
        expect(await liquidityProtectionSystemStore.networkTokensMinted(anchor.address)).to.equal(BigNumber.from(1));
    });

    it('should succeed when an owner attempts to increase network tokens minted', async () => {
        await expect(await liquidityProtectionSystemStore.connect(owner).incNetworkTokensMinted(anchor.address, 1))
            .to.emit(liquidityProtectionSystemStore, 'NetworkTokensMintedUpdated')
            .withArgs(anchor.address, '0', '1');
        expect(await liquidityProtectionSystemStore.networkTokensMinted(anchor.address)).to.equal(BigNumber.from(1));
    });

    it('should succeed when an owner attempts to decrease network tokens minted', async () => {
        await liquidityProtectionSystemStore.connect(owner).incNetworkTokensMinted(anchor.address, 1);
        expect(await liquidityProtectionSystemStore.networkTokensMinted(anchor.address)).to.equal(BigNumber.from(1));
        await expect(await liquidityProtectionSystemStore.connect(owner).decNetworkTokensMinted(anchor.address, 1))
            .to.emit(liquidityProtectionSystemStore, 'NetworkTokensMintedUpdated')
            .withArgs(anchor.address, '1', '0');
        expect(await liquidityProtectionSystemStore.networkTokensMinted(anchor.address)).to.equal(BigNumber.from(0));
    });
});
