const { expect } = require('chai');
const { expectRevert, expectEvent, constants, BN, time } = require('@openzeppelin/test-helpers');
const Decimal = require('decimal.js');
const { ZERO_ADDRESS } = constants;
const { latest } = time;

const TokenTimeWeightedAverage = artifacts.require('TestTokenTimeWeightedAverage');

const ROLE_OWNER = web3.utils.keccak256('ROLE_OWNER');
const ROLE_SEEDER = web3.utils.keccak256('ROLE_SEEDER');

const initTWA = (start) => {};

contract.only('TokenTimeWeightedAverage', (accounts) => {
    const owner = accounts[0];
    const nonOwner = accounts[5];
    let twa;
    let now;

    beforeEach(async () => {
        now = await latest();

        twa = await TokenTimeWeightedAverage.new({ from: owner });
        await twa.setTime(now);
    });

    describe('construction', () => {
        it('should properly initialize roles', async () => {
            expect(await twa.getRoleMemberCount.call(ROLE_OWNER)).to.be.bignumber.equal(new BN(1));
            expect(await twa.getRoleMemberCount.call(ROLE_SEEDER)).to.be.bignumber.equal(new BN(0));

            expect(await twa.getRoleAdmin.call(ROLE_OWNER)).to.eql(ROLE_OWNER);
            expect(await twa.getRoleAdmin.call(ROLE_SEEDER)).to.eql(ROLE_OWNER);

            expect(await twa.hasRole.call(ROLE_OWNER, owner)).to.be.true();
            expect(await twa.hasRole.call(ROLE_SEEDER, owner)).to.be.false();
        });
    });

    describe.only('adding samples', () => {
        const token = accounts[8];

        it('should allow to initialize the accumulator', async () => {
            const res = await twa.initialize(token, now);
            expectEvent(res, 'Initialized', { _token: token, _startTime: now });

            const range = await twa.sampleRange.call(token);
            expect(range[0]).to.be.bignumber.equal(now);
            expect(range[1]).to.be.bignumber.equal(now);

            const s = await twa.sample.call(token, now);
            expect(s[0]).to.be.bignumber.equal(new BN(0));
            expect(s[1]).to.be.bignumber.equal(new BN(1));
        });

        it('should revert when attempting to initialize the accumulator twice', async () => {
            await twa.initialize(token, now);
            await expectRevert(twa.initialize(token, now), 'ERR_ALREADY_INITIALIZED');
        });

        it('should revert when attempting to initialize the accumulator with a zero address', async () => {
            await expectRevert(twa.initialize(ZERO_ADDRESS, now), 'ERR_INVALID_ADDRESS');
        });

        it('should revert when attempting to initialize the accumulator with a future time', async () => {
            await expectRevert(twa.initialize(token, now.add(new BN(1000))), 'ERR_INVALID_TIME');
        });

        context('owner', async () => {
            let initTime;

            beforeEach(async () => {
                initTime = now;

                await twa.initialize(token, initTime, { from: owner });

                now = now.add(new BN(10000));
                await twa.setTime(now);
            });

            it('should allow an owner to add samples', async () => {
                const n = new BN(1000);
                const d = new BN(500);
                let res = await twa.addSample(token, n, d, { from: owner });

                let lastSampleTime = now;
                const firstSampleTime = initTime;
                expectEvent(res, 'SampleAdded', { _token: token, _n: n, _d: d, _time: lastSampleTime });

                let range = await twa.sampleRange.call(token);
                expect(range[0]).to.be.bignumber.equal(firstSampleTime);
                expect(range[1]).to.be.bignumber.equal(lastSampleTime);
                let s = await twa.sample.call(token, lastSampleTime);
                expect(s[0]).to.be.bignumber.equal(n);
                expect(s[1]).to.be.bignumber.equal(d);
                expect(await twa.sampleExists.call(token, now)).to.be.true();

                now = now.add(new BN(1));
                await twa.setTime(now);

                const n2 = new BN(10000);
                const d2 = new BN(2);
                res = await twa.addSample(token, n2, d2, { from: owner });

                lastSampleTime = now;
                expectEvent(res, 'SampleAdded', { _token: token, _n: n2, _d: d2, _time: lastSampleTime });

                range = await twa.sampleRange.call(token);
                expect(range[0]).to.be.bignumber.equal(firstSampleTime);
                expect(range[1]).to.be.bignumber.equal(lastSampleTime);

                s = await twa.sample.call(token, lastSampleTime);
                expect(s[0]).to.be.bignumber.equal(n2);
                expect(s[1]).to.be.bignumber.equal(d2);
                expect(await twa.sampleExists.call(token, lastSampleTime)).to.be.true();

                now = now.add(new BN(5000));
                await twa.setTime(now);

                const n3 = new BN(10000);
                const d3 = new BN(200);
                res = await twa.addSample(token, n3, d3, { from: owner });

                lastSampleTime = now;
                expectEvent(res, 'SampleAdded', { _token: token, _n: n3, _d: d3, _time: lastSampleTime });

                range = await twa.sampleRange.call(token);
                expect(range[0]).to.be.bignumber.equal(firstSampleTime);
                expect(range[1]).to.be.bignumber.equal(lastSampleTime);
                s = await twa.sample.call(token, lastSampleTime);
                expect(s[0]).to.be.bignumber.equal(n3);
                expect(s[1]).to.be.bignumber.equal(d3);
                expect(await twa.sampleExists.call(token, lastSampleTime)).to.be.true();
            });

            it('should allow adding multiple samples with the same timestamp', async () => {
                const n = new BN(1000);
                const d = new BN(500);
                let res = await twa.addSample(token, n, d, { from: owner });

                let lastSampleTime = now;
                const firstSampleTime = initTime;
                expectEvent(res, 'SampleAdded', { _token: token, _n: n, _d: d, _time: lastSampleTime });

                let range = await twa.sampleRange.call(token);
                expect(range[0]).to.be.bignumber.equal(firstSampleTime);
                expect(range[1]).to.be.bignumber.equal(lastSampleTime);
                let s = await twa.sample.call(token, now);
                expect(s[0]).to.be.bignumber.equal(n);
                expect(s[1]).to.be.bignumber.equal(d);
                expect(await twa.sampleExists.call(token, now)).to.be.true();

                const n2 = new BN(10000);
                const d2 = new BN(2);
                res = await twa.addSample(token, n2, d2, { from: owner });

                expectEvent(res, 'SampleAdded', { _token: token, _n: n, _d: d, _time: lastSampleTime });

                range = await twa.sampleRange.call(token);
                expect(range[0]).to.be.bignumber.equal(firstSampleTime);
                expect(range[1]).to.be.bignumber.equal(lastSampleTime);
                s = await twa.sample.call(token, now);
                expect(s[0]).to.be.bignumber.equal(n2);
                expect(s[1]).to.be.bignumber.equal(d2);
                expect(await twa.sampleExists.call(token, now)).to.be.true();
            });

            it('should revert when a non-owner attempts to initialize the accumulator', async () => {
                const n = new BN(1000);
                const d = new BN(500);
                await expectRevert(twa.initialize(token, now, { from: nonOwner }), 'ERR_ACCESS_DENIED');
            });

            it('should revert when an owner attempts to add samples without initializing the accumulator first', async () => {
                const twa2 = await TokenTimeWeightedAverage.new({ from: owner });

                const n = new BN(1000);
                const d = new BN(500);
                await expectRevert(twa2.addSample(token, n, d, { from: owner }), 'ERR_NOT_INITIALIZED');
            });

            it('should revert when a non-owner attempts to add samples', async () => {
                const n = new BN(1000);
                const d = new BN(500);
                await expectRevert(twa.addSample(token, n, d, { from: nonOwner }), 'ERR_ACCESS_DENIED');
            });

            it('should revert when an owner attempts to add a sample for the zero address', async () => {
                const n = new BN(1000);
                const d = new BN(500);
                await expectRevert(twa.addSample(ZERO_ADDRESS, n, d, { from: owner }), 'ERR_INVALID_ADDRESS');
            });

            it('should revert when an owner attempts to add a sample with a zero denominator', async () => {
                const n = new BN(1000);
                const d = new BN(0);
                await expectRevert(twa.addSample(token, n, d, { from: owner }), 'ERR_ZERO_VALUE');
            });
        });

        context('seeder', async () => {
            const seeder = accounts[1];
            const nonSeeder = accounts[2];
            let initTime;

            beforeEach(async () => {
                initTime = now.sub(new BN(1000000));

                await twa.grantRole(ROLE_SEEDER, seeder, { from: owner });

                await twa.initialize(token, initTime, { from: seeder });
            });

            it('should allow a seeder to add past samples', async () => {
                let past = now.sub(new BN(20000));

                const n = new BN(1000);
                const d = new BN(500);
                let res = await twa.addPastSample(token, n, d, past, { from: seeder });

                let lastSampleTime = past;
                const firstSampleTime = initTime;
                expectEvent(res, 'SampleAdded', { _token: token, _n: n, _d: d, _time: lastSampleTime });

                let range = await twa.sampleRange.call(token);
                expect(range[0]).to.be.bignumber.equal(firstSampleTime);
                expect(range[1]).to.be.bignumber.equal(lastSampleTime);
                let s = await twa.sample.call(token, past);
                expect(s[0]).to.be.bignumber.equal(n);
                expect(s[1]).to.be.bignumber.equal(d);
                expect(await twa.sampleExists.call(token, past)).to.be.true();

                past = past.add(new BN(1000));

                const n2 = new BN(10000);
                const d2 = new BN(2);
                res = await twa.addPastSample(token, n2, d2, past, { from: seeder });

                lastSampleTime = past;
                expectEvent(res, 'SampleAdded', { _token: token, _n: n2, _d: d2, _time: lastSampleTime });

                range = await twa.sampleRange.call(token);
                expect(range[0]).to.be.bignumber.equal(firstSampleTime);
                expect(range[1]).to.be.bignumber.equal(lastSampleTime);
                s = await twa.sample.call(token, past);
                expect(s[0]).to.be.bignumber.equal(n2);
                expect(s[1]).to.be.bignumber.equal(d2);
                expect(await twa.sampleExists.call(token, past)).to.be.true();
            });

            it('should allow adding multiple past samples with the same timestamp', async () => {
                const past = now.sub(new BN(1));

                const n = new BN(1000);
                const d = new BN(500);
                let res = await twa.addPastSample(token, n, d, past, { from: seeder });

                const lastSampleTime = past;
                const firstSampleTime = initTime;
                expectEvent(res, 'SampleAdded', { _token: token, _n: n, _d: d, _time: lastSampleTime });

                let range = await twa.sampleRange.call(token);
                expect(range[0]).to.be.bignumber.equal(firstSampleTime);
                expect(range[1]).to.be.bignumber.equal(lastSampleTime);
                let s = await twa.sample.call(token, past);
                expect(s[0]).to.be.bignumber.equal(n);
                expect(s[1]).to.be.bignumber.equal(d);
                expect(await twa.sampleExists.call(token, past)).to.be.true();

                const n2 = new BN(10000);
                const d2 = new BN(2);
                res = await twa.addPastSample(token, n2, d2, past, { from: seeder });

                expectEvent(res, 'SampleAdded', { _token: token, _n: n2, _d: d2, _time: lastSampleTime });

                range = await twa.sampleRange.call(token);
                expect(range[0]).to.be.bignumber.equal(firstSampleTime);
                expect(range[1]).to.be.bignumber.equal(lastSampleTime);
                s = await twa.sample.call(token, past);
                expect(s[0]).to.be.bignumber.equal(n2);
                expect(s[1]).to.be.bignumber.equal(d2);
                expect(await twa.sampleExists.call(token, past)).to.be.true();
            });

            it('should revert when a non-seeder attempts to initialize the accumulator', async () => {
                const n = new BN(1000);
                const d = new BN(500);
                await expectRevert(twa.initialize(token, now, { from: nonSeeder }), 'ERR_ACCESS_DENIED');
            });

            it('should revert when a seeder attempts to add past samples without initializing the accumulator first', async () => {
                const twa2 = await TokenTimeWeightedAverage.new({ from: owner });

                const past = now.sub(new BN(1));

                const n = new BN(1000);
                const d = new BN(500);
                await expectRevert(twa2.addPastSample(token, n, d, past, { from: seeder }), 'ERR_NOT_INITIALIZED');
            });

            it('should revert when a seeder attempts to add past samples in an incorrect order', async () => {
                let past = now.sub(new BN(1));

                const n = new BN(1000);
                const d = new BN(500);
                await twa.addPastSample(token, n, d, past, { from: seeder });

                past = past.sub(new BN(1000));

                const n2 = new BN(10000);
                const d2 = new BN(2);
                await expectRevert(twa.addPastSample(token, n2, d2, past, { from: seeder }), 'ERR_WRONG_ORDER');
            });

            it('should revert when a non-seeder attempts to add past samples', async () => {
                const past = now.sub(new BN(1));

                const n = new BN(1000);
                const d = new BN(500);
                await expectRevert(twa.addPastSample(token, n, d, past, { from: nonSeeder }), 'ERR_ACCESS_DENIED');
            });

            it('should revert when a seeder attempts to add a past sample for the zero address', async () => {
                const past = now.sub(new BN(1));

                const n = new BN(1000);
                const d = new BN(500);
                await expectRevert(
                    twa.addPastSample(ZERO_ADDRESS, n, d, past, { from: seeder }),
                    'ERR_INVALID_ADDRESS'
                );
            });

            it('should revert when a seeder attempts to add a sample with a zero denominator', async () => {
                const past = now.sub(new BN(1));

                const n = new BN(1000);
                const d = new BN(0);
                await expectRevert(twa.addPastSample(token, n, d, past, { from: seeder }), 'ERR_ZERO_VALUE');
            });

            it('should revert when a seeder attempts to add a future sample', async () => {
                const future = now.add(new BN(100));

                const n = new BN(1000);
                const d = new BN(2000);
                await expectRevert(twa.addPastSample(token, n, d, future, { from: seeder }), 'ERR_INVALID_TIME');
            });
        });
    });

    describe('accumulating TWA', () => {
        const expectAlmostEqual = (amount1, amount2, maxError = Decimal(0.00001)) => {
            if (!amount1.eq(amount2)) {
                const error = Decimal(amount1.toString()).div(amount2.toString()).sub(1).abs();
                expect(error.lte(maxError)).to.be.true(`error = ${error.toFixed(maxError.length)}`);
            }
        };

        const token = accounts[8];

        beforeEach(async () => {
            await twa.initialize(token, now);
        });

        it('should properly accumulate large values', async () => {
            const valueStep = new BN(10 ** 10).mul(new BN(10).pow(new BN(18)));
            const timeStep = new BN(3600);
            let value = new BN(0);
            const sample0 = value;
            const time0 = now;
            let time = time0;
            let acc = new BN(0);

            for (let i = 1; i < 1000; ++i) {
                console.log(`Testing step ${i}...`);

                value = value.add(valueStep);
                await twa.addSample(token, value, new BN(1), { from: owner });

                const twaValue = await twa.timeWeightedAverage.call(token, time0);
                console.log(`twaValue at ${i}: ${twaValue[0].toString()}, ${twaValue[1].toString()}`);

                acc = acc.add(value.mul(new BN(timeStep)));
                const testTwaValue = acc.sub(sample0).div(time.sub(time0));
                console.log(`testTwaValue at ${i}: ${testTwaValue.toString()}`);

                expect(twaValue[0].div(twaValue[1])).to.be.bignumber.equal(testTwaValue);

                time = time.add(timeStep);
                await twa.setTime(time);
            }
        });

        it('should properly accumulate infinitesimal values', async () => {});
    });
});
