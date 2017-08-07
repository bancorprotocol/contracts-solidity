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

    let MAX_NUMERATOR = web3.toBigNumber(2).toPower(256 - constants.MAX_PRECISION).minus(1);

    it('Verify function ln legal input', async () => {
        try {
            let retVal = await formula.testLn.call(MAX_NUMERATOR, 1);
            assert(retVal.times(255).lessThan(web3.toBigNumber(2).toPower(256)), `Result of function ln(${MAX_NUMERATOR}, 1) is too large`);
        }
        catch (error) {
            assert(false, `Function ln(${MAX_NUMERATOR}, 1) failed when it should have passed`);
        }
    });

    it('Verify function ln illegal input', async () => {
        try {
            let retVal = await formula.testLn.call(MAX_NUMERATOR.plus(1), 1);
            assert(false, `Function ln(${MAX_NUMERATOR.plus(1)}, 1) passed when it should have failed`);
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    for (let precision = constants.MIN_PRECISION; precision <= constants.MAX_PRECISION; precision++) {
        let maxExp = web3.toBigNumber(constants.maxExpArray[precision]);
        let tuples = [
            {'input' : maxExp.plus(0).times(web3.toBigNumber(2).toPower(constants.MAX_PRECISION - precision)).minus(1), 'output' : web3.toBigNumber(precision-0)},
            {'input' : maxExp.plus(0).times(web3.toBigNumber(2).toPower(constants.MAX_PRECISION - precision)).minus(0), 'output' : web3.toBigNumber(precision-0)},
            {'input' : maxExp.plus(1).times(web3.toBigNumber(2).toPower(constants.MAX_PRECISION - precision)).minus(1), 'output' : web3.toBigNumber(precision-0)},
            {'input' : maxExp.plus(1).times(web3.toBigNumber(2).toPower(constants.MAX_PRECISION - precision)).minus(0), 'output' : web3.toBigNumber(precision-1)},
        ];

        for (let index = 0; index < tuples.length; index++) {
            it('Verify function findPositionInMaxExpArray legal input', async () => {
                try {
                    let retVal = await formula.testFindPositionInMaxExpArray.call(tuples[index]['input']);
                    assert(retVal.equals(tuples[index]['output']), `Result of function findPositionInMaxExpArray(${tuples[index]['input']}) should be ${tuples[index]['output']}$ but is ${retVal}$`);
                    assert(precision > constants.MIN_PRECISION || !tuples[index]['output'].lessThan(web3.toBigNumber(precision)), `Function findPositionInMaxExpArray(${tuples[index]['input']}) passed when it should have failed`);
                }
                catch (error) {
                    assert(precision == constants.MIN_PRECISION && tuples[index]['output'].lessThan(web3.toBigNumber(precision)), `Function findPositionInMaxExpArray(${tuples[index]['input']}) failed when it should have passed`);
                }
            });
        }
    }

    for (let precision = constants.MIN_PRECISION; precision <= constants.MAX_PRECISION; precision++) {
        let maxExp = web3.toBigNumber(constants.maxExpArray[precision]);
        let maxVal = web3.toBigNumber(constants.maxValArray[precision]);

        it('Verify function fixedExp legal input', async () => {
            let retVal = await formula.testFixedExp.call(maxExp, precision);
            assert(retVal.equals(maxVal), `Result of function fixedExp(${maxExp}, ${precision}) is wrong`);
        });

        it('Verify function fixedExp illegal input', async () => {
            let retVal = await formula.testFixedExp.call(maxExp.plus(1), precision);
            assert(retVal.lessThan(maxVal), `Result of function fixedExp(${maxExp.plus(1)}, ${precision}) indicates that maxExpArray[${precision}] is wrong`);
        });
    }

    for (let n = 1; n <= 255; n++) {
        let val1 = web3.toBigNumber(2).toPower(n);
        let val2 = web3.toBigNumber(2).toPower(n).plus(1);
        let val3 = web3.toBigNumber(2).toPower(n+1).minus(1);

        it('Verify function floorLog2 legal input', async () => {
            let retVal1 = await formula.testFloorLog2.call(val1);
            let retVal2 = await formula.testFloorLog2.call(val2);
            let retVal3 = await formula.testFloorLog2.call(val3);
            assert(retVal1.equals(web3.toBigNumber(n)), `Result of function floorLog2(${val1}) is wrong`);
            assert(retVal2.equals(web3.toBigNumber(n)), `Result of function floorLog2(${val2}) is wrong`);
            assert(retVal3.equals(web3.toBigNumber(n)), `Result of function floorLog2(${val3}) is wrong`);
        });
    }
});
