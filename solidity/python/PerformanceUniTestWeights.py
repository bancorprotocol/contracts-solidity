import Web3Wrapper
import InputGenerator


MINIMUM_VALUE_STAKED = 10 ** 23
MAXIMUM_VALUE_STAKED = 10 ** 24
SAMPLES_COUNT_STAKED = 10

MINIMUM_VALUE_BALANCE = 10 ** 23
MAXIMUM_VALUE_BALANCE = 10 ** 24
SAMPLES_COUNT_BALANCE = 10

MINIMUM_VALUE_RATE = 100000
MAXIMUM_VALUE_RATE = 900000
SAMPLES_COUNT_RATE = 10


def Main():
    rangeStaked1 = InputGenerator.UniformDistribution(MINIMUM_VALUE_STAKED, MAXIMUM_VALUE_STAKED, SAMPLES_COUNT_STAKED)
    rangeBalance1 = InputGenerator.UniformDistribution(MINIMUM_VALUE_BALANCE, MAXIMUM_VALUE_BALANCE, SAMPLES_COUNT_BALANCE)
    rangeBalance2 = InputGenerator.UniformDistribution(MINIMUM_VALUE_BALANCE, MAXIMUM_VALUE_BALANCE, SAMPLES_COUNT_BALANCE)
    rangeRate1 = InputGenerator.UniformDistribution(MINIMUM_VALUE_RATE, MAXIMUM_VALUE_RATE, SAMPLES_COUNT_RATE)
    rangeRate2 = InputGenerator.UniformDistribution(MINIMUM_VALUE_RATE, MAXIMUM_VALUE_RATE, SAMPLES_COUNT_RATE)

    testNum = 0
    numOfTests = len(rangeStaked1) * len(rangeBalance1) * len(rangeBalance2) * len(rangeRate1) * len(rangeRate2)

    FormulaContract = Web3Wrapper.Contract('BancorFormula')
    FormulaContract.setter().init()
    FormulaContractAddr = FormulaContract.tester()

    minGas = float('+inf')
    maxGas = float('-inf')

    totalGas = 0
    countGas = 0

    for staked1 in rangeStaked1:
        for balance1 in rangeBalance1:
            for balance2 in rangeBalance2:
                for rate1 in rangeRate1:
                    for rate2 in rangeRate2:
                        testNum += 1
                        if True:
                            try:
                                gas = FormulaContractAddr.balancedWeights(staked1, balance1, balance2, rate1, rate2)
                                minGas = min(minGas, gas)
                                maxGas = max(maxGas, gas)
                                totalGas += gas
                                countGas += 1
                                print('Test {} out of {}: gas = {}, minimum = {}, maximum = {}, average = {}'.format(testNum, numOfTests, gas, minGas, maxGas, totalGas // countGas))
                            except:
                                pass


Main()
