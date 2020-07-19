const { expect } = require('chai');
const { expectRevert, BN, time, constants } = require('@openzeppelin/test-helpers');

const { duration, latest } = time;
const { ZERO_ADDRESS } = constants;

const PriceOracle = artifacts.require('PriceOracle');
const ChainlinkPriceOracle = artifacts.require('TestChainlinkPriceOracle');

contract('PriceOracle', accounts => {
    const TOKEN_A_ADDRESS = accounts[8];
    const TOKEN_B_ADDRESS = accounts[9];

    let oracle;
    let chainlinkOracleA;
    let chainlinkOracleB;

    beforeEach(async () => {
        chainlinkOracleA = await ChainlinkPriceOracle.new();
        chainlinkOracleB = await ChainlinkPriceOracle.new();
        await chainlinkOracleA.setAnswer(10000);
        await chainlinkOracleB.setAnswer(20000);
        await chainlinkOracleA.setTimestamp(5000);
        await chainlinkOracleB.setTimestamp(5010);

        oracle = await PriceOracle.new(TOKEN_A_ADDRESS, TOKEN_B_ADDRESS, chainlinkOracleA.address, chainlinkOracleB.address);
    });

    it('verifies oracle state after construction', async () => {
        expect(await oracle.tokenA.call()).to.eql(TOKEN_A_ADDRESS);
        expect(await oracle.tokenB.call()).to.eql(TOKEN_B_ADDRESS);

        expect(await oracle.tokenAOracle.call()).to.eql(chainlinkOracleA.address);
        expect(await oracle.tokenBOracle.call()).to.eql(chainlinkOracleB.address);
    });

    it('should revert when attempting to construct a price oracle with zero token A address', async () => {
        const chainlinkOracleA = await ChainlinkPriceOracle.new();
        const chainlinkOracleB = await ChainlinkPriceOracle.new();
        await chainlinkOracleA.setAnswer(10000);
        await chainlinkOracleB.setAnswer(20000);
        await chainlinkOracleA.setTimestamp(5000);
        await chainlinkOracleB.setTimestamp(5010);
        await expectRevert(PriceOracle.new(ZERO_ADDRESS, TOKEN_B_ADDRESS, chainlinkOracleA.address, chainlinkOracleB.address),
            'ERR_INVALID_ADDRESS');
    });

    it('should revert when attempting to construct a price oracle with zero token B address', async () => {
        const chainlinkOracleA = await ChainlinkPriceOracle.new();
        const chainlinkOracleB = await ChainlinkPriceOracle.new();
        await chainlinkOracleA.setAnswer(10000);
        await chainlinkOracleB.setAnswer(20000);
        await chainlinkOracleA.setTimestamp(5000);
        await chainlinkOracleB.setTimestamp(5010);
        await expectRevert(PriceOracle.new(TOKEN_A_ADDRESS, ZERO_ADDRESS, chainlinkOracleA.address, chainlinkOracleB.address),
            'ERR_INVALID_ADDRESS');
    });

    it('should revert when attempting to construct a price oracle with same tokens', async () => {
        const chainlinkOracleA = await ChainlinkPriceOracle.new();
        const chainlinkOracleB = await ChainlinkPriceOracle.new();
        await chainlinkOracleA.setAnswer(10000);
        await chainlinkOracleB.setAnswer(20000);
        await chainlinkOracleA.setTimestamp(5000);
        await chainlinkOracleB.setTimestamp(5010);
        await expectRevert(PriceOracle.new(TOKEN_A_ADDRESS, TOKEN_A_ADDRESS, chainlinkOracleA.address, chainlinkOracleB.address),
            'ERR_SAME_ADDRESS');
    });

    it('should revert when attempting to construct a price oracle with zero chainlink oracle A address', async () => {
        const chainlinkOracleB = await ChainlinkPriceOracle.new();
        await chainlinkOracleB.setAnswer(20000);
        await chainlinkOracleB.setTimestamp(5010);
        await expectRevert(PriceOracle.new(TOKEN_A_ADDRESS, TOKEN_B_ADDRESS, ZERO_ADDRESS, chainlinkOracleB.address),
            'ERR_INVALID_ADDRESS');
    });

    it('should revert when attempting to construct a price oracle with zero chainlink oracle B address', async () => {
        const chainlinkOracleA = await ChainlinkPriceOracle.new();
        await chainlinkOracleA.setAnswer(10000);
        await chainlinkOracleA.setTimestamp(5000);
        await expectRevert(PriceOracle.new(TOKEN_A_ADDRESS, TOKEN_B_ADDRESS, chainlinkOracleA.address, ZERO_ADDRESS),
            'ERR_INVALID_ADDRESS');
    });

    it('should revert when attempting to construct a price oracle with same chainlink oracles', async () => {
        const chainlinkOracleA = await ChainlinkPriceOracle.new();
        await chainlinkOracleA.setAnswer(10000);
        await chainlinkOracleA.setTimestamp(5000);
        await expectRevert(PriceOracle.new(TOKEN_A_ADDRESS, TOKEN_B_ADDRESS, chainlinkOracleA.address, chainlinkOracleA.address),
            'ERR_SAME_ADDRESS');
    });

    it('verifies that latestRate returns the rates from both oracles in the correct order', async () => {
        const rate = await oracle.latestRate.call(TOKEN_A_ADDRESS, TOKEN_B_ADDRESS);
        expect(rate[0]).to.be.bignumber.equal(new BN(10000));
        expect(rate[1]).to.be.bignumber.equal(new BN(20000));

        await chainlinkOracleA.setAnswer(500000);
        await chainlinkOracleB.setAnswer(300000);

        const rate2 = await oracle.latestRate.call(TOKEN_B_ADDRESS, TOKEN_A_ADDRESS);
        expect(rate2[0]).to.be.bignumber.equal(new BN(300000));
        expect(rate2[1]).to.be.bignumber.equal(new BN(500000));
    });

    it('should revert when attempting to get the rate with zero token A address', async () => {
        await expectRevert(oracle.latestRate.call(ZERO_ADDRESS, TOKEN_B_ADDRESS), 'ERR_INVALID_ADDRESS');
    });

    it('should revert when attempting to get the rate with zero token B address', async () => {
        await expectRevert(oracle.latestRate.call(TOKEN_A_ADDRESS, ZERO_ADDRESS), 'ERR_INVALID_ADDRESS');
    });

    it('should revert when attempting to get the rate with an unsupported token', async () => {
        await expectRevert(oracle.latestRate.call(TOKEN_A_ADDRESS, accounts[5]), 'ERR_UNSUPPORTED_TOKEN');
    });

    it('should revert when attempting to get the rate for the same tokens', async () => {
        await expectRevert(oracle.latestRate.call(TOKEN_A_ADDRESS, TOKEN_A_ADDRESS), 'ERR_SAME_ADDRESS');
    });

    it('verifies that lastUpdateTime returns the earliest timestamp', async () => {
        const now = await latest();
        const timestampA = now;
        let timestampB = timestampA.add(duration.hours(3));
        await chainlinkOracleA.setTimestamp(timestampA);
        await chainlinkOracleB.setTimestamp(timestampB);

        expect(await oracle.lastUpdateTime.call()).to.be.bignumber.equal(BN.min(timestampA, timestampB));

        timestampB = timestampA.sub(duration.days(1));
        await chainlinkOracleB.setTimestamp(timestampB);

        expect(await oracle.lastUpdateTime.call()).to.be.bignumber.equal(BN.min(timestampA, timestampB));
    });

    it('verifies that latestRateAndUpdateTime returns the rate and earliest timestamp in the correct order', async () => {
        const now = await latest();
        const timestampA = now;
        let timestampB = timestampA.add(duration.hours(3));
        await chainlinkOracleA.setTimestamp(timestampA);
        await chainlinkOracleB.setTimestamp(timestampB);

        const rateAndStatus = await oracle.latestRateAndUpdateTime.call(TOKEN_A_ADDRESS, TOKEN_B_ADDRESS);
        expect(rateAndStatus[0]).to.be.bignumber.equal(new BN(10000));
        expect(rateAndStatus[1]).to.be.bignumber.equal(new BN(20000));
        expect(rateAndStatus[2]).to.be.bignumber.equal(BN.min(timestampA, timestampB));

        timestampB = timestampA.sub(duration.days(1));
        await chainlinkOracleA.setAnswer(4700000);
        await chainlinkOracleB.setAnswer(28000);
        await chainlinkOracleB.setTimestamp(timestampB);

        const rateAndStatus2 = await oracle.latestRateAndUpdateTime.call(TOKEN_B_ADDRESS, TOKEN_A_ADDRESS);
        expect(rateAndStatus2[0]).to.be.bignumber.equal(new BN(28000));
        expect(rateAndStatus2[1]).to.be.bignumber.equal(new BN(4700000));
        expect(rateAndStatus2[2]).to.be.bignumber.equal(BN.min(timestampA, timestampB));
    });

    it('should revert when attempting to get latestRateAndUpdateTime for the same token', async () => {
        await expectRevert(oracle.latestRateAndUpdateTime.call(TOKEN_A_ADDRESS, TOKEN_A_ADDRESS), 'ERR_SAME_ADDRESS');
    });
});
