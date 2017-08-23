import InputGenerator
import FormulaSolidityPort
import FormulaNativePython


MINIMUM_VALUE_SUPPLY  = 100
MAXIMUM_VALUE_SUPPLY  = 10**34
GROWTH_FACTOR_SUPPLY  = 1.5


MINIMUM_VALUE_RESERVE = 100
MAXIMUM_VALUE_RESERVE = 10**34
GROWTH_FACTOR_RESERVE = 1.5


MINIMUM_VALUE_RATIO   = 100000
MAXIMUM_VALUE_RATIO   = 900000
GROWTH_FACTOR_RATIO   = 1.25


MINIMUM_VALUE_AMOUNT  = 1
MAXIMUM_VALUE_AMOUNT  = 10**34
GROWTH_FACTOR_AMOUNT  = 1.5


def Main():    
    range_supply  = InputGenerator.ExponentialDistribution(MINIMUM_VALUE_SUPPLY ,MAXIMUM_VALUE_SUPPLY ,GROWTH_FACTOR_SUPPLY )
    range_reserve = InputGenerator.ExponentialDistribution(MINIMUM_VALUE_RESERVE,MAXIMUM_VALUE_RESERVE,GROWTH_FACTOR_RESERVE)
    range_ratio   = InputGenerator.ExponentialDistribution(MINIMUM_VALUE_RATIO  ,MAXIMUM_VALUE_RATIO  ,GROWTH_FACTOR_RATIO  )
    range_amount  = InputGenerator.ExponentialDistribution(MINIMUM_VALUE_AMOUNT ,MAXIMUM_VALUE_AMOUNT ,GROWTH_FACTOR_AMOUNT )
    
    testNum = 0
    numOfTests = len(range_supply)*len(range_reserve)*len(range_ratio)*len(range_amount)
    
    worstAbsoluteLoss = Record(range_supply[0],range_reserve[0],range_ratio[0],range_amount[0],0,0.0)
    worstRelativeLoss = Record(range_supply[0],range_reserve[0],range_ratio[0],range_amount[0],0,0.0)
    
    failureTransactionCount = 0
    invalidTransactionCount = 0
    
    try:
        for             supply  in range_supply :
            for         reserve in range_reserve:
                for     ratio   in range_ratio  :
                    for amount  in range_amount :
                        testNum += 1
                        if True:
                            resultSolidityPort = Run(FormulaSolidityPort,supply,reserve,ratio,amount)
                            resultNativePython = Run(FormulaNativePython,supply,reserve,ratio,amount)
                            if resultNativePython < 0:
                                invalidTransactionCount += 1
                            elif resultSolidityPort < 0:
                                failureTransactionCount += 1
                            elif resultNativePython < resultSolidityPort:
                                print 'Implementation Error:',Record(supply,reserve,ratio,amount,resultSolidityPort,resultNativePython)
                                return
                            else: # 0 <= resultSolidityPort <= resultNativePython
                                absoluteLoss = resultNativePython-resultSolidityPort
                                relativeLoss = 1-resultSolidityPort/resultNativePython
                                worstAbsoluteLoss.Update(supply,reserve,ratio,amount,resultSolidityPort,resultNativePython,absoluteLoss,relativeLoss)
                                worstRelativeLoss.Update(supply,reserve,ratio,amount,resultSolidityPort,resultNativePython,relativeLoss,absoluteLoss)
                                worstAbsoluteLossStr = 'worstAbsoluteLoss = {:.0f} (relativeLoss = {:.0f}%)'.format(worstAbsoluteLoss.major,worstAbsoluteLoss.minor*100)
                                worstRelativeLossStr = 'worstRelativeLoss = {:.0f}% (absoluteLoss = {:.0f})'.format(worstRelativeLoss.major*100,worstRelativeLoss.minor)
                                print 'Test {} out of {}: {}, {}'.format(testNum,numOfTests,worstAbsoluteLossStr,worstRelativeLossStr)
    except KeyboardInterrupt:
        print 'Process aborted by user request'
    
    print 'worstAbsoluteLoss:',worstAbsoluteLoss
    print 'worstRelativeLoss:',worstRelativeLoss
    
    print 'failureTransactionCount:',failureTransactionCount
    print 'invalidTransactionCount:',invalidTransactionCount


def Run(module,supply,reserve,ratio,amount):
    try:
        return module.calculatePurchaseReturn(supply,reserve,ratio,amount)
    except Exception:
        return -1


class Record():
    def __init__(self,supply,reserve,ratio,amount,resultSolidityPort,resultNativePython,major=0.0,minor=0.0):
        self._set(supply,reserve,ratio,amount,resultSolidityPort,resultNativePython,major,minor)
    def __str__(self):
        return ''.join(['\n\t{} = {}'.format(var,vars(self)[var]) for var in 'supply,reserve,ratio,amount,resultSolidityPort,resultNativePython'.split(',')])
    def Update(self,supply,reserve,ratio,amount,resultSolidityPort,resultNativePython,major,minor):
        if self.major < major or (self.major == major and self.minor < minor):
            self._set(supply,reserve,ratio,amount,resultSolidityPort,resultNativePython,major,minor)
    def _set(self,supply,reserve,ratio,amount,resultSolidityPort,resultNativePython,major,minor):
        self.__dict__.update({key:val for key,val in locals().iteritems() if key != 'self'})


Main()
