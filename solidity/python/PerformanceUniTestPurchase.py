import Web3Wrapper
import InputGenerator


MINIMUM_VALUE_SUPPLY = 100
MAXIMUM_VALUE_SUPPLY = 10 ** 34
SAMPLES_COUNT_SUPPLY = 50

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
    rangeSupply = InputGenerator.UniformDistribution(MINIMUM_VALUE_SUPPLY, MAXIMUM_VALUE_SUPPLY, SAMPLES_COUNT_SUPPLY)
    rangeBalance = InputGenerator.UniformDistribution(MINIMUM_VALUE_BALANCE, MAXIMUM_VALUE_BALANCE, SAMPLES_COUNT_BALANCE)
    rangeWeight = InputGenerator.UniformDistribution(MINIMUM_VALUE_WEIGHT, MAXIMUM_VALUE_WEIGHT, SAMPLES_COUNT_WEIGHT)
    rangeAmount = InputGenerator.UniformDistribution(MINIMUM_VALUE_AMOUNT, MAXIMUM_VALUE_AMOUNT, SAMPLES_COUNT_AMOUNT)

    testNum = 0
    numOfTests = len(rangeSupply) * len(rangeBalance) * len(rangeWeight) * len(rangeAmount)

    module = Web3Wrapper.Contract('BancorFormula').tester()

    maxGasOptimal = 0
    maxGasGeneral = 0

    for supply in rangeSupply:
        for balance in rangeBalance:
            for weight in rangeWeight:
                for amount in rangeAmount:
                    testNum += 1
                    if True:
                        try:
                            gas = module.calculatePurchaseReturn(supply, balance, weight, amount)
                            if amount <= balance:
                                maxGasOptimal = max(maxGasOptimal,gas)
                                print('Test {} out of {} (optimal case): gas = {}, maxGasOptimal = {}, maxGasGeneral = {}'.format(testNum, numOfTests, gas, maxGasOptimal, maxGasGeneral))
                            else:
                                maxGasGeneral = max(maxGasGeneral,gas)
                                print('Test {} out of {} (general case): gas = {}, maxGasOptimal = {}, maxGasGeneral = {}'.format(testNum, numOfTests, gas, maxGasOptimal, maxGasGeneral))
                        except:
                            pass


Main()
