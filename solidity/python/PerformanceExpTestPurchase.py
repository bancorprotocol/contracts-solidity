import Web3Wrapper
import InputGenerator


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
