import Web3Wrapper
import InputGenerator
import FormulaSolidityPort


MINIMUM_VALUE_SUPPLY = 100
MAXIMUM_VALUE_SUPPLY = 10 ** 34
SAMPLES_COUNT_SUPPLY = 50

MINIMUM_VALUE_BALANCE = 100
MAXIMUM_VALUE_BALANCE = 10 ** 34
SAMPLES_COUNT_BALANCE = 50

MINIMUM_VALUE_WEIGHTS = 100000
MAXIMUM_VALUE_WEIGHTS = 1900000
SAMPLES_COUNT_WEIGHTS = 20

MINIMUM_VALUE_AMOUNT = 1
MAXIMUM_VALUE_AMOUNT = 10 ** 34
SAMPLES_COUNT_AMOUNT = 50


def Main():
    rangeSupply = InputGenerator.UniformDistribution(MINIMUM_VALUE_SUPPLY, MAXIMUM_VALUE_SUPPLY, SAMPLES_COUNT_SUPPLY)
    rangeBalance = InputGenerator.UniformDistribution(MINIMUM_VALUE_BALANCE, MAXIMUM_VALUE_BALANCE, SAMPLES_COUNT_BALANCE)
    rangeWeights = InputGenerator.UniformDistribution(MINIMUM_VALUE_WEIGHTS, MAXIMUM_VALUE_WEIGHTS, SAMPLES_COUNT_WEIGHTS)
    rangeAmount = InputGenerator.UniformDistribution(MINIMUM_VALUE_AMOUNT, MAXIMUM_VALUE_AMOUNT, SAMPLES_COUNT_AMOUNT)

    testNum = 0
    numOfTests = len(rangeSupply) * len(rangeBalance) * len(rangeWeights) * len(rangeAmount)

    FormulaContractAddr = Web3Wrapper.Contract('BancorFormula').getter()

    for supply in rangeSupply:
        for balance in rangeBalance:
            for weights in rangeWeights:
                for amount in rangeAmount:
                    testNum += 1
                    if amount <= supply:
                        resultSolidityPort = Run(FormulaSolidityPort, supply, balance, weights, amount)
                        resultContractAddr = Run(FormulaContractAddr, supply, balance, weights, amount)
                        print('Test {} out of {}: resultSolidityPort = {}, resultContractAddr = {}'.format(testNum, numOfTests, resultSolidityPort, resultContractAddr))
                        if resultSolidityPort != resultContractAddr:
                            print('Emulation Error:')
                            print('supply  = {}'.format(supply))
                            print('balance = {}'.format(balance))
                            print('weights = {}'.format(weights))
                            print('amount  = {}'.format(amount))
                            return


def Run(module, supply, balance, weights, amount):
    try:
        return module.liquidateReserveAmount(supply, balance, weights, amount)
    except:
        return -1


Main()
