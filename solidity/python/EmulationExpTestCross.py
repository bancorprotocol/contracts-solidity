import Web3Wrapper
import InputGenerator
import FormulaSolidityPort


MINIMUM_VALUE_BALANCE = 100
MAXIMUM_VALUE_BALANCE = 10 ** 34
GROWTH_FACTOR_BALANCE = 2.5

MINIMUM_VALUE_RATIO = 100000
MAXIMUM_VALUE_RATIO = 900000
GROWTH_FACTOR_RATIO = 1.5

MINIMUM_VALUE_AMOUNT = 1
MAXIMUM_VALUE_AMOUNT = 10 ** 34
GROWTH_FACTOR_AMOUNT = 2.5


def Main():
    rangeBalance1 = InputGenerator.ExponentialDistribution(MINIMUM_VALUE_BALANCE, MAXIMUM_VALUE_BALANCE, GROWTH_FACTOR_BALANCE)
    rangeRatio1 = InputGenerator.ExponentialDistribution(MINIMUM_VALUE_RATIO, MAXIMUM_VALUE_RATIO, GROWTH_FACTOR_RATIO)
    rangeBalance2 = InputGenerator.ExponentialDistribution(MINIMUM_VALUE_BALANCE, MAXIMUM_VALUE_BALANCE, GROWTH_FACTOR_BALANCE)
    rangeRatio2 = InputGenerator.ExponentialDistribution(MINIMUM_VALUE_RATIO, MAXIMUM_VALUE_RATIO, GROWTH_FACTOR_RATIO)
    rangeAmount = InputGenerator.ExponentialDistribution(MINIMUM_VALUE_AMOUNT, MAXIMUM_VALUE_AMOUNT, GROWTH_FACTOR_AMOUNT)

    testNum = 0
    numOfTests = len(rangeBalance1) * len(rangeRatio1) * len(rangeBalance2) * len(rangeRatio2) * len(rangeAmount)

    FormulaContractAddr = Web3Wrapper.Contract('BancorFormula').getter()

    for balance1 in rangeBalance1:
        for ratio1 in rangeRatio1:
            for balance2 in rangeBalance2:
                for ratio2 in rangeRatio2:
                    for amount in rangeAmount:
                        testNum += 1
                        if True:
                            resultSolidityPort = Run(FormulaSolidityPort, balance1, ratio1, balance2, ratio2, amount)
                            resultContractAddr = Run(FormulaContractAddr, balance1, ratio1, balance2, ratio2, amount)
                            print('Test {} out of {}: resultSolidityPort = {}, resultContractAddr = {}'.format(testNum, numOfTests, resultSolidityPort, resultContractAddr))
                            if resultSolidityPort != resultContractAddr:
                                print('Emulation Error:')
                                print('balance1 = {}'.format(balance1))
                                print('ratio1   = {}'.format(ratio1))
                                print('balance2 = {}'.format(balance2))
                                print('ratio2   = {}'.format(ratio2))
                                print('amount   = {}'.format(amount))
                                return


def Run(module, balance1, ratio1, balance2, ratio2, amount):
    try:
        return module.calculateCrossReserveReturn(balance1, ratio1, balance2, ratio2, amount)
    except:
        return -1


Main()
