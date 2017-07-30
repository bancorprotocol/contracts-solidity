/* global artifacts, contract, it, before, assert, web3 */
/* eslint-disable prefer-reflect, no-loop-func */

let testArrays = require('./helpers/FormulaTestArrays.js');
let TestBancorFormula = artifacts.require('./helpers/TestBancorFormula.sol');

let formula;

contract('BancorFormula', () => {
    before(async () => {
        formula = await TestBancorFormula.new();
    });

    for (let precision = testArrays.MIN_PRECISION; precision <= testArrays.MAX_PRECISION; precision++) {

        let maxExp         = web3.toBigNumber(testArrays.maxExp[precision]);
        let maxNumerator   = web3.toBigNumber((1 << precision) - 1);
        let minDenominator = web3.toBigNumber(1);

        it('Verify function fixedExp legal input', async () => {
            try {
                let retval = await formula.testFixedExp.call(maxExp, precision);
                let expected = web3.toBigNumber(testArrays.maxVal[precision]);
                assert.equal(expected.toString(16), retval.toString(16), 'Result of function fixedExp is wrong');
            }
            catch(error) {
                assert(false, 'Function fixedExp failed when it should have succeeded');
            }
        });

        it('Verify function fixedExp illegal input', async () => {
            try {
                let retval = await formula.testFixedExp.call(maxExp.plus(1), precision);
                assert(false, 'Function fixedExp succeeded when it should have failed');
            }
            catch(error) {
            }
        });

        it('Verify function fixedExpUnsafe input range', async () => {
            let retval0 = await formula.testFixedExpUnsafe.call(maxExp.plus(0), precision);
            let retval1 = await formula.testFixedExpUnsafe.call(maxExp.plus(1), precision);
            assert(retval0.greaterThan(retval1), 'Result of function fixedExpUnsafe indicates that limit of function fixedExp is wrong');
        });

        it('Verify function ln legal input', async () => {
            try {
                let retval = await formula.testLn.call(maxNumerator, minDenominator, precision);
            }
            catch(error) {
                assert(false, 'Function ln failed when it should have succeeded');
            }
        });

        it('Verify function ln illegal input', async () => {
            try {
                let retval = await formula.testLn.call(maxNumerator.plus(1), minDenominator, precision);
                assert(false, 'Function ln succeeded when it should have failed');
            }
            catch(error) {
            }
        });

        it('Verify function ln illegal input', async () => {
            try {
                let retval = await formula.testLn.call(maxNumerator, minDenominator.minus(1), precision);
                assert(false, 'Function ln succeeded when it should have failed');
            }
            catch(error) {
            }
        });

        it('Verify function ln illegal input', async () => {
            try {
                let retval = await formula.testLn.call(minDenominator, maxNumerator, precision);
                assert(false, 'Function ln succeeded when it should have failed');
            }
            catch(error) {
            }
        });
    }

/*    let purchaseTest = (k) => {
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
    testdata.saleReturnExpectedThrows.forEach(saleThrowTest);*/
});
