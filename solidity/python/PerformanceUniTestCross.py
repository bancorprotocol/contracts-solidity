import Web3Wrapper
import InputGenerator


MINIMUM_VALUE_BALANCE = 100
MAXIMUM_VALUE_BALANCE = 10 ** 34
SAMPLES_COUNT_BALANCE = 50

MINIMUM_VALUE_RATIO = 100000
MAXIMUM_VALUE_RATIO = 900000
SAMPLES_COUNT_RATIO = 10

MINIMUM_VALUE_AMOUNT = 1
MAXIMUM_VALUE_AMOUNT = 10 ** 34
SAMPLES_COUNT_AMOUNT = 50


def Main():
    rangeBalance1 = InputGenerator.UniformDistribution(MINIMUM_VALUE_BALANCE, MAXIMUM_VALUE_BALANCE, SAMPLES_COUNT_BALANCE)
    rangeRatio1 = InputGenerator.UniformDistribution(MINIMUM_VALUE_RATIO, MAXIMUM_VALUE_RATIO, SAMPLES_COUNT_RATIO)
    rangeBalance2 = InputGenerator.UniformDistribution(MINIMUM_VALUE_BALANCE, MAXIMUM_VALUE_BALANCE, SAMPLES_COUNT_BALANCE)
    rangeRatio2 = InputGenerator.UniformDistribution(MINIMUM_VALUE_RATIO, MAXIMUM_VALUE_RATIO, SAMPLES_COUNT_RATIO)
    rangeAmount = InputGenerator.UniformDistribution(MINIMUM_VALUE_AMOUNT, MAXIMUM_VALUE_AMOUNT, SAMPLES_COUNT_AMOUNT)

    testNum = 0
    numOfTests = len(rangeBalance1) * len(rangeRatio1) * len(rangeBalance2) * len(rangeRatio2) * len(rangeAmount)

    tester = Web3Wrapper.Contract('BancorFormula').tester()
    minGas = float('+inf')
    maxGas = float('-inf')
    totalGas = 0
    countGas = 0

    for balance1 in rangeBalance1:
        for ratio1 in rangeRatio1:
            for balance2 in rangeBalance2:
                for ratio2 in rangeRatio2:
                    for amount in rangeAmount:
                        testNum += 1
                        if True:
                            try:
                                gas = tester.calculateCrossReserveReturn(balance1, ratio1, balance2, ratio2, amount)
                                minGas = min(minGas, gas)
                                maxGas = max(maxGas, gas)
                                totalGas += gas
                                countGas += 1
                                print('Test {} out of {}: gas = {}, minimum = {}, maximum = {}, average = {}'.format(testNum, numOfTests, gas, minGas, maxGas, totalGas // countGas))
                            except:
                                pass


Main()
