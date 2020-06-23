import Web3Wrapper
import InputGenerator
import FormulaSolidityPort


MINIMUM_VALUE_BALANCE = 100
MAXIMUM_VALUE_BALANCE = 10 ** 34
SAMPLES_COUNT_BALANCE = 50

MINIMUM_VALUE_WEIGHT = 100000
MAXIMUM_VALUE_WEIGHT = 900000
SAMPLES_COUNT_WEIGHT = 10

MINIMUM_VALUE_AMOUNT = 1
MAXIMUM_VALUE_AMOUNT = 10 ** 34
SAMPLES_COUNT_AMOUNT = 50


def Main():
    rangeBalance1 = InputGenerator.UniformDistribution(MINIMUM_VALUE_BALANCE, MAXIMUM_VALUE_BALANCE, SAMPLES_COUNT_BALANCE)
    rangeWeight1 = InputGenerator.UniformDistribution(MINIMUM_VALUE_WEIGHT, MAXIMUM_VALUE_WEIGHT, SAMPLES_COUNT_WEIGHT)
    rangeBalance2 = InputGenerator.UniformDistribution(MINIMUM_VALUE_BALANCE, MAXIMUM_VALUE_BALANCE, SAMPLES_COUNT_BALANCE)
    rangeWeight2 = InputGenerator.UniformDistribution(MINIMUM_VALUE_WEIGHT, MAXIMUM_VALUE_WEIGHT, SAMPLES_COUNT_WEIGHT)
    rangeAmount = InputGenerator.UniformDistribution(MINIMUM_VALUE_AMOUNT, MAXIMUM_VALUE_AMOUNT, SAMPLES_COUNT_AMOUNT)

    testNum = 0
    numOfTests = len(rangeBalance1) * len(rangeWeight1) * len(rangeBalance2) * len(rangeWeight2) * len(rangeAmount)

    FormulaContractAddr = Web3Wrapper.Contract('BancorFormula').getter()

    for balance1 in rangeBalance1:
        for weight1 in rangeWeight1:
            for balance2 in rangeBalance2:
                for weight2 in rangeWeight2:
                    for amount in rangeAmount:
                        testNum += 1
                        if True:
                            resultSolidityPort = Run(FormulaSolidityPort, balance1, weight1, balance2, weight2, amount)
                            resultContractAddr = Run(FormulaContractAddr, balance1, weight1, balance2, weight2, amount)
                            print('Test {} out of {}: resultSolidityPort = {}, resultContractAddr = {}'.format(testNum, numOfTests, resultSolidityPort, resultContractAddr))
                            if resultSolidityPort != resultContractAddr:
                                print('Emulation Error:')
                                print('balance1 = {}'.format(balance1))
                                print('weight1  = {}'.format(weight1))
                                print('balance2 = {}'.format(balance2))
                                print('weight2  = {}'.format(weight2))
                                print('amount   = {}'.format(amount))
                                return


def Run(module, balance1, weight1, balance2, weight2, amount):
    try:
        return module.crossReserveTargetAmount(balance1, weight1, balance2, weight2, amount)
    except:
        return -1


Main()
