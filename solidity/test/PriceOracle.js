const { expect } = require('chai');
const { expectRevert, BN, time, constants } = require('@openzeppelin/test-helpers');

const { duration, latest } = time;
const { ZERO_ADDRESS } = constants;

const ERC20Token = artifacts.require('ERC20Token');
const TestNonStandardTokenWithoutDecimals = artifacts.require('TestNonStandardTokenWithoutDecimals');
const PriceOracle = artifacts.require('PriceOracle');
const ChainlinkPriceOracle = artifacts.require('TestChainlinkPriceOracle');

contract('PriceOracle', accounts => {
    let tokenA;
    let tokenB;
    const decimalsTokenA = new BN(18);
    const decimalsTokenB = new BN(18);
    let oracle;
    let chainlinkOracleA;
    let chainlinkOracleB;
    const initialRateA = new BN(10000);
    const initialRateB = new BN(20000);

    beforeEach(async () => {
        tokenA = await ERC20Token.new('ERC Token 1', 'ERC1', decimalsTokenA, 10000000000);
        tokenB = await ERC20Token.new('ERC Token 2', 'ERC2', decimalsTokenB, 10000000000);

        chainlinkOracleA = await ChainlinkPriceOracle.new();
        chainlinkOracleB = await ChainlinkPriceOracle.new();
        await chainlinkOracleA.setAnswer(initialRateA);
        await chainlinkOracleB.setAnswer(initialRateB);
        await chainlinkOracleA.setTimestamp(5000);
        await chainlinkOracleB.setTimestamp(5010);

        oracle = await PriceOracle.new(tokenA.address, tokenB.address, chainlinkOracleA.address, chainlinkOracleB.address);
    });

    it('verifies oracle state after construction', async () => {
        expect(await oracle.tokenA.call()).to.eql(tokenA.address);
        expect(await oracle.tokenDecimals.call(tokenA.address)).to.be.bignumber.equal(decimalsTokenA);
        expect(await oracle.tokenB.call()).to.eql(tokenB.address);
        expect(await oracle.tokenDecimals.call(tokenB.address)).to.be.bignumber.equal(decimalsTokenB);

        expect(await oracle.tokenAOracle.call()).to.eql(chainlinkOracleA.address);
        expect(await oracle.tokenBOracle.call()).to.eql(chainlinkOracleB.address);
    });

    it('should revert when attempting to construct a price oracle with zero token A address', async () => {
        await expectRevert(PriceOracle.new(ZERO_ADDRESS, tokenB.address, chainlinkOracleA.address, chainlinkOracleB.address),
            'ERR_INVALID_ADDRESS');
    });

    it('should revert when attempting to construct a price oracle with zero token B address', async () => {
        await expectRevert(PriceOracle.new(tokenA.address, ZERO_ADDRESS, chainlinkOracleA.address, chainlinkOracleB.address),
            'ERR_INVALID_ADDRESS');
    });

    it('should revert when attempting to construct a price oracle with same tokens', async () => {
        const chainlinkOracleA = await ChainlinkPriceOracle.new();
        const chainlinkOracleB = await ChainlinkPriceOracle.new();
        await chainlinkOracleA.setAnswer(10000);
        await chainlinkOracleB.setAnswer(20000);
        await chainlinkOracleA.setTimestamp(5000);
        await chainlinkOracleB.setTimestamp(5010);
        await expectRevert(PriceOracle.new(tokenA.address, tokenA.address, chainlinkOracleA.address, chainlinkOracleB.address),
            'ERR_SAME_ADDRESS');
    });

    it('should revert when attempting to construct a price oracle with zero chainlink oracle A address', async () => {
        await expectRevert(PriceOracle.new(tokenA.address, tokenB.address, ZERO_ADDRESS, chainlinkOracleB.address),
            'ERR_INVALID_ADDRESS');
    });

    it('should revert when attempting to construct a price oracle with zero chainlink oracle B address', async () => {
        await expectRevert(PriceOracle.new(tokenA.address, tokenB.address, chainlinkOracleA.address, ZERO_ADDRESS),
            'ERR_INVALID_ADDRESS');
    });

    it('should revert when attempting to construct a price oracle with same chainlink oracles', async () => {
        const chainlinkOracleA = await ChainlinkPriceOracle.new();
        await chainlinkOracleA.setAnswer(10000);
        await chainlinkOracleA.setTimestamp(5000);
        await expectRevert(PriceOracle.new(tokenA.address, tokenB.address, chainlinkOracleA.address, chainlinkOracleA.address),
            'ERR_SAME_ADDRESS');
    });

    it('should revert when attempting to construct a price oracle with a non-standard token A', async () => {
        await expectRevert.unspecified(PriceOracle.new(accounts[5], tokenB.address, chainlinkOracleA.address,
            chainlinkOracleB.address));

        const token = await TestNonStandardTokenWithoutDecimals.new('ERC Token 3', 'ERC3', 10000000000);
        await expectRevert.unspecified(PriceOracle.new(token.address, tokenB.address, chainlinkOracleA.address,
            chainlinkOracleB.address));
    });

    it('should revert when attempting to construct a price oracle with a non-standard token B', async () => {
        await expectRevert.unspecified(PriceOracle.new(tokenA.address, accounts[5], chainlinkOracleA.address,
            chainlinkOracleB.address));

        const token = await TestNonStandardTokenWithoutDecimals.new('ERC Token 3', 'ERC3', 10000000000);
        await expectRevert.unspecified(PriceOracle.new(tokenA.address, token.address, chainlinkOracleA.address,
            chainlinkOracleB.address));
    });

    it('should revert when attempting to get the rate with zero token A address', async () => {
        await expectRevert(oracle.latestRate.call(ZERO_ADDRESS, tokenB.address), 'ERR_INVALID_ADDRESS');
    });

    it('should revert when attempting to get the rate with zero token B address', async () => {
        await expectRevert(oracle.latestRate.call(tokenA.address, ZERO_ADDRESS), 'ERR_INVALID_ADDRESS');
    });

    it('should revert when attempting to get the rate with an unsupported token', async () => {
        await expectRevert(oracle.latestRate.call(tokenA.address, accounts[5]), 'ERR_UNSUPPORTED_TOKEN');
    });

    it('should revert when attempting to get the rate for the same tokens', async () => {
        await expectRevert(oracle.latestRate.call(tokenA.address, tokenA.address), 'ERR_SAME_ADDRESS');
    });

    it('verifies that lastUpdateTime returns the latest timestamp', async () => {
        const now = await latest();
        const timestampA = now;
        let timestampB = timestampA.add(duration.hours(3));
        await chainlinkOracleA.setTimestamp(timestampA);
        await chainlinkOracleB.setTimestamp(timestampB);

        expect(await oracle.lastUpdateTime.call()).to.be.bignumber.equal(BN.max(timestampA, timestampB));

        timestampB = timestampA.sub(duration.days(1));
        await chainlinkOracleB.setTimestamp(timestampB);

        expect(await oracle.lastUpdateTime.call()).to.be.bignumber.equal(BN.max(timestampA, timestampB));
    });

    for (const decimalsA of [4, 8, 10, 18]) {
        for (const decimalsB of [4, 8, 10, 18]) {
            const decimalsTokenA = new BN(decimalsA);
            const decimalsTokenB = new BN(decimalsB);

            context(`with decimals ${[decimalsA, decimalsB]}`, () => {
                const normalizedRate = (rate1, decimals1, rate2, decimals2) => {
                    if (decimals1.eq(decimals2)) {
                        return { n: rate1, d: rate2 };
                    }

                    if (decimals1.gt(decimals2)) {
                        return { n: rate1, d: rate2.mul(new BN(10).pow(decimals1.sub(decimals2))) };
                    }

                    return { n: rate1.mul(new BN(10).pow(decimals2.sub(decimals1))), d: rate2 };
                };

                beforeEach(async () => {
                    tokenA = await ERC20Token.new('ERC Token 1', 'ERC1', new BN(decimalsA), 10000000000);
                    tokenB = await ERC20Token.new('ERC Token 2', 'ERC2', new BN(decimalsB), 10000000000);

                    oracle = await PriceOracle.new(tokenA.address, tokenB.address, chainlinkOracleA.address, chainlinkOracleB.address);
                });

                it('verifies that latestRate returns the rates from both oracles in the correct order', async () => {
                    let expectedRate = normalizedRate(initialRateA, decimalsTokenA, initialRateB, decimalsTokenB);
                    const rate = await oracle.latestRate.call(tokenA.address, tokenB.address);
                    expect(rate[0]).to.be.bignumber.equal(expectedRate.n);
                    expect(rate[1]).to.be.bignumber.equal(expectedRate.d);

                    const newRateA = new BN(500000);
                    const newRateB = new BN(300000);
                    await chainlinkOracleA.setAnswer(newRateA);
                    await chainlinkOracleB.setAnswer(newRateB);

                    expectedRate = normalizedRate(newRateA, decimalsTokenA, newRateB, decimalsTokenB);
                    const rate2 = await oracle.latestRate.call(tokenB.address, tokenA.address);
                    expect(rate2[0]).to.be.bignumber.equal(expectedRate.d);
                    expect(rate2[1]).to.be.bignumber.equal(expectedRate.n);
                });

                it('verifies that latestRateAndUpdateTime returns the rate and latest timestamp in the correct order', async () => {
                    const now = await latest();
                    const timestampA = now;
                    let timestampB = timestampA.add(duration.hours(3));
                    await chainlinkOracleA.setTimestamp(timestampA);
                    await chainlinkOracleB.setTimestamp(timestampB);

                    let expectedRate = normalizedRate(initialRateA, decimalsTokenA, initialRateB, decimalsTokenB);
                    const rateAndStatus = await oracle.latestRateAndUpdateTime.call(tokenA.address, tokenB.address);
                    expect(rateAndStatus[0]).to.be.bignumber.equal(expectedRate.n);
                    expect(rateAndStatus[1]).to.be.bignumber.equal(expectedRate.d);
                    expect(rateAndStatus[2]).to.be.bignumber.equal(BN.max(timestampA, timestampB));

                    const newRateA = new BN(4700000);
                    const newRateB = new BN(28000);
                    await chainlinkOracleA.setAnswer(newRateA);
                    await chainlinkOracleB.setAnswer(newRateB);

                    timestampB = timestampA.sub(duration.days(1));
                    await chainlinkOracleB.setTimestamp(timestampB);

                    expectedRate = normalizedRate(newRateA, decimalsTokenA, newRateB, decimalsTokenB);
                    const rateAndStatus2 = await oracle.latestRateAndUpdateTime.call(tokenB.address, tokenA.address);
                    expect(rateAndStatus2[0]).to.be.bignumber.equal(expectedRate.d);
                    expect(rateAndStatus2[1]).to.be.bignumber.equal(expectedRate.n);
                    expect(rateAndStatus2[2]).to.be.bignumber.equal(BN.max(timestampA, timestampB));
                });
            });
        }
    }
});
