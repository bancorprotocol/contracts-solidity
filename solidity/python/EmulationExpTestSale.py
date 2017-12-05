import web3
import json
import InputGenerator
import FormulaSolidityPort


MINIMUM_VALUE_SUPPLY = 100
MAXIMUM_VALUE_SUPPLY = 10 ** 34
GROWTH_FACTOR_SUPPLY = 2.5

MINIMUM_VALUE_BALANCE = 100
MAXIMUM_VALUE_BALANCE = 10 ** 34
GROWTH_FACTOR_BALANCE = 2.5

MINIMUM_VALUE_WEIGHT = 100000
MAXIMUM_VALUE_WEIGHT = 900000
GROWTH_FACTOR_WEIGHT = 1.5

MINIMUM_VALUE_AMOUNT = 1
MAXIMUM_VALUE_AMOUNT = 10 ** 34
GROWTH_FACTOR_AMOUNT = 2.5


def Main():
    rangeSupply = InputGenerator.ExponentialDistribution(MINIMUM_VALUE_SUPPLY, MAXIMUM_VALUE_SUPPLY, GROWTH_FACTOR_SUPPLY)
    rangeBalance = InputGenerator.ExponentialDistribution(MINIMUM_VALUE_BALANCE, MAXIMUM_VALUE_BALANCE, GROWTH_FACTOR_BALANCE)
    rangeWeight = InputGenerator.ExponentialDistribution(MINIMUM_VALUE_WEIGHT, MAXIMUM_VALUE_WEIGHT, GROWTH_FACTOR_WEIGHT)
    rangeAmount = InputGenerator.ExponentialDistribution(MINIMUM_VALUE_AMOUNT, MAXIMUM_VALUE_AMOUNT, GROWTH_FACTOR_AMOUNT)

    testNum = 0
    numOfTests = len(rangeSupply) * len(rangeBalance) * len(rangeWeight) * len(rangeAmount)

    web3RPCProvider = web3.Web3(web3.RPCProvider())
    abi = open('../contracts/build/BancorFormula.abi').read()
    bin = open('../contracts/build/BancorFormula.bin').read()
    contract = web3RPCProvider.eth.contract(abi=json.loads(abi), bytecode=bin)
    FormulaContractAddr = contract(web3RPCProvider.eth.getTransactionReceipt(contract.deploy())['contractAddress']).call()

    for supply in rangeSupply:
        for balance in rangeBalance:
            for weight in rangeWeight:
                for amount in rangeAmount:
                    testNum += 1
                    if amount <= supply:
                        resultSolidityPort = Run(FormulaSolidityPort, supply, balance, weight, amount)
                        resultContractAddr = Run(FormulaContractAddr, supply, balance, weight, amount)
                        print 'Test {} out of {}: resultSolidityPort = {}, resultContractAddr = {}'.format(testNum, numOfTests, resultSolidityPort, resultContractAddr)
                        if resultSolidityPort != resultContractAddr:
                            print 'Emulation Error:'
                            print 'supply  = {}'.format(supply)
                            print 'balance = {}'.format(balance)
                            print 'weight  = {}'.format(weight)
                            print 'amount  = {}'.format(amount)
                            return


def Run(module, supply, balance, weight, amount):
    try:
        return module.calculateSaleReturn(supply, balance, weight, amount)
    except Exception:
        return -1


Main()
