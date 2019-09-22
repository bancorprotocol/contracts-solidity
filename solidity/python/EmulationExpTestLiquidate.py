import Web3Wrapper
import InputGenerator
import FormulaSolidityPort


MINIMUM_VALUE_SUPPLY = 100
MAXIMUM_VALUE_SUPPLY = 10 ** 34
GROWTH_FACTOR_SUPPLY = 2.5

MINIMUM_VALUE_BALANCE = 100
MAXIMUM_VALUE_BALANCE = 10 ** 34
GROWTH_FACTOR_BALANCE = 2.5

MINIMUM_VALUE_RATIOS = 100000
MAXIMUM_VALUE_RATIOS = 1900000
GROWTH_FACTOR_RATIOS = 1.5

MINIMUM_VALUE_AMOUNT = 1
MAXIMUM_VALUE_AMOUNT = 10 ** 34
GROWTH_FACTOR_AMOUNT = 2.5


def Main():
    rangeSupply = InputGenerator.ExponentialDistribution(MINIMUM_VALUE_SUPPLY, MAXIMUM_VALUE_SUPPLY, GROWTH_FACTOR_SUPPLY)
    rangeBalance = InputGenerator.ExponentialDistribution(MINIMUM_VALUE_BALANCE, MAXIMUM_VALUE_BALANCE, GROWTH_FACTOR_BALANCE)
    rangeRatios = InputGenerator.ExponentialDistribution(MINIMUM_VALUE_RATIOS, MAXIMUM_VALUE_RATIOS, GROWTH_FACTOR_RATIOS)
    rangeAmount = InputGenerator.ExponentialDistribution(MINIMUM_VALUE_AMOUNT, MAXIMUM_VALUE_AMOUNT, GROWTH_FACTOR_AMOUNT)

    testNum = 0
    numOfTests = len(rangeSupply) * len(rangeBalance) * len(rangeRatios) * len(rangeAmount)

    FormulaContractAddr = Web3Wrapper.Contract('BancorFormula').getter()

    for supply in rangeSupply:
        for balance in rangeBalance:
            for ratios in rangeRatios:
                for amount in rangeAmount:
                    testNum += 1
                    if amount <= supply:
                        resultSolidityPort = Run(FormulaSolidityPort, supply, balance, ratios, amount)
                        resultContractAddr = Run(FormulaContractAddr, supply, balance, ratios, amount)
                        print('Test {} out of {}: resultSolidityPort = {}, resultContractAddr = {}'.format(testNum, numOfTests, resultSolidityPort, resultContractAddr))
                        if resultSolidityPort != resultContractAddr:
                            print('Emulation Error:')
                            print('supply  = {}'.format(supply))
                            print('balance = {}'.format(balance))
                            print('ratios  = {}'.format(ratios))
                            print('amount  = {}'.format(amount))
                            return


def Run(module, supply, balance, ratios, amount):
    try:
        return module.calculateLiquidateReturn(supply, balance, ratios, amount)
    except:
        return -1


Main()
