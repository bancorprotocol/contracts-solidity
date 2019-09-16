import Web3Wrapper
import InputGenerator
import FormulaSolidityPort


MINIMUM_VALUE_SUPPLY = 100
MAXIMUM_VALUE_SUPPLY = 10 ** 34
GROWTH_FACTOR_SUPPLY = 2.5

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
    rangeSupply = InputGenerator.ExponentialDistribution(MINIMUM_VALUE_SUPPLY, MAXIMUM_VALUE_SUPPLY, GROWTH_FACTOR_SUPPLY)
    rangeBalance = InputGenerator.ExponentialDistribution(MINIMUM_VALUE_BALANCE, MAXIMUM_VALUE_BALANCE, GROWTH_FACTOR_BALANCE)
    rangeRatio = InputGenerator.ExponentialDistribution(MINIMUM_VALUE_RATIO, MAXIMUM_VALUE_RATIO, GROWTH_FACTOR_RATIO)
    rangeAmount = InputGenerator.ExponentialDistribution(MINIMUM_VALUE_AMOUNT, MAXIMUM_VALUE_AMOUNT, GROWTH_FACTOR_AMOUNT)

    testNum = 0
    numOfTests = len(rangeSupply) * len(rangeBalance) * len(rangeRatio) * len(rangeAmount)

    FormulaContractAddr = Web3Wrapper.Contract('BancorFormula').getter()

    for supply in rangeSupply:
        for balance in rangeBalance:
            for ratio in rangeRatio:
                for amount in rangeAmount:
                    testNum += 1
                    if True:
                        resultSolidityPort = Run(FormulaSolidityPort, supply, balance, ratio, amount)
                        resultContractAddr = Run(FormulaContractAddr, supply, balance, ratio, amount)
                        print('Test {} out of {}: resultSolidityPort = {}, resultContractAddr = {}'.format(testNum, numOfTests, resultSolidityPort, resultContractAddr))
                        if resultSolidityPort != resultContractAddr:
                            print('Emulation Error:')
                            print('supply  = {}'.format(supply))
                            print('balance = {}'.format(balance))
                            print('ratio   = {}'.format(ratio))
                            print('amount  = {}'.format(amount))
                            return


def Run(module, supply, balance, ratio, amount):
    try:
        return module.calculatePurchaseReturn(supply, balance, ratio, amount)
    except:
        return -1


Main()
