import Web3Wrapper
import InputGenerator


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

    tester = Web3Wrapper.Contract('BancorFormula').tester()
    minGas = float('+inf')
    maxGas = float('-inf')
    totalGas = 0
    countGas = 0

    for balance1 in rangeBalance1:
        for weight1 in rangeWeight1:
            for balance2 in rangeBalance2:
                for weight2 in rangeWeight2:
                    for amount in rangeAmount:
                        testNum += 1
                        if True:
                            try:
                                gas = tester.calculateRelayReturn(balance1, weight1, balance2, weight2, amount)
                                minGas = min(minGas, gas)
                                maxGas = max(maxGas, gas)
                                totalGas += gas
                                countGas += 1
                                print('Test {} out of {}: gas = {}, minimum = {}, maximum = {}, average = {}'.format(testNum, numOfTests, gas, minGas, maxGas, totalGas // countGas))
                            except:
                                pass


Main()
