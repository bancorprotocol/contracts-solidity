/* global artifacts, contract, before, it, assert */
/* eslint-disable prefer-reflect */

let big = require('bignumber');
let testdata = require('./helpers/FormulaTestData.js')
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

function _hex(hexstr) {
    if (hexstr.startsWith('0x'))
        hexstr = hexstr.substr(2);

    return new big.BigInteger(hexstr, 16);
}

function num(numericStr) {
    return new big.BigInteger(numericStr, 10);
}

contract('BancorFormula', () => {
    it('handles legal input ranges (fixedExp)', () => {
        return BancorFormula.deployed().then((instance) => {
            let ok = _hex('0x386bfdba29');
            return instance.fixedExp.call(ok);
        }).then((retval) => {
            let expected = _hex('0x59ce8876bf3a3b1bfe894fc4f5');
            assert.equal(expected.toString(16), retval.toString(16), 'Wrong result for fixedExp at limit');
        });
    });

    it('throws outside input range (fixedExp)', () => {
        return BancorFormula.deployed().then((instance) => {
            let ok = _hex('0x386bfdba2a');
            return instance.fixedExp.call(ok);
        }).then(() => {
            assert(false, "was supposed to throw but didn't.");
        }).catch(expectedThrow);
    });

    let purchaseTest = (k) => {
        let [S, R, F, E, expect, exact] = k;
        S = num(S), R = num(R), F = num(F), E = num(E), expect = num(expect);

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
    }

    let saleTest = (k) => {
        let [S, R, F, T, expect, exact] = k;
        S = num(S), R = num(R), F = num(F), T = num(T), expect = num(expect);

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
    }

    let purchaseThrowTest = (k) => {
        let [S, R, F, E, expect, exact] = k;

        it('Should throw on out of bounds', () => {
            return BancorFormula.deployed()
                .then((f) => {
                    return f.calculatePurchaseReturn.call(S, R, F, E);
                })
                .then((retval) => {
                    assert(false, "was supposed to throw but didn't: [S,R,F,E] " + [S, R, F, E] + " => " + retval.toString(16));
                })
                .catch(expectedThrow);
        });
    }

    let saleThrowTest = (k) => {
        let [S, R, F, T, expect, exact] = k;

        it('Should throw on out of bounds', () => {
            return BancorFormula.deployed()
                .then((f) => {
                    return f.calculateSaleReturn.call(S, R, F, T);
                })
                .then((retval) => {
                    assert(false, "was supposed to throw but didn't: [S,R,F,T] " + [S, R, F, T] + "=> " + retval.toString(16));
                })
                .catch(expectedThrow);
        });
    }

    testdata.purchaseReturns.forEach(purchaseTest);
    testdata.saleReturns.forEach(saleTest);

    testdata.purchaseReturnsLarge.forEach(purchaseTest);
    testdata.saleReturnsLarge.forEach(saleTest);
    testdata.randomPurchaseReturns.forEach(purchaseTest);
    testdata.randomSaleReturns.forEach(saleTest);

    testdata.purchaseReturnExpectedThrows.forEach(purchaseThrowTest)
    testdata.saleReturnExpectedThrows.forEach(saleThrowTest)
});
