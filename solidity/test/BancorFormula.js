/* global artifacts, contract, it, assert, web3 */
/* eslint-disable prefer-reflect */

let testdata = require('./helpers/FormulaTestData.js');
let testArrays = require('./helpers/FormulaTestArrays.js');
let BancorFormula = artifacts.require('./BancorFormula.sol');

function isThrow(error) {
    return error.toString().indexOf('invalid JUMP') != -1 || error.toString().indexOf('VM Exception while executing eth_call: invalid opcode') != -1;
}

function expectedThrow(error) {
    if (isThrow(error))
        console.log('\tExpected throw. Test succeeded.');
    else
        assert(false, error.toString());
}

contract('BancorFormula', () => {
    for (let precision = testArrays.MIN_PRECISION; precision <= testArrays.MAX_PRECISION; precision++) {
        it('handles legal input ranges (fixedExp)', async () => {
            let instance = await BancorFormula.deployed();
            let ok = testArrays.maxExp[precision];
            ok = web3.toBigNumber(ok);
            let retval = await instance.fixedExp.call(ok, precision);
            let expected = testArrays.maxVal[precision];
            expected = web3.toBigNumber(expected);
            assert.equal(expected.toString(16), retval.toString(16), 'Wrong result for fixedExp at limit');
        });
        it('verifies input limit (fixedExpUnsafe)', async () => {
            let instance = await BancorFormula.deployed();
            let maxExp = testArrays.maxExp[precision];
            maxExp = web3.toBigNumber(maxExp);
            let retval0 = await instance.fixedExpUnsafe.call(maxExp.plus(0), precision);
            let retval1 = await instance.fixedExpUnsafe.call(maxExp.plus(1), precision);
            assert(retval0.greaterThan(retval1), 'Result indicates wrong limit for fixedExpUnsafe');
        });
    }

    let purchaseTest = (k) => {
        let [S, R, F, E, expect, exact] = k;
        S = web3.toBigNumber(S), R = web3.toBigNumber(R), F = web3.toBigNumber(F), E = web3.toBigNumber(E), expect = web3.toBigNumber(expect);

        it('Should get correct amount of tokens when purchasing', () => {
            return BancorFormula.deployed()
                .then((f) => {
                    return f.calculatePurchaseReturn.call(S, R, F, E);
                })
                .then((retval) => {
                    // assert(retval.valueOf() <= expect,"Purchase return "+retval+" should be <="+expect+" ( "+exact+"). [S,R,F,E] "+[S,R,F,E]);
                    assert(retval.eq(expect), 'Purchase return ' + retval + ' should be ==' + expect + ' ( ' + exact + '). [S,R,F,E] ' + [S, R, F, E]);
                })
                .catch((error) => {
                    if (isThrow(error)) {
                        if (expect.valueOf() == 0)
                            assert(true, 'Expected throw');
                        else
                            assert(false, 'Sale return generated throw');
                    }
                    else {
                        assert(false, error.toString());
                    }
                });
        });
    };

    let saleTest = (k) => {
        let [S, R, F, T, expect, exact] = k;
        S = web3.toBigNumber(S), R = web3.toBigNumber(R), F = web3.toBigNumber(F), T = web3.toBigNumber(T), expect = web3.toBigNumber(expect);

        it('Should get correct amount of Ether when selling', () => {
            return BancorFormula.deployed().then(
                (f) => {
                    return f.calculateSaleReturn.call(S, R, F, T);
                })
                .then((retval) => {
                    assert(retval.eq(expect), 'Sale return ' + retval + ' should be ==' + expect + ' ( ' + exact + '). [S,R,F,T] ' + [S, R, F, T]);
                })
                .catch((error) => {
                    if (isThrow(error)) {
                        if (expect.valueOf() == 0)
                            assert(true, 'Expected throw');
                        else
                            assert(false, 'Sale return generated throw');
                    }
                    else {
                        assert(false, error.toString());
                    }
                });
        });
    };

    let purchaseThrowTest = (k) => {
        let [S, R, F, E, expect, exact] = k;

        it('Should throw on out of bounds', () => {
            return BancorFormula.deployed()
                .then((f) => {
                    return f.calculatePurchaseReturn.call(S, R, F, E);
                })
                .then((retval) => {
                    assert(false, "was supposed to throw but didn't: [S,R,F,E] " + [S, R, F, E] + ' => ' + retval.toString(16));
                })
                .catch(expectedThrow);
        });
    };

    let saleThrowTest = (k) => {
        let [S, R, F, T, expect, exact] = k;

        it('Should throw on out of bounds', () => {
            return BancorFormula.deployed()
                .then((f) => {
                    return f.calculateSaleReturn.call(S, R, F, T);
                })
                .then((retval) => {
                    assert(false, "was supposed to throw but didn't: [S,R,F,T] " + [S, R, F, T] + '=> ' + retval.toString(16));
                })
                .catch(expectedThrow);
        });
    };

    testdata.purchaseReturns.forEach(purchaseTest);
    testdata.saleReturns.forEach(saleTest);

    testdata.purchaseReturnsLarge.forEach(purchaseTest);
    testdata.saleReturnsLarge.forEach(saleTest);
    testdata.randomPurchaseReturns.forEach(purchaseTest);
    testdata.randomSaleReturns.forEach(saleTest);

    testdata.purchaseReturnExpectedThrows.forEach(purchaseThrowTest);
    testdata.saleReturnExpectedThrows.forEach(saleThrowTest);
});
