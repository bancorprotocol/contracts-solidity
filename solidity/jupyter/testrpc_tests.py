import analysis as formula
from web3 import Web3, TestRPCProvider, RPCProvider
import math, json
import unittest



class TestFormula(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.web3 = Web3(RPCProvider())
        abi = json.loads(open('../contracts/build/BancorFormula.abi').read())
        bin = open('../contracts/build/BancorFormula.bin').read()
        formula = cls.web3.eth.contract(abi=abi, bytecode=bin)
        tx = formula.deploy()
        cls.formula = formula(cls.web3.eth.getTransactionReceipt(tx)['contractAddress'])

    def expectFail(self, n,d):
        try:
            self.formula.call().ln(n,d)
            raise Exception("Should fail : %d %d" % (n,d))
        except ValueError, e:
            if str(e).find("invalid opcode") > 0:
                pass
            else:
                raise e

    def testLnBounds(self):
        self.expectFail( 0x0000000100000000000000000000000000000000000000000000000000000000L, 23)
        self.expectFail( 0x0000000100000000000000000000000000000000000000000000000000000000L, 0x0000000100000000000000000000000000000000000000000000000000000000L)
        self.expectFail( 500,501)
        self.expectFail( 500,0)
        self.expectFail( 0,0)
        # Should not fail
        self.formula.call().ln( 1, 1)
        self.formula.call().ln( 500, 1)
        self.formula.call().ln(0x00000000F0000000000000000000000000000000000000000000000000000000,23)
        self.formula.call().ln(0x00000000F0000000000000000000000000000000000000000000000000000000,23)


if __name__ == '__main__':
    unittest.main()


