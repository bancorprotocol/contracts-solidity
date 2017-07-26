import json
from hypothesis import given, assume, example
import hypothesis.strategies as st
import unittest
from web3 import Web3, TestRPCProvider, RPCProvider


import os
import sys
sys.path.append(os.path.join(os.path.join(os.path.dirname(__file__),'..'),'python'))
import BancorFormula


class TestFormula(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.web3 = Web3(RPCProvider())
        abi = json.loads(open('../contracts/build/BancorFormula.abi').read())
        bin = open('../contracts/build/BancorFormula.bin').read()
        formula = cls.web3.eth.contract(abi=abi, bytecode=bin)
        tx = formula.deploy()
        cls.formula = formula(cls.web3.eth.getTransactionReceipt(tx)['contractAddress'])

    @given(st.integers(min_value=100), st.integers(min_value=100), st.integers(min_value=1, max_value=100), st.integers(min_value=0))
    def testPurchaseReturn(self, supply, reserveBalance, reserveRatio, depositAmount):
        solidity = self.formula.call().calculatePurchaseReturn(supply, reserveBalance, reserveRatio, depositAmount)
        python = BancorFormula.calculatePurchaseReturn(supply, reserveBalance, reserveRatio, depositAmount)
        print 'solidity = {}, python = {}'.format(solidity,python)

    @given(st.integers(min_value=100), st.integers(min_value=100), st.integers(min_value=1, max_value=100), st.integers(min_value=0))
    def testSaleReturn(self, supply, reserveBalance, reserveRatio, sellAmount):
        solidity = self.formula.call().calculateSaleReturn(supply, reserveBalance, reserveRatio, sellAmount)
        python = BancorFormula.calculateSaleReturn(supply, reserveBalance, reserveRatio, sellAmount)
        print 'solidity = {}, python = {}'.format(solidity,python)


unittest.main()
