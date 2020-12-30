const { accounts, defaultSender, contract } = require('@openzeppelin/test-environment');
const { expectRevert, expectEvent, BN } = require('@openzeppelin/test-helpers');
const { expect } = require('../../chai-local');

const LiquidityProtectionStore = contract.fromArtifact('LiquidityProtectionStore');
const ERC20Token = contract.fromArtifact('ERC20Token');

const DUMMY_ADDRESS = '0x'.padEnd(42, 'f');

describe('LiquidityProtectionStore', () => {
    let liquidityProtectionStore;

    const owner = defaultSender;
    const nonOwner = accounts[1];
    const provider = accounts[2];
    const poolToken = accounts[3];
    const reserveToken = accounts[4];

    beforeEach(async () => {
        liquidityProtectionStore = await LiquidityProtectionStore.new();
    });

    describe('general verification', () => {
        it('should revert when a non owner attempts to withdraw tokens', async () => {
            const erc20Token = await ERC20Token.new('name', 'symbol', 0, 1);
            await erc20Token.transfer(liquidityProtectionStore.address, 1);
            await expectRevert(
                liquidityProtectionStore.withdrawTokens(erc20Token.address, defaultSender, 1, { from: nonOwner }),
                'ERR_ACCESS_DENIED'
            );
            expect(await erc20Token.balanceOf(liquidityProtectionStore.address)).to.be.bignumber.equal('1');
            expect(await erc20Token.balanceOf(defaultSender)).to.be.bignumber.equal('0');
        });

        it('should revert when a non owner attempts to increase system balance', async () => {
            await expectRevert(
                liquidityProtectionStore.incSystemBalance(defaultSender, 1, { from: nonOwner }),
                'ERR_ACCESS_DENIED'
            );
            expect(await liquidityProtectionStore.systemBalance(defaultSender)).to.be.bignumber.equal('0');
        });

        it('should revert when a non owner attempts to decrease system balance', async () => {
            await liquidityProtectionStore.incSystemBalance(defaultSender, 1, { from: owner });
            await expectRevert(
                liquidityProtectionStore.decSystemBalance(defaultSender, 1, { from: nonOwner }),
                'ERR_ACCESS_DENIED'
            );
            expect(await liquidityProtectionStore.systemBalance(defaultSender)).to.be.bignumber.equal('1');
        });

        it('should succeed when the owner attempts to withdraw tokens', async () => {
            const erc20Token = await ERC20Token.new('name', 'symbol', 0, 1);
            await erc20Token.transfer(liquidityProtectionStore.address, 1);
            await liquidityProtectionStore.withdrawTokens(erc20Token.address, defaultSender, 1, { from: owner });
            expect(await erc20Token.balanceOf(liquidityProtectionStore.address)).to.be.bignumber.equal('0');
            expect(await erc20Token.balanceOf(defaultSender)).to.be.bignumber.equal('1');
        });

        it('should succeed when the owner attempts to increase system balance', async () => {
            expect(await liquidityProtectionStore.systemBalance(defaultSender)).to.be.bignumber.equal('0');
            const response = await liquidityProtectionStore.incSystemBalance(defaultSender, 1, { from: owner });
            expect(await liquidityProtectionStore.systemBalance(defaultSender)).to.be.bignumber.equal('1');
            expectEvent(response, 'SystemBalanceUpdated', { _token: defaultSender, _prevAmount: '0', _newAmount: '1' });
        });

        it('should succeed when the owner attempts to decrease system balance', async () => {
            await liquidityProtectionStore.incSystemBalance(defaultSender, 1, { from: owner });
            expect(await liquidityProtectionStore.systemBalance(defaultSender)).to.be.bignumber.equal('1');
            const response = await liquidityProtectionStore.decSystemBalance(defaultSender, 1, { from: owner });
            expect(await liquidityProtectionStore.systemBalance(defaultSender)).to.be.bignumber.equal('0');
            expectEvent(response, 'SystemBalanceUpdated', { _token: defaultSender, _prevAmount: '1', _newAmount: '0' });
        });
    });

    describe('positions basic verification', () => {
        it('should revert when a non owner attempts to add a protected-liquidity item', async () => {
            await expectRevert(
                liquidityProtectionStore.addPosition(provider, poolToken, reserveToken, 1, 2, 3, 4, 5, {
                    from: nonOwner
                }),
                'ERR_ACCESS_DENIED'
            );
        });

        it('should revert when a non owner attempts to update a protected-liquidity item', async () => {
            await liquidityProtectionStore.addPosition(provider, poolToken, reserveToken, 1, 2, 3, 4, 5, {
                from: owner
            });
            await expectRevert(
                liquidityProtectionStore.updatePositionAmounts(0, 6, 7, { from: nonOwner }),
                'ERR_ACCESS_DENIED'
            );
        });

        it('should revert when a non owner attempts to remove a protected-liquidity item', async () => {
            await liquidityProtectionStore.addPosition(provider, poolToken, reserveToken, 1, 2, 3, 4, 5, {
                from: owner
            });
            await expectRevert(
                liquidityProtectionStore.removePosition(0, { from: nonOwner }),
                'ERR_ACCESS_DENIED'
            );
        });

        it('should succeed when the owner attempts to add a protected-liquidity item', async () => {
            const response = await liquidityProtectionStore.addPosition(
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
                _id: '0',
                _provider: provider,
                _poolToken: poolToken,
                _reserveToken: reserveToken,
                _poolAmount: '1',
                _reserveAmount: '2'
            };
            expectEvent(response, 'PositionAdded', expectedEvent);
        });

        it('should succeed when the owner attempts to update a protected-liquidity item', async () => {
            const oldPoolAmount = new BN(111);
            const newPoolAmount = new BN(333);
            const oldReserveAmount = new BN(999);
            const newReserveAmount = new BN(555);
            await liquidityProtectionStore.addPosition(provider, poolToken, reserveToken, oldPoolAmount, oldReserveAmount, 1, 2, 3, {
                from: owner
            });
            const response = await liquidityProtectionStore.updatePositionAmounts(0, newPoolAmount, newReserveAmount, { from: owner });
            const expectedEvent = {
                _id: '0',
                _provider: provider,
                _poolToken: poolToken,
                _reserveToken: reserveToken,
                _deltaPoolAmount: oldPoolAmount.sub(newPoolAmount),
                _deltaReserveAmount: oldReserveAmount.sub(newReserveAmount)
            };
            expectEvent(response, 'PositionUpdated', expectedEvent);
        });

        it('should succeed when the owner attempts to remove a protected-liquidity item', async () => {
            await liquidityProtectionStore.addPosition(provider, poolToken, reserveToken, 1, 2, 3, 4, 5, {
                from: owner
            });
            const response = await liquidityProtectionStore.removePosition(0, { from: owner });
            const expectedEvent = {
                _id: '0',
                _provider: provider,
                _poolToken: poolToken,
                _reserveToken: reserveToken,
                _poolAmount: '1',
                _reserveAmount: '2'
            };
            expectEvent(response, 'PositionRemoved', expectedEvent);
        });
    });

    describe('locked balances basic verification', () => {
        it('should revert when a non owner attempts to add a locked balance', async () => {
            await expectRevert(
                liquidityProtectionStore.addLockedBalance(provider, 1, 2, { from: nonOwner }),
                'ERR_ACCESS_DENIED'
            );
            expect(await liquidityProtectionStore.lockedBalanceCount(provider)).to.be.bignumber.equal('0');
        });

        it('should revert when a non owner attempts to remove a locked balance', async () => {
            await liquidityProtectionStore.addLockedBalance(provider, 1, 2, { from: owner });
            await expectRevert(
                liquidityProtectionStore.removeLockedBalance(provider, 0, { from: nonOwner }),
                'ERR_ACCESS_DENIED'
            );
            expect(await liquidityProtectionStore.lockedBalanceCount(provider)).to.be.bignumber.equal('1');
        });

        it('should succeed when the owner attempts to add a locked balance', async () => {
            expect(await liquidityProtectionStore.lockedBalanceCount(provider)).to.be.bignumber.equal('0');
            const response = await liquidityProtectionStore.addLockedBalance(provider, 1, 2, { from: owner });
            expect(await liquidityProtectionStore.lockedBalanceCount(provider)).to.be.bignumber.equal('1');
            expectEvent(response, 'BalanceLocked', { _provider: provider, _amount: '1', _expirationTime: '2' });
        });

        it('should succeed when the owner attempts to remove a locked balance', async () => {
            await liquidityProtectionStore.addLockedBalance(provider, 1, 2, { from: owner });
            expect(await liquidityProtectionStore.lockedBalanceCount(provider)).to.be.bignumber.equal('1');
            const response = await liquidityProtectionStore.removeLockedBalance(provider, 0, { from: owner });
            expect(await liquidityProtectionStore.lockedBalanceCount(provider)).to.be.bignumber.equal('0');
            expectEvent(response, 'BalanceUnlocked', { _provider: provider, _amount: '1' });
        });
    });

    describe('locked balances range verification', () => {
        it('should revert when start-index is equal to end-index', async () => {
            for (let amount = 1; amount <= 10; amount++)
                await liquidityProtectionStore.addLockedBalance(provider, amount, 1, { from: owner });
            await expectRevert(
                liquidityProtectionStore.lockedBalanceRange(provider, 0, 0, { from: owner }),
                'ERR_INVALID_INDICES'
            );
        });

        it('should revert when start-index is larger than end-index', async () => {
            for (let amount = 1; amount <= 10; amount++)
                await liquidityProtectionStore.addLockedBalance(provider, amount, 1, { from: owner });
            await expectRevert(
                liquidityProtectionStore.lockedBalanceRange(provider, 1, 0, { from: owner }),
                'ERR_INVALID_INDICES'
            );
        });

        it('should succeed when start-index is smaller than end-index', async () => {
            for (let amount = 1; amount <= 10; amount++)
                await liquidityProtectionStore.addLockedBalance(provider, amount, 1, { from: owner });
            const range = await liquidityProtectionStore.lockedBalanceRange(provider, 3, 8);
            for (let i = 0; i < range.length; i++) expect(range[i][0]).to.be.bignumber.equal(new BN(i + 3));
        });

        it('should succeed when end-index is larger than the total number of items', async () => {
            for (let amount = 1; amount <= 10; amount++)
                await liquidityProtectionStore.addLockedBalance(provider, amount, 1, { from: owner });
            const range = await liquidityProtectionStore.lockedBalanceRange(provider, 8, 1000);
            for (let i = 0; i < range.length; i++) expect(range[i][0]).to.be.bignumber.equal(new BN(i + 8));
        });
    });

    describe('positions advanced verification', () => {
        const removeAllOneByOne = async (direction) => {
            console.log(`adding ${accounts.length} items...`);
            for (const account of accounts)
                await liquidityProtectionStore.addPosition(provider, account, DUMMY_ADDRESS, 1, 2, 3, 4, 5, {
                    from: owner
                });
            for (let items = accounts.slice(); items.length > 0; items.length--) {
                const index = ((items.length - 1) * (1 - direction)) / 2;
                const id = await liquidityProtectionStore.positionId(provider, index);
                const item = (await liquidityProtectionStore.position(id))[1];
                expect(item).to.be.equal(items[index]);
                items[index] = items[items.length - 1];
                await liquidityProtectionStore.removePosition(id, { from: owner });
                console.log(`item ${index} removed`);
            }
            expect(await liquidityProtectionStore.positionCount(provider)).to.be.bignumber.equal('0');
            expect((await liquidityProtectionStore.positionIds(provider)).length).to.be.equal(0);
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
            for (const account of accounts)
                await liquidityProtectionStore.addLockedBalance(provider, new BN(account), 1);
            for (let items = accounts.slice(); items.length > 0; items.length--) {
                const bgnIndex = ((items.length - 1) * (1 - direction)) / 2;
                const endIndex = ((items.length - 1) * (1 + direction)) / 2;
                const item = (await liquidityProtectionStore.lockedBalance(provider, bgnIndex))[0];
                await liquidityProtectionStore.removeLockedBalance(provider, bgnIndex);
                expect(item).to.be.bignumber.equal(new BN(items[bgnIndex]));
                items[bgnIndex] = items[endIndex];
                console.log(`item ${bgnIndex} removed`);
            }
            expect(await liquidityProtectionStore.lockedBalanceCount(provider)).to.be.bignumber.equal('0');
        };

        it('remove first item until all items removed', async () => {
            await removeAllOneByOne(+1);
        });

        it('remove last item until all items removed', async () => {
            await removeAllOneByOne(-1);
        });
    });
});
