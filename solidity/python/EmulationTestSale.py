import web3
import json
import math
import BancorFormula


MINIMUM_VALUE_SUPPLY  = 100
MAXIMUM_VALUE_SUPPLY  = 10**34
GROWTH_FACTOR_SUPPLY  = 2.5


MINIMUM_VALUE_RESERVE = 100
MAXIMUM_VALUE_RESERVE = 10**34
GROWTH_FACTOR_RESERVE = 2.5


MINIMUM_VALUE_RATIO   = 10
MAXIMUM_VALUE_RATIO   = 90
GROWTH_FACTOR_RATIO   = 1.5


MINIMUM_VALUE_AMOUNT  = 1
MAXIMUM_VALUE_AMOUNT  = 10**34
GROWTH_FACTOR_AMOUNT  = 2.5


def Main():    
    range_supply  = GenerateRange(MINIMUM_VALUE_SUPPLY ,MAXIMUM_VALUE_SUPPLY ,GROWTH_FACTOR_SUPPLY )
    range_reserve = GenerateRange(MINIMUM_VALUE_RESERVE,MAXIMUM_VALUE_RESERVE,GROWTH_FACTOR_RESERVE)
    range_ratio   = GenerateRange(MINIMUM_VALUE_RATIO  ,MAXIMUM_VALUE_RATIO  ,GROWTH_FACTOR_RATIO  )
    range_amount  = GenerateRange(MINIMUM_VALUE_AMOUNT ,MAXIMUM_VALUE_AMOUNT ,GROWTH_FACTOR_AMOUNT )
    
    testNum = 0
    numOfTests = len(range_supply)*len(range_reserve)*len(range_ratio)*len(range_amount)
    
    web3RPCProvider = web3.Web3(web3.RPCProvider())
    abi = open('../contracts/build/BancorFormula.abi').read()
    bin = open('../contracts/build/BancorFormula.bin').read()
    contract = web3RPCProvider.eth.contract(abi=json.loads(abi),bytecode=bin)
    contractHandle = contract(web3RPCProvider.eth.getTransactionReceipt(contract.deploy())['contractAddress']).call()
    
    for             supply  in range_supply :
        for         reserve in range_reserve:
            for     ratio   in range_ratio  :
                for amount  in range_amount :
                    testNum += 1
                    if amount <= supply:
                        python   = Run(BancorFormula ,supply,reserve,ratio,amount)
                        solidity = Run(contractHandle,supply,reserve,ratio,amount)
                        print 'Test {} out of {}: python = {}, solidity = {}'.format(testNum,numOfTests,python,solidity)
                        if python != solidity:
                            print 'Emulation Error:',', '.join(['{} = {}'.format(var,eval(var)) for var in 'supply,reserve,ratio,amount,python,solidity'.split(',')])
                            return


def Run(module,supply,reserve,ratio,amount):
    try:
        return module.calculateSaleReturn(supply,reserve,ratio,amount)
    except Exception:
        return -1


def GenerateRange(minimumValue,maximumValue,growthFactor):
    return [int(minimumValue*growthFactor**n) for n in range(int(math.log(float(maximumValue)/float(minimumValue),growthFactor))+1)]


Main()
