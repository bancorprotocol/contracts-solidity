const { accounts, defaultSender, contract } = require('@openzeppelin/test-environment');
const { expectRevert, expectEvent, BN } = require('@openzeppelin/test-helpers');
const { roles } = require('./helpers/Constants');
const { expect } = require('../../chai-local');

const LiquidityProtectionUserStore = contract.fromArtifact('LiquidityProtectionUserStore');

describe('LiquidityProtectionUserStore', () => {
    let liquidityProtectionUserStore;

    const owner = accounts[1];
    const seeder = accounts[2];
    const provider = accounts[2];
    const poolToken = accounts[3];
    const reserveToken = accounts[4];

    beforeEach(async () => {
        liquidityProtectionUserStore = await LiquidityProtectionUserStore.new();
        await liquidityProtectionUserStore.grantRole(roles.ROLE_OWNER, owner);
        await liquidityProtectionUserStore.grantRole(roles.ROLE_SEEDER, seeder);
    });

    describe('positions basic verification', () => {
        it('should revert when a non owner attempts to add a position item', async () => {
            await expectRevert(
                liquidityProtectionUserStore.addPosition(provider, poolToken, reserveToken, 1, 2, 3, 4, 5, {
                    from: defaultSender
                }),
                'ERR_ACCESS_DENIED'
            );
        });

        it('should revert when a non owner attempts to update a position item', async () => {
            await liquidityProtectionUserStore.addPosition(provider, poolToken, reserveToken, 1, 2, 3, 4, 5, {
                from: owner
            });
            await expectRevert(
                liquidityProtectionUserStore.updatePositionAmounts(0, 6, 7, { from: defaultSender }),
                'ERR_ACCESS_DENIED'
            );
        });

        it('should revert when a non owner attempts to remove a position item', async () => {
            await liquidityProtectionUserStore.addPosition(provider, poolToken, reserveToken, 1, 2, 3, 4, 5, {
                from: owner
            });
            await expectRevert(
                liquidityProtectionUserStore.removePosition(0, { from: defaultSender }),
                'ERR_ACCESS_DENIED'
            );
        });

        it('should succeed when the owner attempts to add a position item', async () => {
            const response = await liquidityProtectionUserStore.addPosition(
                provider,
                poolToken,
                reserveToken,
                1,
                2,
                3,
                4,
                5,
                { from: owner }
            );
            const expectedEvent = {
                provider: provider,
                poolToken: poolToken,
                reserveToken: reserveToken,
                poolAmount: '1',
                reserveAmount: '2'
            };
            expectEvent(response, 'PositionAdded', expectedEvent);
        });

        it('should succeed when the owner attempts to update a position item', async () => {
            await liquidityProtectionUserStore.addPosition(provider, poolToken, reserveToken, 11, 22, 3, 4, 5, {
                from: owner
            });
            const response = await liquidityProtectionUserStore.updatePositionAmounts(0, 1, 2, { from: owner });
            const expectedEvent = {
                provider: provider,
                poolToken: poolToken,
                reserveToken: reserveToken,
                deltaPoolAmount: '10',
                deltaReserveAmount: '20'
            };
            expectEvent(response, 'PositionUpdated', expectedEvent);
        });

        it('should succeed when the owner attempts to remove a position item', async () => {
            await liquidityProtectionUserStore.addPosition(provider, poolToken, reserveToken, 1, 2, 3, 4, 5, {
                from: owner
            });
            const response = await liquidityProtectionUserStore.removePosition(0, { from: owner });
            const expectedEvent = {
                provider: provider,
                poolToken: poolToken,
                reserveToken: reserveToken,
                poolAmount: '1',
                reserveAmount: '2'
            };
            expectEvent(response, 'PositionRemoved', expectedEvent);
        });
    });

    describe('locked balances basic verification', () => {
        it('should revert when a non owner attempts to add a locked balance', async () => {
            await expectRevert(
                liquidityProtectionUserStore.addLockedBalance(provider, 1, 2, { from: defaultSender }),
                'ERR_ACCESS_DENIED'
            );
            expect(await liquidityProtectionUserStore.lockedBalanceCount(provider)).to.be.bignumber.equal('0');
        });

        it('should revert when a non owner attempts to remove a locked balance', async () => {
            await liquidityProtectionUserStore.addLockedBalance(provider, 1, 2, { from: owner });
            await expectRevert(
                liquidityProtectionUserStore.removeLockedBalance(provider, 0, { from: defaultSender }),
                'ERR_ACCESS_DENIED'
            );
            expect(await liquidityProtectionUserStore.lockedBalanceCount(provider)).to.be.bignumber.equal('1');
        });

        it('should revert when a non seeder attempts to seed locked balances', async () => {
            await expectRevert(liquidityProtectionUserStore.seedLockedBalances([provider], [1], [1]), 'ERR_ACCESS_DENIED');
            expect(await liquidityProtectionUserStore.lockedBalanceCount(provider)).to.be.bignumber.equal('0');
        });

        it('should succeed when the owner attempts to add a locked balance', async () => {
            expect(await liquidityProtectionUserStore.lockedBalanceCount(provider)).to.be.bignumber.equal('0');
            const response = await liquidityProtectionUserStore.addLockedBalance(provider, 1, 2, { from: owner });
            expect(await liquidityProtectionUserStore.lockedBalanceCount(provider)).to.be.bignumber.equal('1');
            expectEvent(response, 'BalanceLocked', { provider: provider, amount: '1', expirationTime: '2' });
        });

        it('should succeed when the owner attempts to remove a locked balance', async () => {
            await liquidityProtectionUserStore.addLockedBalance(provider, 1, 2, { from: owner });
            expect(await liquidityProtectionUserStore.lockedBalanceCount(provider)).to.be.bignumber.equal('1');
            const response = await liquidityProtectionUserStore.removeLockedBalance(provider, 0, { from: owner });
            expect(await liquidityProtectionUserStore.lockedBalanceCount(provider)).to.be.bignumber.equal('0');
            expectEvent(response, 'BalanceUnlocked', { provider: provider, amount: '1' });
        });

        it('should succeed when a seeder attempts to seed locked balances', async () => {
            expect(await liquidityProtectionUserStore.lockedBalanceCount(provider)).to.be.bignumber.equal('0');
            await liquidityProtectionUserStore.seedLockedBalances([provider], [2], [3], { from: seeder });
            expect(await liquidityProtectionUserStore.lockedBalanceCount(provider)).to.be.bignumber.equal('1');
            expect((await liquidityProtectionUserStore.lockedBalance(provider, 0))[0]).to.be.bignumber.equal('2');
            expect((await liquidityProtectionUserStore.lockedBalance(provider, 0))[1]).to.be.bignumber.equal('3');
        });

        it('should succeed when a seeder attempts to clear locked balances', async () => {
            expect(await liquidityProtectionUserStore.lockedBalanceCount(provider)).to.be.bignumber.equal('0');
            await liquidityProtectionUserStore.seedLockedBalances([provider], [1], [1], { from: seeder });
            expect(await liquidityProtectionUserStore.lockedBalanceCount(provider)).to.be.bignumber.equal('1');
            await liquidityProtectionUserStore.seedLockedBalances([provider], [0], [0], { from: seeder });
            expect(await liquidityProtectionUserStore.lockedBalanceCount(provider)).to.be.bignumber.equal('0');
        });
    });

    describe('locked balances range verification', () => {
        it('should revert when start-index is equal to end-index', async () => {
            for (let amount = 1; amount <= 10; amount++)
                await liquidityProtectionUserStore.addLockedBalance(provider, amount, 1, { from: owner });
            await expectRevert(
                liquidityProtectionUserStore.lockedBalanceRange(provider, 0, 0, { from: owner }),
                'ERR_INVALID_INDICES'
            );
        });

        it('should revert when start-index is larger than end-index', async () => {
            for (let amount = 1; amount <= 10; amount++)
                await liquidityProtectionUserStore.addLockedBalance(provider, amount, 1, { from: owner });
            await expectRevert(
                liquidityProtectionUserStore.lockedBalanceRange(provider, 1, 0, { from: owner }),
                'ERR_INVALID_INDICES'
            );
        });

        it('should succeed when start-index is smaller than end-index', async () => {
            for (let amount = 1; amount <= 10; amount++)
                await liquidityProtectionUserStore.addLockedBalance(provider, amount, 1, { from: owner });
            const range = await liquidityProtectionUserStore.lockedBalanceRange(provider, 3, 8);
            for (let i = 0; i < range.length; i++) expect(range[i][0]).to.be.bignumber.equal(new BN(i + 3));
        });

        it('should succeed when end-index is larger than the total number of items', async () => {
            for (let amount = 1; amount <= 10; amount++)
                await liquidityProtectionUserStore.addLockedBalance(provider, amount, 1, { from: owner });
            const range = await liquidityProtectionUserStore.lockedBalanceRange(provider, 8, 1000);
            for (let i = 0; i < range.length; i++) expect(range[i][0]).to.be.bignumber.equal(new BN(i + 8));
        });
    });

    describe('positions advanced verification', () => {
        const removeAllOneByOne = async (direction) => {
            console.log(`adding ${accounts.length} items...`);
            for (const account of accounts) {
                await liquidityProtectionUserStore.addPosition(provider, account, reserveToken, 1, 2, 3, 4, 5, {
                    from: owner
                });
            }
            for (let items = accounts.slice(); items.length > 0; items.length--) {
                const index = ((items.length - 1) * (1 - direction)) / 2;
                const id = await liquidityProtectionUserStore.positionId(provider, index);
                const item = (await liquidityProtectionUserStore.position(id))[1];
                expect(item).to.be.equal(items[index]);
                items[index] = items[items.length - 1];
                await liquidityProtectionUserStore.removePosition(id, { from: owner });
                console.log(`item ${index} removed`);
            }
            expect(await liquidityProtectionUserStore.positionCount(provider)).to.be.bignumber.equal('0');
            expect((await liquidityProtectionUserStore.positionIds(provider)).length).to.be.equal(0);
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
            console.log(`adding ${accounts.length} items...`);
            for (const account of accounts) {
                await liquidityProtectionUserStore.addLockedBalance(provider, new BN(account), 1, {
                    from: owner
                });
            }
            for (let items = accounts.slice(); items.length > 0; items.length--) {
                const bgnIndex = ((items.length - 1) * (1 - direction)) / 2;
                const endIndex = ((items.length - 1) * (1 + direction)) / 2;
                const item = (await liquidityProtectionUserStore.lockedBalance(provider, bgnIndex))[0];
                await liquidityProtectionUserStore.removeLockedBalance(provider, bgnIndex, { from: owner });
                expect(item).to.be.bignumber.equal(new BN(items[bgnIndex]));
                items[bgnIndex] = items[endIndex];
                console.log(`item ${bgnIndex} removed`);
            }
            expect(await liquidityProtectionUserStore.lockedBalanceCount(provider)).to.be.bignumber.equal('0');
        };

        it('remove first item until all items removed', async () => {
            await removeAllOneByOne(+1);
        });

        it('remove last item until all items removed', async () => {
            await removeAllOneByOne(-1);
        });
    });
});
