const { accounts, defaultSender, contract, web3 } = require('@openzeppelin/test-environment');
const { expectRevert, expectEvent, constants, BN, time } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');

const Decimal = require('decimal.js');

const { ZERO_ADDRESS } = constants;
const { latest, duration } = time;

const TokenTimeWeightedAverage = contract.fromArtifact('TestTokenTimeWeightedAverage');

const ROLE_OWNER = web3.utils.keccak256('ROLE_OWNER');
const ROLE_SEEDER = web3.utils.keccak256('ROLE_SEEDER');

const initTWA = (start) => {
    return {
        firstSampleTime: Decimal(start.toString()),
        lastSampleTime: Decimal(start.toString()),
        accumulators: {
            [start]: Decimal(0)
        },
        lastAccumulator: Decimal(0),
        lastAccumulatorTime: Decimal(0)
    };
};

const addTWASample = (acc, n, d, time) => {
    const sampleTime = time.toNumber();
    const value = Decimal(n.toString()).div(Decimal(d.toString()));
    const { accumulators, lastSampleTime } = acc;

    acc.lastAccumulator = accumulators[lastSampleTime];
    acc.lastAccumulatorTime = sampleTime;

    accumulators[sampleTime] = acc.lastAccumulator.add(Decimal(sampleTime).sub(lastSampleTime).mul(value));
    acc.lastSampleTime = sampleTime;
};

const revertTWALastSample = (acc) => {
    const { lastAccumulator, lastAccumulatorTime } = acc;
    acc.accumulators[lastAccumulatorTime] = lastAccumulator;
};

const getTWAAccumulator = (acc, time) => {
    return acc.accumulators[time];
};

const getTWA = (acc, start, end) => {
    const { accumulators } = acc;
    const startAccumulator = accumulators[start];
    const endAccumulator = accumulators[end];
    return endAccumulator.sub(startAccumulator).div(Decimal(end.toString()).sub(Decimal(start.toString())));
};

