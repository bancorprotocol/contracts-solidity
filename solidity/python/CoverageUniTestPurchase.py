import InputGenerator
import FormulaSolidityPort
import FormulaNativePython


MINIMUM_VALUE_SUPPLY = 100
MAXIMUM_VALUE_SUPPLY = 10 ** 34
SAMPLES_COUNT_SUPPLY = 150

MINIMUM_VALUE_BALANCE = 100
MAXIMUM_VALUE_BALANCE = 10 ** 34
SAMPLES_COUNT_BALANCE = 150

MINIMUM_VALUE_WEIGHT = 100000
MAXIMUM_VALUE_WEIGHT = 900000
SAMPLES_COUNT_WEIGHT = 10

MINIMUM_VALUE_AMOUNT = 1
MAXIMUM_VALUE_AMOUNT = 10 ** 34
SAMPLES_COUNT_AMOUNT = 150


def Main():
    rangeSupply = InputGenerator.UniformDistribution(MINIMUM_VALUE_SUPPLY, MAXIMUM_VALUE_SUPPLY, SAMPLES_COUNT_SUPPLY)
    rangeBalance = InputGenerator.UniformDistribution(MINIMUM_VALUE_BALANCE, MAXIMUM_VALUE_BALANCE, SAMPLES_COUNT_BALANCE)
    rangeWeight = InputGenerator.UniformDistribution(MINIMUM_VALUE_WEIGHT, MAXIMUM_VALUE_WEIGHT, SAMPLES_COUNT_WEIGHT)
    rangeAmount = InputGenerator.UniformDistribution(MINIMUM_VALUE_AMOUNT, MAXIMUM_VALUE_AMOUNT, SAMPLES_COUNT_AMOUNT)

    testNum = 0
    numOfTests = len(rangeSupply) * len(rangeBalance) * len(rangeWeight) * len(rangeAmount)

    worstAbsoluteLoss = Record(rangeSupply[0], rangeBalance[0], rangeWeight[0], rangeAmount[0], 0, 0.0)
    worstRelativeLoss = Record(rangeSupply[0], rangeBalance[0], rangeWeight[0], rangeAmount[0], 0, 0.0)

    failureTransactionCount = 0
    invalidTransactionCount = 0

    try:
        for supply in rangeSupply:
            for balance in rangeBalance:
                for weight in rangeWeight:
                    for amount in rangeAmount:
                        testNum += 1
                        if True:
                            resultSolidityPort = Run(FormulaSolidityPort, supply, balance, weight, amount)
                            resultNativePython = Run(FormulaNativePython, supply, balance, weight, amount)
                            if resultNativePython < 0:
                                invalidTransactionCount += 1
                            elif resultSolidityPort < 0:
                                failureTransactionCount += 1
                            elif resultNativePython < resultSolidityPort:
                                print 'Implementation Error:', Record(supply, balance, weight, amount, resultSolidityPort, resultNativePython)
                                return
                            else:  # 0 <= resultSolidityPort <= resultNativePython
                                absoluteLoss = resultNativePython - resultSolidityPort
                                relativeLoss = 1 - resultSolidityPort / resultNativePython
                                worstAbsoluteLoss.Update(supply, balance, weight, amount, resultSolidityPort, resultNativePython, absoluteLoss, relativeLoss)
                                worstRelativeLoss.Update(supply, balance, weight, amount, resultSolidityPort, resultNativePython, relativeLoss, absoluteLoss)
                                worstAbsoluteLossStr = 'worstAbsoluteLoss = {:.0f} (relativeLoss = {:.0f}%)'.format(worstAbsoluteLoss.major, worstAbsoluteLoss.minor * 100)
                                worstRelativeLossStr = 'worstRelativeLoss = {:.0f}% (absoluteLoss = {:.0f})'.format(worstRelativeLoss.major * 100, worstRelativeLoss.minor)
                                print 'Test {} out of {}: {}, {}'.format(testNum, numOfTests, worstAbsoluteLossStr, worstRelativeLossStr)
    except KeyboardInterrupt:
        print 'Process aborted by user request'

    print 'worstAbsoluteLoss:', worstAbsoluteLoss
    print 'worstRelativeLoss:', worstRelativeLoss

    print 'failureTransactionCount:', failureTransactionCount
    print 'invalidTransactionCount:', invalidTransactionCount


def Run(module, supply, balance, weight, amount):
    try:
        return module.calculatePurchaseReturn(supply, balance, weight, amount)
    except Exception:
        return -1


class Record():
    def __init__(self, supply, balance, weight, amount, resultSolidityPort, resultNativePython, major=0.0, minor=0.0):
        self._set(supply, balance, weight, amount, resultSolidityPort, resultNativePython, major, minor)

    def __str__(self):
        return ''.join(['\n\t{} = {}'.format(var, vars(self)[var]) for var in 'supply,balance,weight,amount,resultSolidityPort,resultNativePython'.split(',')])

    def Update(self, supply, balance, weight, amount, resultSolidityPort, resultNativePython, major, minor):
        if self.major < major or (self.major == major and self.minor < minor):
            self._set(supply, balance, weight, amount, resultSolidityPort, resultNativePython, major, minor)

    def _set(self, supply, balance, weight, amount, resultSolidityPort, resultNativePython, major, minor):
        self.__dict__.update({key: val for key, val in locals().iteritems() if key != 'self'})


Main()
