/* global artifacts, contract, it, before, assert, web3 */
/* eslint-disable prefer-reflect, no-loop-func */

let constants = require('./helpers/FormulaConstants.js');
let TestBancorFormula = artifacts.require('./helpers/TestBancorFormula.sol');
const utils = require('./helpers/Utils');

let formula;

contract('BancorFormula', () => {
    before(async () => {
        formula = await TestBancorFormula.new();
    });

    let LIMIT = web3.toBigNumber(2).toPower(256);
    let FLOOR_LN2_MANTISSA = web3.toBigNumber(constants.FLOOR_LN2_MANTISSA);

    for (let precision = constants.MIN_PRECISION; precision <= constants.MAX_PRECISION; precision++) {

        let maxExp = web3.toBigNumber(constants.maxExpArray[precision]);
        let maxNumerator = web3.toBigNumber(2).toPower(256 - precision).minus(1);
        let minDenominator = web3.toBigNumber(1);

        it('Verify function fixedExp legal input', async () => {
            try {
                let retval = await formula.testFixedExp.call(maxExp, precision);
                let expected = web3.toBigNumber(constants.maxValArray[precision]);
                assert.equal(expected.toString(16), retval.toString(16), `Result of function fixedExp(${maxExp}, ${precision}) is wrong`);
            }
            catch (error) {
                assert(false, `Function fixedExp(${maxExp}, ${precision}) failed when it should have succeeded`);
            }
        });

        it('Verify function fixedExp illegal input', async () => {
            try {
                await formula.testFixedExp.call(maxExp.plus(1), precision);
                assert(false, `Function fixedExp(${maxExp.plus(1)}, ${precision}) succeeded when it should have failed`);
            }
            catch (error) {
                return utils.ensureException(error);
            }
        });

        it('Verify function fixedExpUnsafe input range', async () => {
            let retval0 = await formula.testFixedExpUnsafe.call(maxExp.plus(0), precision);
            let retval1 = await formula.testFixedExpUnsafe.call(maxExp.plus(1), precision);
            assert(retval0.greaterThan(retval1), `Result of function fixedExpUnsafe(${maxExp.plus(1)}, ${precision}) indicates that limit of function fixedExp is wrong`);
        });

        it('Verify function ln legal input', async () => {
            try {
                await formula.testLn.call(maxNumerator, minDenominator, precision);
            }
            catch (error) {
                assert(false, `Function ln(${maxNumerator}, ${minDenominator}, ${precision}) failed when it should have succeeded`);
            }
        });

        it('Verify function ln illegal input', async () => {
            try {
                await formula.testLn.call(maxNumerator.plus(1), minDenominator, precision);
                assert(false, `Function ln(${maxNumerator.plus(1)}, ${minDenominator}, ${precision}) succeeded when it should have failed`);
            }
            catch (error) {
                return utils.ensureException(error);
            }
        });

        it('Verify function ln illegal input', async () => {
            try {
                await formula.testLn.call(maxNumerator, minDenominator.minus(1), precision);
                assert(false, `Function ln(${maxNumerator}, ${minDenominator.minus(1)}, ${precision}) succeeded when it should have failed`);
            }
            catch (error) {
                return utils.ensureException(error);
            }
        });

        it('Verify function ln illegal input', async () => {
            try {
                await formula.testLn.call(minDenominator, maxNumerator, precision);
                assert(false, `Function ln(${minDenominator}, ${maxNumerator}, ${precision}) succeeded when it should have failed`);
            }
            catch (error) {
                return utils.ensureException(error);
            }
        });

        it('Verify function fixedLoge mantissa', async () => {
            let x = maxNumerator.times(web3.toBigNumber(2).toPower(precision)).dividedToIntegerBy(minDenominator);
            let retval = await formula.testFixedLog2.call(x, precision);
            assert(retval.times(FLOOR_LN2_MANTISSA).lessThan(LIMIT), `Result of function fixedLog2(${x}, ${precision}) indicates that mantissa used in function fixedLoge is wrong`);
        });
    }
});
