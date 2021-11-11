const { expect } = require('chai');
const { ethers } = require('hardhat');
const { BigNumber } = require('ethers');

const Contracts = require('../../components/Contracts').default;

const DUMMY_ADDRESS = '0x'.padEnd(42, 'f');

let liquidityProtectionStore;

let owner;
let nonOwner;
let provider;
let poolToken;
let reserveToken;
let accounts;

describe('LiquidityProtectionStore', () => {
    before(async () => {
        accounts = await ethers.getSigners();

        owner = accounts[0];
        nonOwner = accounts[1];
        provider = accounts[2];
        poolToken = accounts[3];
        reserveToken = accounts[4];
    });

    beforeEach(async () => {
        liquidityProtectionStore = await Contracts.LiquidityProtectionStore.deploy();
    });

    describe('general verification', () => {
        it('should revert when a non owner attempts to withdraw tokens', async () => {
            const erc20Token = await Contracts.TestStandardToken.deploy('TKN', 'TKN', 1);
            await erc20Token.transfer(liquidityProtectionStore.address, 1);
            await expect(
                liquidityProtectionStore.connect(nonOwner).withdrawTokens(erc20Token.address, owner.address, 1)
            ).to.be.revertedWith('ERR_ACCESS_DENIED');
            expect(await erc20Token.balanceOf(liquidityProtectionStore.address)).to.equal(BigNumber.from(1));
            expect(await erc20Token.balanceOf(owner.address)).to.equal(BigNumber.from(0));
        });

        it('should revert when a non owner attempts to increase system balance', async () => {
            await expect(
                liquidityProtectionStore.connect(nonOwner).incSystemBalance(owner.address, 1)
            ).to.be.revertedWith('ERR_ACCESS_DENIED');
            expect(await liquidityProtectionStore.systemBalance(owner.address)).to.equal(BigNumber.from(0));
        });

        it('should revert when a non owner attempts to decrease system balance', async () => {
            await liquidityProtectionStore.connect(owner).incSystemBalance(owner.address, 1);
            await expect(
                liquidityProtectionStore.connect(nonOwner).decSystemBalance(owner.address, 1)
            ).to.be.revertedWith('ERR_ACCESS_DENIED');
            expect(await liquidityProtectionStore.systemBalance(owner.address)).to.equal(BigNumber.from(1));
        });

        it('should succeed when the owner attempts to withdraw tokens', async () => {
            const erc20Token = await Contracts.TestStandardToken.deploy('TKN', 'TKN', 1);
            await erc20Token.transfer(liquidityProtectionStore.address, 1);
            await liquidityProtectionStore.connect(owner).withdrawTokens(erc20Token.address, owner.address, 1);
            expect(await erc20Token.balanceOf(liquidityProtectionStore.address)).to.equal(BigNumber.from(0));
            expect(await erc20Token.balanceOf(owner.address)).to.equal(BigNumber.from(1));
        });

        it('should succeed when the owner attempts to increase system balance', async () => {
            expect(await liquidityProtectionStore.systemBalance(owner.address)).to.equal(BigNumber.from(0));
            await expect(await liquidityProtectionStore.connect(owner).incSystemBalance(owner.address, 1))
                .to.emit(liquidityProtectionStore, 'SystemBalanceUpdated')
                .withArgs(owner.address, '0', '1');
            expect(await liquidityProtectionStore.systemBalance(owner.address)).to.equal(BigNumber.from(1));
        });

        it('should succeed when the owner attempts to decrease system balance', async () => {
            await liquidityProtectionStore.connect(owner).incSystemBalance(owner.address, 1);
            expect(await liquidityProtectionStore.systemBalance(owner.address)).to.equal(BigNumber.from(1));
            await expect(await liquidityProtectionStore.connect(owner).decSystemBalance(owner.address, 1))
                .to.emit(liquidityProtectionStore, 'SystemBalanceUpdated')
                .withArgs(owner.address, '1', '0');
            expect(await liquidityProtectionStore.systemBalance(owner.address)).to.equal(BigNumber.from(0));
        });
    });

    describe('protected liquidities basic verification', () => {
        it('should revert when a non owner attempts to add a protected-liquidity item', async () => {
            await expect(
                liquidityProtectionStore
                    .connect(nonOwner)
                    .addProtectedLiquidity(provider.address, poolToken.address, reserveToken.address, 1, 2, 3, 4, 5)
            ).to.be.revertedWith('ERR_ACCESS_DENIED');
        });

        it('should revert when a non owner attempts to update a protected-liquidity item', async () => {
            await liquidityProtectionStore
                .connect(owner)
                .addProtectedLiquidity(provider.address, poolToken.address, reserveToken.address, 1, 2, 3, 4, 5);
            await expect(
                liquidityProtectionStore.connect(nonOwner).updateProtectedLiquidityAmounts(0, 6, 7)
            ).to.be.revertedWith('ERR_ACCESS_DENIED');
        });

        it('should revert when a non owner attempts to remove a protected-liquidity item', async () => {
            await liquidityProtectionStore
                .connect(owner)
                .addProtectedLiquidity(provider.address, poolToken.address, reserveToken.address, 1, 2, 3, 4, 5);
            await expect(liquidityProtectionStore.connect(nonOwner).removeProtectedLiquidity(0)).to.be.revertedWith(
                'ERR_ACCESS_DENIED'
            );
        });

        it('should succeed when the owner attempts to add a protected-liquidity item', async () => {
            await expect(
                await liquidityProtectionStore
                    .connect(owner)
                    .addProtectedLiquidity(provider.address, poolToken.address, reserveToken.address, 1, 2, 3, 4, 5)
            )
                .to.emit(liquidityProtectionStore, 'ProtectionAdded')
                .withArgs(provider.address, poolToken.address, reserveToken.address, '1', '2');

            expect(await liquidityProtectionStore.totalProtectedPoolAmount(poolToken.address)).to.equal(
                BigNumber.from(1)
            );
            expect(
                await liquidityProtectionStore.totalProtectedReserveAmount(poolToken.address, reserveToken.address)
            ).to.equal(BigNumber.from(2));
        });

        it('should succeed when the owner attempts to update a protected-liquidity item', async () => {
            await liquidityProtectionStore
                .connect(owner)
                .addProtectedLiquidity(provider.address, poolToken.address, reserveToken.address, 1, 2, 3, 4, 5);

            await expect(await liquidityProtectionStore.connect(owner).updateProtectedLiquidityAmounts(0, 3, 4))
                .to.emit(liquidityProtectionStore, 'ProtectionUpdated')
                .withArgs(provider.address, '1', '2', '3', '4');

            expect(await liquidityProtectionStore.totalProtectedPoolAmount(poolToken.address)).to.equal('3');
            expect(
                await liquidityProtectionStore.totalProtectedReserveAmount(poolToken.address, reserveToken.address)
            ).to.equal('4');
        });

        it('should succeed when the owner attempts to remove a protected-liquidity item', async () => {
            await liquidityProtectionStore
                .connect(owner)
                .addProtectedLiquidity(provider.address, poolToken.address, reserveToken.address, 1, 2, 3, 4, 5);

            await expect(await liquidityProtectionStore.connect(owner).removeProtectedLiquidity(0))
                .to.emit(liquidityProtectionStore, 'ProtectionRemoved')
                .withArgs(provider.address, poolToken.address, reserveToken.address, '1', '2');

            expect(await liquidityProtectionStore.totalProtectedPoolAmount(poolToken.address)).to.equal(
                BigNumber.from(0)
            );
            expect(
                await liquidityProtectionStore.totalProtectedReserveAmount(poolToken.address, reserveToken.address)
            ).to.equal(BigNumber.from(0));
        });
    });

    describe('locked balances basic verification', () => {
        it('should revert when a non owner attempts to add a locked balance', async () => {
            await expect(
                liquidityProtectionStore.connect(nonOwner).addLockedBalance(provider.address, 1, 2)
            ).to.be.revertedWith('ERR_ACCESS_DENIED');
            expect(await liquidityProtectionStore.lockedBalanceCount(provider.address)).to.equal(BigNumber.from(0));
        });

        it('should revert when a non owner attempts to remove a locked balance', async () => {
            await liquidityProtectionStore.connect(owner).addLockedBalance(provider.address, 1, 2);
            await expect(
                liquidityProtectionStore.connect(nonOwner).removeLockedBalance(provider.address, 0)
            ).to.be.revertedWith('ERR_ACCESS_DENIED');
            expect(await liquidityProtectionStore.lockedBalanceCount(provider.address)).to.equal(BigNumber.from(1));
        });

        it('should succeed when the owner attempts to add a locked balance', async () => {
            expect(await liquidityProtectionStore.lockedBalanceCount(provider.address)).to.equal(BigNumber.from(0));
            await expect(await liquidityProtectionStore.connect(owner).addLockedBalance(provider.address, 1, 2))
                .to.emit(liquidityProtectionStore, 'BalanceLocked')
                .withArgs(provider.address, '1', '2');
            expect(await liquidityProtectionStore.lockedBalanceCount(provider.address)).to.equal(BigNumber.from(1));
        });

        it('should succeed when the owner attempts to remove a locked balance', async () => {
            await liquidityProtectionStore.connect(owner).addLockedBalance(provider.address, 1, 2);
            expect(await liquidityProtectionStore.lockedBalanceCount(provider.address)).to.equal(BigNumber.from(1));
            await expect(await liquidityProtectionStore.connect(owner).removeLockedBalance(provider.address, 0))
                .to.emit(liquidityProtectionStore, 'BalanceUnlocked')
                .withArgs(provider.address, '1');
            expect(await liquidityProtectionStore.lockedBalanceCount(provider.address)).to.equal(BigNumber.from(0));
        });
    });

    describe('locked balances range verification', () => {
        it('should revert when start-index is equal to end-index', async () => {
            for (let amount = 1; amount <= 10; amount++) {
                await liquidityProtectionStore.connect(owner).addLockedBalance(provider.address, amount, 1);
            }
            await expect(
                liquidityProtectionStore.connect(owner).lockedBalanceRange(provider.address, 0, 0)
            ).to.be.revertedWith('ERR_INVALID_INDICES');
        });

        it('should revert when start-index is larger than end-index', async () => {
            for (let amount = 1; amount <= 10; amount++) {
                await liquidityProtectionStore.connect(owner).addLockedBalance(provider.address, amount, 1);
            }
            await expect(
                liquidityProtectionStore.connect(owner).lockedBalanceRange(provider.address, 1, 0)
            ).to.be.revertedWith('ERR_INVALID_INDICES');
        });

        it('should succeed when start-index is smaller than end-index', async () => {
            for (let amount = 1; amount <= 10; amount++) {
                await liquidityProtectionStore.connect(owner).addLockedBalance(provider.address, amount, 1);
            }
            const range = await liquidityProtectionStore.lockedBalanceRange(provider.address, 3, 8);
            for (let i = 0; i < range[0].length; i++) expect(range[0][i]).to.equal(BigNumber.from(i + 4));
        });

        it('should succeed when end-index is larger than the total number of items', async () => {
            for (let amount = 1; amount <= 10; amount++) {
                await liquidityProtectionStore.connect(owner).addLockedBalance(provider.address, amount, 1);
            }
            const range = await liquidityProtectionStore.lockedBalanceRange(provider.address, 8, 1000);
            for (let i = 0; i < range[0].length; i++) expect(range[0][i]).to.equal(BigNumber.from(i + 9));
        });
    });

    describe('protected liquidities advanced verification', () => {
        const removeAllOneByOne = async (direction) => {
            console.log(`adding ${accounts.length} items...`);
            for (const account of accounts) {
                await liquidityProtectionStore
                    .connect(owner)
                    .addProtectedLiquidity(provider.address, account.address, DUMMY_ADDRESS, 1, 2, 3, 4, 5);
            }
            for (let items = accounts.slice(); items.length > 0; items.length--) {
                const index = ((items.length - 1) * (1 - direction)) / 2;
                const id = await liquidityProtectionStore.protectedLiquidityId(provider.address, index);
                const item = (await liquidityProtectionStore.protectedLiquidity(id))[1];
                expect(item).to.equal(items[index].address);
                items[index] = items[items.length - 1];
                await liquidityProtectionStore.connect(owner).removeProtectedLiquidity(id);
                console.log(`item ${index} removed`);
            }
            expect(await liquidityProtectionStore.protectedLiquidityCount(provider.address)).to.equal(
                BigNumber.from(0)
            );
            expect((await liquidityProtectionStore.protectedLiquidityIds(provider.address)).length).to.equal(0);
        };

        it('remove first item until all items removed', async function () {
            await removeAllOneByOne(+1);
        });

        it('remove last item until all items removed', async function () {
            await removeAllOneByOne(-1);
        });
    });

    describe('locked balances advanced verification', () => {
        const removeAllOneByOne = async (direction) => {
            const acc = accounts.slice(1); // removing the first account
            console.log(`adding ${acc.length} items...`);
            for (const account of acc) {
                await liquidityProtectionStore
                    .connect(owner)
                    .addLockedBalance(provider.address, await account.getBalance(), 1);
            }
            for (let items = acc.slice(); items.length > 0; items.length--) {
                const bgnIndex = ((items.length - 1) * (1 - direction)) / 2;
                const endIndex = ((items.length - 1) * (1 + direction)) / 2;
                const item = (await liquidityProtectionStore.lockedBalance(provider.address, bgnIndex))[0];
                await liquidityProtectionStore.connect(owner).removeLockedBalance(provider.address, bgnIndex);
                expect(item).to.equal(await items[bgnIndex].getBalance());
                items[bgnIndex] = items[endIndex];
                console.log(`item ${bgnIndex} removed`);
            }
            expect(await liquidityProtectionStore.lockedBalanceCount(provider.address)).to.equal(BigNumber.from(0));
        };

        it('remove first item until all items removed', async () => {
            await removeAllOneByOne(+1);
        });

        it('remove last item until all items removed', async () => {
            await removeAllOneByOne(-1);
        });
    });
});
