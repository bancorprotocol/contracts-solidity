const { expect } = require('chai');
const { expectRevert, BN } = require('@openzeppelin/test-helpers');

const PoolTokensContainer = artifacts.require('PoolTokensContainer');
const DSToken = artifacts.require('DSToken');

contract('PoolTokensContainer', (accounts) => {
    const MAX_POOL_TOKENS = 5;
    const sender = accounts[1];
    const nonOwner = accounts[2];

    it('verifies that construction succeeds', async () => {
        const container = await PoolTokensContainer.new('Pool', 'POOL', 18);

        expect(await container.name.call()).to.eql('Pool');
        expect(await container.symbol.call()).to.eql('POOL');
        expect(await container.decimals.call()).to.be.bignumber.equal(new BN(18));
    });

    it('should revert when attempting to construct a pool token container with invalid name', async () => {
        await expectRevert(PoolTokensContainer.new('', 'POOL', 18), 'ERR_INVALID_NAME');
    });

    it('should revert when attempting to construct a pool token container with invalid symbol', async () => {
        await expectRevert(PoolTokensContainer.new('Pool', '', 18), 'ERR_INVALID_SYMBOL');
    });

    it('verifies that adding a new pool token succeeds', async () => {
        const container = await PoolTokensContainer.new('Pool', 'POOL', 18);
        await container.createToken();

        const tokens = await container.poolTokens.call();
        const token = await DSToken.at(tokens[0]);

        expect(await token.name.call()).to.eql('Pool1');
        expect(await token.symbol.call()).to.eql('POOL1');
        expect(await token.decimals.call()).to.be.bignumber.equal(new BN(18));
    });

    it('verifies that adding a second pool token succeeds', async () => {
        const container = await PoolTokensContainer.new('Pool', 'POOL', 18);
        await container.createToken();
        await container.createToken();

        const tokens = await container.poolTokens.call();
        const token2 = await DSToken.at(tokens[1]);

        expect(await token2.name.call()).to.eql('Pool2');
        expect(await token2.symbol.call()).to.eql('POOL2');
        expect(await token2.decimals.call()).to.be.bignumber.equal(new BN(18));
    });

    it('should revert when attempting to create more than max tokens limit', async () => {
        const container = await PoolTokensContainer.new('Pool', 'POOL', 18);

        for (let i = 0; i < MAX_POOL_TOKENS; i++) {
            await container.createToken();
        }

        await expectRevert(container.createToken(), 'ERR_MAX_LIMIT_REACHED');
    });

    it('verifies that the owner can mint new pool tokens', async () => {
        const container = await PoolTokensContainer.new('Pool', 'POOL', 18);
        await container.createToken();

        const tokens = await container.poolTokens.call();
        const token = await DSToken.at(tokens[0]);

        const amount = new BN(100);
        await container.mint(token.address, sender, amount);

        const balance = await token.balanceOf.call(sender);
        expect(balance).to.be.bignumber.equal(amount);
    });

    it('should revert if a non owner attempts to mint new pool tokens', async () => {
        const container = await PoolTokensContainer.new('Pool', 'POOL', 18);
        await container.createToken();

        const tokens = await container.poolTokens.call();
        const token = await DSToken.at(tokens[0]);

        const amount = new BN(100);
        await expectRevert(container.mint(token.address, sender, amount, { from: nonOwner }), 'ERR_ACCESS_DENIED');
    });

    it('verifies that the owner can burn pool tokens', async () => {
        const container = await PoolTokensContainer.new('Pool', 'POOL', 18);
        await container.createToken();

        const tokens = await container.poolTokens.call();
        const token = await DSToken.at(tokens[0]);

        const amount = new BN(100);
        await container.mint(token.address, sender, amount);

        const balance = await token.balanceOf.call(sender);
        expect(balance).to.be.bignumber.equal(amount);

        const amount2 = new BN(20);
        await container.burn(token.address, sender, amount2);

        const balance2 = await token.balanceOf.call(sender);
        expect(balance2).to.be.bignumber.equal(balance.sub(amount2));
    });

    it('should revert if a non owner attempts to burn pool tokens', async () => {
        const container = await PoolTokensContainer.new('Pool', 'POOL', 18);
        await container.createToken();

        const tokens = await container.poolTokens.call();
        const token = await DSToken.at(tokens[0]);

        const amount = new BN(1000);
        await container.mint(token.address, sender, amount);

        const balance = await token.balanceOf.call(sender);
        expect(balance).to.be.bignumber.equal(amount);

        await expectRevert(container.burn(token.address, sender, amount, { from: nonOwner }), 'ERR_ACCESS_DENIED');
    });
});
