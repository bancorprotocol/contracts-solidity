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

    let MAX_NUMERATOR   = web3.toBigNumber(2).toPower(256 - constants.MAX_PRECISION).minus(1);
    let MIN_DENOMINATOR = web3.toBigNumber(1);

    it('Verify function ln legal input', async () => {
        try {
            await formula.testLn.call(MAX_NUMERATOR, MIN_DENOMINATOR);
        }
        catch (error) {
            assert(false, `Function ln(${MAX_NUMERATOR}, ${MIN_DENOMINATOR}) failed when it should have passed`);
        }
    });

    it('Verify function ln illegal input', async () => {
        try {
            await formula.testLn.call(MAX_NUMERATOR.plus(1), MIN_DENOMINATOR);
            assert(false, `Function ln(${MAX_NUMERATOR.plus(1)}, ${MIN_DENOMINATOR}) passed when it should have failed`);
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('Verify function ln illegal input', async () => {
        try {
            await formula.testLn.call(MAX_NUMERATOR, MIN_DENOMINATOR.minus(1));
            assert(false, `Function ln(${MAX_NUMERATOR}, ${MIN_DENOMINATOR.minus(1)}) passed when it should have failed`);
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('Verify function ln illegal input', async () => {
        try {
            await formula.testLn.call(MIN_DENOMINATOR, MAX_NUMERATOR);
            assert(false, `Function ln(${MIN_DENOMINATOR}, ${MAX_NUMERATOR}) passed when it should have failed`);
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    for (let precision = constants.MIN_PRECISION; precision <= constants.MAX_PRECISION; precision++) {
        let maxExp = web3.toBigNumber(constants.maxExpArray[precision]);
        let maxVal = web3.toBigNumber(constants.maxValArray[precision]);

        it('Verify function fixedExp legal input', async () => {
            let retVal = await formula.testFixedExp.call(maxExp, precision);
            assert.equal(retVal.toString(16), maxVal.toString(16), `Result of function fixedExp(${maxExp}, ${precision}) is wrong`);
        });

        it('Verify function fixedExp illegal input', async () => {
            let retVal0 = await formula.testFixedExp.call(maxExp.plus(0), precision);
            let retVal1 = await formula.testFixedExp.call(maxExp.plus(1), precision);
            assert(retVal0.greaterThan(retVal1), `Results of function fixedExp(...) indicate that maxExpArray[${precision}] is wrong`);
        });
    }
});