describe('TokenTimeWeightedAverage', () => {
    const owner = defaultSender;
    const seeder = accounts[1];
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

    describe('adding samples', () => {
        const token = accounts[8];
        let acc;

        const testSample = async (n, d) => {
            const res = await twa.addSample(token, n, d, { from: owner });
            addTWASample(acc, n, d, now);

            const lastSampleTime = now;
            expectEvent(res, 'SampleAdded', { _token: token, _n: n, _d: d, _time: lastSampleTime });

            expect(await twa.sampleExists.call(token, now)).to.be.true();

            const range = await twa.sampleRange.call(token);
            const firstSampleTime = new BN(acc.firstSampleTime.toString());
            expect(range[0]).to.be.bignumber.equal(firstSampleTime);
            expect(range[1]).to.be.bignumber.equal(lastSampleTime);

            const s = await twa.accumulator.call(token, lastSampleTime);
            const ac = getTWAAccumulator(acc, lastSampleTime);
            const sv = Decimal(s[0].toString()).div(Decimal(s[1].toString()));
            expect(sv.toString()).to.be.eql(ac.toString());
        };

        const testPastSample = async (n, d, time) => {
            const res = await twa.addPastSample(token, n, d, time, { from: seeder });
            addTWASample(acc, n, d, time);

            const lastSampleTime = time;
            expectEvent(res, 'SampleAdded', { _token: token, _n: n, _d: d, _time: lastSampleTime });

            expect(await twa.sampleExists.call(token, time)).to.be.true();

            const range = await twa.sampleRange.call(token);
            const firstSampleTime = new BN(acc.firstSampleTime.toString());
            expect(range[0]).to.be.bignumber.equal(firstSampleTime);
            expect(range[1]).to.be.bignumber.equal(lastSampleTime);

            const s = await twa.accumulator.call(token, lastSampleTime);
            const ac = getTWAAccumulator(acc, lastSampleTime);
            const sv = Decimal(s[0].toString()).div(Decimal(s[1].toString()));
            expect(sv.toString()).to.be.eql(ac.toString());
        };

        it('should allow to initialize the accumulator', async () => {
            const res = await twa.initialize(token, now);
            expectEvent(res, 'Initialized', { _token: token, _startTime: now });

            const range = await twa.sampleRange.call(token);
            expect(range[0]).to.be.bignumber.equal(now);
            expect(range[1]).to.be.bignumber.equal(now);

            const s = await twa.accumulator.call(token, now);
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
                acc = initTWA(initTime);

                now = now.add(new BN(10000));
                await twa.setTime(now);
            });

            it('should allow an owner to add samples', async () => {
                await testSample(new BN(1000), new BN(500));

                now = now.add(new BN(1));
                await twa.setTime(now);
                await testSample(new BN(10000), new BN(2));

                now = now.add(new BN(5000));
                await twa.setTime(now);
                await testSample(new BN(10000), new BN(200));
            });

            it('should allow adding multiple samples with the same timestamp', async () => {
                await testSample(new BN(1000), new BN(500));

                revertTWALastSample(acc);
                await testSample(new BN(10000), new BN(500));

                revertTWALastSample(acc);
                await testSample(new BN(100), new BN(500));
            });

            it('should revert when a non-owner attempts to initialize the accumulator', async () => {
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
            const nonSeeder = accounts[2];
            let initTime;

            beforeEach(async () => {
                initTime = now.sub(new BN(1000000));

                await twa.grantRole(ROLE_SEEDER, seeder, { from: owner });

                await twa.initialize(token, initTime, { from: seeder });
                acc = initTWA(initTime);
            });

            it('should allow a seeder to add past samples', async () => {
                let past = now.sub(new BN(20000));
                await testPastSample(new BN(1000), new BN(500), past);

                past = past.add(new BN(1000));
                await testPastSample(new BN(10000), new BN(2), past);

                past = past.add(new BN(5000));
                await testPastSample(new BN(100), new BN(3), past);
            });

            it('should allow adding multiple past samples with the same timestamp', async () => {
                const past = now.sub(new BN(1));

                await testPastSample(new BN(1000), new BN(500), past);

                revertTWALastSample(acc);
                await testPastSample(new BN(10000), new BN(2), past);

                revertTWALastSample(acc);
                await testPastSample(new BN(1), new BN(2), past);
            });

            it('should revert when a non-seeder attempts to initialize the accumulator', async () => {
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
        const expectAlmostEqual = (amount1, amount2, maxError = Decimal(0.00000001)) => {
            if (!amount1.eq(amount2)) {
                const error = Decimal(amount1.toString()).div(amount2.toString()).sub(1).abs();
                expect(error.lte(maxError)).to.be.true(`error = ${error.toFixed(maxError.length)}`);
            }
        };

        const token = accounts[8];
        let acc;

        const test = async (valueStepFunction, timeStepFunction) => {
            let value = { n: new BN(0), d: new BN(0) };
            let time = now;
            const time0 = now;

            for (let i = 1; i < 100; ++i) {
                time = timeStepFunction(time);
                await twa.setTime(time);

                value = valueStepFunction(value);

                await twa.addSample(token, value.n, value.d, { from: owner });
                addTWASample(acc, value.n, value.d, time);

                const twaValue = await twa.timeWeightedAverage.call(token, time0);
                const testTwaValue = getTWA(acc, time0, time);
                const twaDecValue = Decimal(twaValue[0].toString()).div(Decimal(twaValue[1].toString()));
                expectAlmostEqual(twaDecValue, testTwaValue);
            }
        };

        beforeEach(async () => {
            await twa.initialize(token, now);
            acc = initTWA(now);
        });

        it('should properly accumulate large values', async () => {
            await test(
                (value) => ({
                    n: value.n.add(new BN(10 ** 10).mul(new BN(10).pow(new BN(18)))),
                    d: new BN(1)
                }),
                (time) => time.add(duration.days(1))
            );
        });

        it('should properly accumulate infinitesimal values', async () => {
            await test(
                (value) => ({
                    n: new BN(1),
                    d: value.d.add(new BN(10 ** 10).mul(new BN(10).pow(new BN(18))))
                }),
                (time) => time.add(duration.days(1))
            );
        });
    });
});
