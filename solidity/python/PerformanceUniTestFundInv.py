import Web3Wrapper
import InputGenerator


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

    FormulaContract = Web3Wrapper.Contract('BancorFormula')
    FormulaContract.setter().init()
    FormulaContractAddr = FormulaContract.tester()

    minGas = float('+inf')
    maxGas = float('-inf')

    totalGas = 0
    countGas = 0

    for supply in rangeSupply:
        for balance in rangeBalance:
            for weights in rangeWeights:
                for amount in rangeAmount:
                    testNum += 1
                    if True:
                        try:
                            gas = FormulaContractAddr.fundSupplyAmount(supply, balance, weights, amount)
                            minGas = min(minGas, gas)
                            maxGas = max(maxGas, gas)
                            totalGas += gas
                            countGas += 1
                            print('Test {} out of {}: gas = {}, minimum = {}, maximum = {}, average = {}'.format(testNum, numOfTests, gas, minGas, maxGas, totalGas // countGas))
                        except:
                            pass


Main()
