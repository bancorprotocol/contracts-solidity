import web3
import json
import InputGenerator
import FormulaSolidityPort


MINIMUM_VALUE_SUPPLY  = 100
MAXIMUM_VALUE_SUPPLY  = 10**34
GROWTH_FACTOR_SUPPLY  = 2.5


MINIMUM_VALUE_BALANCE = 100
MAXIMUM_VALUE_BALANCE = 10**34
GROWTH_FACTOR_BALANCE = 2.5


MINIMUM_VALUE_RATIO   = 100000
MAXIMUM_VALUE_RATIO   = 900000
GROWTH_FACTOR_RATIO   = 1.5


MINIMUM_VALUE_AMOUNT  = 1
MAXIMUM_VALUE_AMOUNT  = 10**34
GROWTH_FACTOR_AMOUNT  = 2.5


def Main():    
    range_supply  = InputGenerator.ExponentialDistribution(MINIMUM_VALUE_SUPPLY ,MAXIMUM_VALUE_SUPPLY ,GROWTH_FACTOR_SUPPLY )
    range_balance = InputGenerator.ExponentialDistribution(MINIMUM_VALUE_BALANCE,MAXIMUM_VALUE_BALANCE,GROWTH_FACTOR_BALANCE)
    range_ratio   = InputGenerator.ExponentialDistribution(MINIMUM_VALUE_RATIO  ,MAXIMUM_VALUE_RATIO  ,GROWTH_FACTOR_RATIO  )
    range_amount  = InputGenerator.ExponentialDistribution(MINIMUM_VALUE_AMOUNT ,MAXIMUM_VALUE_AMOUNT ,GROWTH_FACTOR_AMOUNT )
    
    testNum = 0
    numOfTests = len(range_supply)*len(range_balance)*len(range_ratio)*len(range_amount)
    
    web3RPCProvider = web3.Web3(web3.RPCProvider())
    abi = open('../contracts/build/BancorFormula.abi').read()
    bin = open('../contracts/build/BancorFormula.bin').read()
    contract = web3RPCProvider.eth.contract(abi=json.loads(abi),bytecode=bin)
    FormulaContractAddr = contract(web3RPCProvider.eth.getTransactionReceipt(contract.deploy())['contractAddress']).call()
    
    for             supply  in range_supply :
        for         balance in range_balance:
            for     ratio   in range_ratio  :
                for amount  in range_amount :
                    testNum += 1
                    if amount <= supply:
                        resultSolidityPort = Run(FormulaSolidityPort,supply,balance,ratio,amount)
                        resultContractAddr = Run(FormulaContractAddr,supply,balance,ratio,amount)
                        print 'Test {} out of {}: resultSolidityPort = {}, resultContractAddr = {}'.format(testNum,numOfTests,resultSolidityPort,resultContractAddr)
                        if resultSolidityPort != resultContractAddr:
                            print 'Emulation Error:'
                            print 'supply  = {}'.format(supply )
                            print 'balance = {}'.format(balance)
                            print 'ratio   = {}'.format(ratio  )
                            print 'amount  = {}'.format(amount )
                            return


def Run(module,supply,balance,ratio,amount):
    try:
        return module.calculateSaleReturn(supply,balance,ratio,amount)
    except Exception:
        return -1


Main()
