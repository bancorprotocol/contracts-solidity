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

    let ILLEGAL_VALUE = web3.toBigNumber(2).toPower(256);
    let MAX_NUMERATOR = web3.toBigNumber(2).toPower(256 - constants.MAX_PRECISION).minus(1);
    let MIN_DENOMINATOR = web3.toBigNumber(1);

    for (let ratio = 1; ratio <= 99; ratio++) {
        let baseN = MAX_NUMERATOR;
        let baseD = MAX_NUMERATOR.minus(1);
        let expN  = ratio;
        let expD  = 100;
        let test  = `Function power(${baseN.toString(16)}, ${baseD.toString(16)}, ${expN}, ${expD})`;
        it(`${test}:`, async () => {
            try {
                let retVal = await formula.testPower.call(baseN, baseD, expN, expD);
                assert(ratio <= 99, `${test} passed when it should have failed`);
            }
            catch (error) {
                assert(ratio >= 100, `${test} failed when it should have passed`);
            }
        });
    }

    for (let ratio = 1; ratio <= 99; ratio++) {
        let baseN = MAX_NUMERATOR;
        let baseD = MAX_NUMERATOR.minus(1);
        let expN  = 100;
        let expD  = ratio;
        let test  = `Function power(${baseN.toString(16)}, ${baseD.toString(16)}, ${expN}, ${expD})`;
        it(`${test}:`, async () => {
            try {
                let retVal = await formula.testPower.call(baseN, baseD, expN, expD);
                assert(ratio <= 99, `${test} passed when it should have failed`);
            }
            catch (error) {
                assert(ratio >= 100, `${test} failed when it should have passed`);
            }
        });
    }

    for (let ratio = 1; ratio <= 99; ratio++) {
        let baseN = MAX_NUMERATOR;
        let baseD = MIN_DENOMINATOR;
        let expN  = ratio;
        let expD  = 100;
        let test  = `Function power(${baseN.toString(16)}, ${baseD.toString(16)}, ${expN}, ${expD})`;
        it(`${test}:`, async () => {
            try {
                let retVal = await formula.testPower.call(baseN, baseD, expN, expD);
                assert(ratio <= 63, `${test} passed when it should have failed`);
            }
            catch (error) {
                assert(ratio >= 64, `${test} failed when it should have passed`);
            }
        });
    }

    for (let ratio = 1; ratio <= 99; ratio++) {
        let baseN = MAX_NUMERATOR;
        let baseD = MIN_DENOMINATOR;
        let expN  = 100;
        let expD  = ratio;
        let test  = `Function power(${baseN.toString(16)}, ${baseD.toString(16)}, ${expN}, ${expD})`;
        it(`${test}:`, async () => {
            try {
                let retVal = await formula.testPower.call(baseN, baseD, expN, expD);
                assert(ratio <= 0, `${test} passed when it should have failed`);
            }
            catch (error) {
                assert(ratio >= 1, `${test} failed when it should have passed`);
            }
        });
    }

    for (let dummy = 1; dummy <= 1; dummy++) {
        let numerator = MAX_NUMERATOR;
        let denominator = MIN_DENOMINATOR;
        let test = `Function ln(${numerator.toString(16)}, ${denominator.toString(16)})`;
        it(`${test}:`, async () => {
            try {
                let retVal = await formula.testLn.call(numerator, denominator);
                assert(retVal.times(255).lessThan(ILLEGAL_VALUE), `${test}: output is too large`);
            }
            catch (error) {
                assert(false, `${test} failed when it should have passed`);
            }
        });
    }

    for (let dummy = 1; dummy <= 1; dummy++) {
        let numerator = MAX_NUMERATOR.plus(1);
        let denominator = MIN_DENOMINATOR;
        let test = `Function ln(${numerator.toString(16)}, ${denominator.toString(16)})`;
        it(`${test}:`, async () => {
            try {
                let retVal = await formula.testLn.call(numerator, denominator);
                assert(false, `${test} passed when it should have failed`);
            }
            catch (error) {
                return utils.ensureException(error);
            }
        });
    }

    for (let precision = constants.MIN_PRECISION; precision <= constants.MAX_PRECISION; precision++) {
        let maxExp = web3.toBigNumber(constants.maxExpArray[precision]);
        let tuples = [
            {'input' : maxExp.plus(0).times(web3.toBigNumber(2).toPower(constants.MAX_PRECISION - precision)).minus(1), 'output' : web3.toBigNumber(precision-0)},
            {'input' : maxExp.plus(0).times(web3.toBigNumber(2).toPower(constants.MAX_PRECISION - precision)).minus(0), 'output' : web3.toBigNumber(precision-0)},
            {'input' : maxExp.plus(1).times(web3.toBigNumber(2).toPower(constants.MAX_PRECISION - precision)).minus(1), 'output' : web3.toBigNumber(precision-0)},
            {'input' : maxExp.plus(1).times(web3.toBigNumber(2).toPower(constants.MAX_PRECISION - precision)).minus(0), 'output' : web3.toBigNumber(precision-1)},
        ];

        for (let index = 0; index < tuples.length; index++) {
            let input = tuples[index]['input'];
            let output = tuples[index]['output'];
            let test = `Function findPositionInMaxExpArray(${input.toString(16)})`;
            it(`${test}:`, async () => {
                try {
                    let retVal = await formula.testFindPositionInMaxExpArray.call(input);
                    assert(retVal.equals(output), `${test}: output should be ${output.toString(10)} but it is ${retVal.toString(10)}`);
                    assert(precision > constants.MIN_PRECISION || !output.lessThan(web3.toBigNumber(precision)), `${test} passed when it should have failed`);
                }
                catch (error) {
                    assert(precision == constants.MIN_PRECISION && output.lessThan(web3.toBigNumber(precision)), `${test} failed when it should have passed`);
                }
            });
        }
    }

    for (let precision = constants.MIN_PRECISION; precision <= constants.MAX_PRECISION; precision++) {
        let maxExp = web3.toBigNumber(constants.maxExpArray[precision]);
        let maxVal = web3.toBigNumber(constants.maxValArray[precision]);
        let errExp = maxExp.plus(1);

        let test1 = `Function fixedExp(${maxExp.toString(16)}, ${precision})`;
        it(`${test1}:`, async () => {
            let retVal = await formula.testFixedExp.call(maxExp, precision);
            assert(retVal.equals(maxVal), `${test1}: output is wrong`);
        });

        let test2 = `Function fixedExp(${errExp.toString(16)}, ${precision})`;
        it(`${test2}:`, async () => {
            let retVal = await formula.testFixedExp.call(errExp, precision);
            assert(retVal.lessThan(maxVal), `${test2}:  output indicates that maxExpArray[${precision}] is wrong`);
        });
    }

    for (let n = 1; n <= 255; n++) {
        let tuples = [
            {'input' : web3.toBigNumber(2).toPower(n)           , 'output' : web3.toBigNumber(n)},
            {'input' : web3.toBigNumber(2).toPower(n).plus(1)   , 'output' : web3.toBigNumber(n)},
            {'input' : web3.toBigNumber(2).toPower(n+1).minus(1), 'output' : web3.toBigNumber(n)},
        ];

        for (let index = 0; index < tuples.length; index++) {
            let input = tuples[index]['input'];
            let output = tuples[index]['output'];
            let test = `Function floorLog2(${input.toString(16)})`;
            it(`${test}:`, async () => {
                let retVal = await formula.testFloorLog2.call(input);
                    assert(retVal.equals(output), `${test}: output should be ${output.toString(10)} but it is ${retVal.toString(10)}`);
            });
        }
    }
});
