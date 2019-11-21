import Web3Wrapper
import InputGenerator


MINIMUM_VALUE_SUPPLY = 100
MAXIMUM_VALUE_SUPPLY = 10 ** 34
SAMPLES_COUNT_SUPPLY = 50

MINIMUM_VALUE_BALANCE = 100
MAXIMUM_VALUE_BALANCE = 10 ** 34
SAMPLES_COUNT_BALANCE = 50

MINIMUM_VALUE_RATIOS = 100000
MAXIMUM_VALUE_RATIOS = 1900000
SAMPLES_COUNT_RATIOS = 20

MINIMUM_VALUE_AMOUNT = 1
MAXIMUM_VALUE_AMOUNT = 10 ** 34
SAMPLES_COUNT_AMOUNT = 50


def Main():
    rangeSupply = InputGenerator.UniformDistribution(MINIMUM_VALUE_SUPPLY, MAXIMUM_VALUE_SUPPLY, SAMPLES_COUNT_SUPPLY)
    rangeBalance = InputGenerator.UniformDistribution(MINIMUM_VALUE_BALANCE, MAXIMUM_VALUE_BALANCE, SAMPLES_COUNT_BALANCE)
    rangeRatios = InputGenerator.UniformDistribution(MINIMUM_VALUE_RATIOS, MAXIMUM_VALUE_RATIOS, SAMPLES_COUNT_RATIOS)
    rangeAmount = InputGenerator.UniformDistribution(MINIMUM_VALUE_AMOUNT, MAXIMUM_VALUE_AMOUNT, SAMPLES_COUNT_AMOUNT)

    testNum = 0
    numOfTests = len(rangeSupply) * len(rangeBalance) * len(rangeRatios) * len(rangeAmount)

    tester = Web3Wrapper.Contract('BancorFormula').tester()
    minGas = float('+inf')
    maxGas = float('-inf')
    totalGas = 0
    countGas = 0

    for supply in rangeSupply:
        for balance in rangeBalance:
            for ratios in rangeRatios:
                for amount in rangeAmount:
                    testNum += 1
                    if amount <= supply:
                        try:
                            gas = tester.calculateLiquidateReturn(supply, balance, ratios, amount)
                            minGas = min(minGas, gas)
                            maxGas = max(maxGas, gas)
                            totalGas += gas
                            countGas += 1
                            print('Test {} out of {}: gas = {}, minimum = {}, maximum = {}, average = {}'.format(testNum, numOfTests, gas, minGas, maxGas, totalGas // countGas))
                        except:
                            pass


Main()
