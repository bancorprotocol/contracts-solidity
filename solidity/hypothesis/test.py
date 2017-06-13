import json
from hypothesis import given, assume, example
import hypothesis.strategies as st
import math
import unittest
from web3 import Web3, TestRPCProvider, RPCProvider


ACCURACY = 0.000001


def calculatePurchaseReturn(S,R,F,E):
    if F== 100:
        return S*E/R

    return int(S * ( math.pow(1.0 + float(E)/float(R), float(F)/100.0) - 1.0 ))


def calculateSaleReturn(S,R,F,T):
    """ 
    E = R(1 - ((1 - T / S) ^ (1 / F))
     """
    if (T > S):
        return 0

    if F == 100:
        return int(R- R*T/S)

    return int(R * ( 1.0 - math.pow(float(S-T)/float(S) , (100.0/F))))

def fixedLogn(x , n):
    one = 1 << 32
    return int( math.log( float(x) / one, n) * one )

def fixedLogE(x):
    one = 1 << 32
    return int( math.log( float(x) / one) * one )

def rationalLn(numerator, denominator):
    return fixedLogE(numerator << 32) - fixedLogE(denominator << 32)

class TestFormula(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.web3 = Web3(RPCProvider())
        abi = json.loads(open('../contracts/build/BancorFormula.abi').read())
        bin = open('../contracts/build/BancorFormula.bin').read()
        formula = cls.web3.eth.contract(abi=abi, bytecode=bin)
        tx = formula.deploy()
        cls.formula = formula(cls.web3.eth.getTransactionReceipt(tx)['contractAddress'])

    @given(st.integers(min_value=0x100000000, max_value=1<<256-1))
    @example(0x100000000)
    def testFixedLog2(self, x):
        expectedReturn = fixedLogn(x, 2)
        actualReturn = self.formula.call().fixedLog2(x)
        if expectedReturn == 0:
            self.assertEqual(expectedReturn, actualReturn)
            return
        error = abs(expectedReturn - actualReturn) / expectedReturn
        self.assertLessEqual(error, 1e-9, "testFixedLog2(%s) expectedReturn: %d, actualReturn: %d, error: %fppm" % (hex(x), expectedReturn, actualReturn, error * 1000000))

    @given(st.integers(min_value=0x100000000, max_value=1<<256-1))
    @example(0x100000000)
    def testFixedLoge(self, x):
        expectedReturn = fixedLogn(x, math.e)
        actualReturn = self.formula.call().fixedLoge(x)
        if expectedReturn == 0:
            self.assertEqual(expectedReturn, actualReturn)
            return
        error = abs(expectedReturn - actualReturn) / expectedReturn
        self.assertLessEqual(error, 1e-9, "testFixedLoge(%s) expectedReturn: %d, actualReturn: %d, error: %fppm" % (hex(x), expectedReturn, actualReturn, error * 1000000))

    @given(st.integers(min_value=2, max_value=1<<224-1), st.integers(min_value=2, max_value=1<<224-1))
    @example(2, 1)
    def testLn(self, numerator, denominator):
        assume(denominator <= numerator)
        expectedReturn = rationalLn(numerator, denominator)
        actualReturn = self.formula.call().ln(numerator, denominator)
        if expectedReturn == 0:
            self.assertEqual(expectedReturn, actualReturn)
            return
        error = abs(expectedReturn - actualReturn) / expectedReturn
        self.assertLessEqual(error, 1e-9, "testLn(%s, %s) expectedReturn: %d, actualReturn: %d, error: %fppm" % (hex(numerator),hex(denominator), expectedReturn, actualReturn, error * 1000000))


    @given(st.integers(min_value=100), st.integers(min_value=100), st.integers(min_value=1, max_value=100), st.integers(min_value=0))
    @example(1102573407846, 1102573407846, 30, 86426)
    def testPurchaseReturn(self, supply, reserveBalance, reserveRatio, depositAmount):
        # Assume the supply is no more than 8 OOM greater than the reserve balance
        assume(supply <= reserveBalance * 100000000)
        # Assume the deposit amount is no more than 8 OOM greater than the reserve balance
        assume(depositAmount <= reserveBalance * 100000000)
        actualReturn = self.formula.call().calculatePurchaseReturn(supply, reserveBalance, reserveRatio, depositAmount)
        expectedReturn = calculatePurchaseReturn(supply, reserveBalance, reserveRatio, depositAmount)
        self.assertLessEqual(actualReturn, expectedReturn)
        if expectedReturn > actualReturn:
            error = (expectedReturn - actualReturn) / expectedReturn
            self.assertLessEqual(error, ACCURACY, "testPurchaseReturn Expected %d but got %d, difference of %f ppm" % (expectedReturn, actualReturn, error * 1000000.0))

    @given(st.integers(min_value=100), st.integers(min_value=100), st.integers(min_value=1, max_value=100), st.integers(min_value=0))
    def testSaleReturn(self, supply, reserveBalance, reserveRatio, sellAmount):
        assume(sellAmount < supply)
        actualReturn = self.formula.call().calculateSaleReturn(supply, reserveBalance, reserveRatio, sellAmount)
        expectedReturn = calculateSaleReturn(supply, reserveBalance, reserveRatio, sellAmount)
        self.assertLessEqual(actualReturn, expectedReturn)
        if expectedReturn > actualReturn:
            error = (expectedReturn - actualReturn) / expectedReturn
            self.assertLessEqual(error, ACCURACY, "testSaleReturn Expected %d but got %d, difference of %f ppm" % (expectedReturn, actualReturn, error * 1000000.0))


if __name__ == '__main__':
    unittest.main()
