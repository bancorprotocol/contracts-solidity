import Web3Wrapper
import InputGenerator
import FormulaSolidityPort


MINIMUM_VALUE_STAKED = 10 ** 23
MAXIMUM_VALUE_STAKED = 10 ** 24
GROWTH_FACTOR_STAKED = 1.25

MINIMUM_VALUE_BALANCE = 10 ** 23
MAXIMUM_VALUE_BALANCE = 10 ** 24
GROWTH_FACTOR_BALANCE = 1.25

MINIMUM_VALUE_RATE = 100000
MAXIMUM_VALUE_RATE = 900000
GROWTH_FACTOR_RATE = 1.25


def Main():
    rangeStaked1 = InputGenerator.ExponentialDistribution(MINIMUM_VALUE_STAKED, MAXIMUM_VALUE_STAKED, GROWTH_FACTOR_STAKED)
    rangeBalance1 = InputGenerator.ExponentialDistribution(MINIMUM_VALUE_BALANCE, MAXIMUM_VALUE_BALANCE, GROWTH_FACTOR_BALANCE)
    rangeBalance2 = InputGenerator.ExponentialDistribution(MINIMUM_VALUE_BALANCE, MAXIMUM_VALUE_BALANCE, GROWTH_FACTOR_BALANCE)
    rangeRate1 = InputGenerator.ExponentialDistribution(MINIMUM_VALUE_RATE, MAXIMUM_VALUE_RATE, GROWTH_FACTOR_RATE)
    rangeRate2 = InputGenerator.ExponentialDistribution(MINIMUM_VALUE_RATE, MAXIMUM_VALUE_RATE, GROWTH_FACTOR_RATE)

    testNum = 0
    numOfTests = len(rangeStaked1) * len(rangeBalance1) * len(rangeBalance2) * len(rangeRate1) * len(rangeRate2)

    FormulaContract = Web3Wrapper.Contract('BancorFormula')
    FormulaContract.setter().init()
    FormulaContractAddr = FormulaContract.getter()

    for staked1 in rangeStaked1:
        for balance1 in rangeBalance1:
            for balance2 in rangeBalance2:
                for rate1 in rangeRate1:
                    for rate2 in rangeRate2:
                        testNum += 1
                        if True:
                            resultSolidityPort = Run(FormulaSolidityPort, staked1, balance1, balance2, rate1, rate2)
                            resultContractAddr = Run(FormulaContractAddr, staked1, balance1, balance2, rate1, rate2)
                            print('Test {} out of {}: resultSolidityPort = {}, resultContractAddr = {}'.format(testNum, numOfTests, resultSolidityPort, resultContractAddr))
                            if resultSolidityPort != resultContractAddr:
                                print('Emulation Error:')
                                print('staked1  = {}'.format(staked1))
                                print('balance1 = {}'.format(balance1))
                                print('balance2 = {}'.format(balance2))
                                print('rate1    = {}'.format(rate1))
                                print('rate2    = {}'.format(rate2))
                                return


def Run(module, staked1, balance1, balance2, rate1, rate2):
    try:
        return ','.join(str(x) for x in module.balancedWeights(staked1, balance1, balance2, rate1, rate2))
    except:
        return -1


Main()
