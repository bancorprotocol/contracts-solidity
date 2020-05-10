import Web3Wrapper
import InputGenerator


MINIMUM_VALUE_SUPPLY = 100
MAXIMUM_VALUE_SUPPLY = 10 ** 34
GROWTH_FACTOR_SUPPLY = 2.5

MINIMUM_VALUE_BALANCE = 100
MAXIMUM_VALUE_BALANCE = 10 ** 34
GROWTH_FACTOR_BALANCE = 2.5

MINIMUM_VALUE_WEIGHTS = 100000
MAXIMUM_VALUE_WEIGHTS = 1900000
GROWTH_FACTOR_WEIGHTS = 1.5

MINIMUM_VALUE_AMOUNT = 1
MAXIMUM_VALUE_AMOUNT = 10 ** 34
GROWTH_FACTOR_AMOUNT = 2.5


def Main():
    rangeSupply = InputGenerator.ExponentialDistribution(MINIMUM_VALUE_SUPPLY, MAXIMUM_VALUE_SUPPLY, GROWTH_FACTOR_SUPPLY)
    rangeBalance = InputGenerator.ExponentialDistribution(MINIMUM_VALUE_BALANCE, MAXIMUM_VALUE_BALANCE, GROWTH_FACTOR_BALANCE)
    rangeWeights = InputGenerator.ExponentialDistribution(MINIMUM_VALUE_WEIGHTS, MAXIMUM_VALUE_WEIGHTS, GROWTH_FACTOR_WEIGHTS)
    rangeAmount = InputGenerator.ExponentialDistribution(MINIMUM_VALUE_AMOUNT, MAXIMUM_VALUE_AMOUNT, GROWTH_FACTOR_AMOUNT)

    testNum = 0
    numOfTests = len(rangeSupply) * len(rangeBalance) * len(rangeWeights) * len(rangeAmount)

    tester = Web3Wrapper.Contract('BancorFormula').tester()
    minGas = float('+inf')
    maxGas = float('-inf')
    totalGas = 0
    countGas = 0

    for supply in rangeSupply:
        for balance in rangeBalance:
            for weights in rangeWeights:
                for amount in rangeAmount:
                    testNum += 1
                    if amount <= supply:
                        try:
                            gas = tester.liquidateRate(supply, balance, weights, amount)
                            minGas = min(minGas, gas)
                            maxGas = max(maxGas, gas)
                            totalGas += gas
                            countGas += 1
                            print('Test {} out of {}: gas = {}, minimum = {}, maximum = {}, average = {}'.format(testNum, numOfTests, gas, minGas, maxGas, totalGas // countGas))
                        except:
                            pass


Main()
