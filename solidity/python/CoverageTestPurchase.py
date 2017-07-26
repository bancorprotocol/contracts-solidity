import sys
import math
import BancorFormula
import ActualFormula


MINIMUM_VALUE_SUPPLY  = 100
MAXIMUM_VALUE_SUPPLY  = 10**34
GROWTH_FACTOR_SUPPLY  = 1.5


MINIMUM_VALUE_RESERVE = 100
MAXIMUM_VALUE_RESERVE = 10**34
GROWTH_FACTOR_RESERVE = 1.5


MINIMUM_VALUE_RATIO   = 10
MAXIMUM_VALUE_RATIO   = 90
GROWTH_FACTOR_RATIO   = 1.25


MINIMUM_VALUE_AMOUNT  = 1
MAXIMUM_VALUE_AMOUNT  = 10**34
GROWTH_FACTOR_AMOUNT  = 1.5


def Main():    
    range_supply  = GenerateRange(MINIMUM_VALUE_SUPPLY ,MAXIMUM_VALUE_SUPPLY ,GROWTH_FACTOR_SUPPLY )
    range_reserve = GenerateRange(MINIMUM_VALUE_RESERVE,MAXIMUM_VALUE_RESERVE,GROWTH_FACTOR_RESERVE)
    range_ratio   = GenerateRange(MINIMUM_VALUE_RATIO  ,MAXIMUM_VALUE_RATIO  ,GROWTH_FACTOR_RATIO  )
    range_amount  = GenerateRange(MINIMUM_VALUE_AMOUNT ,MAXIMUM_VALUE_AMOUNT ,GROWTH_FACTOR_AMOUNT )
    
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
                        if amount <= reserve:
                            bancor,actual = Test(supply,reserve,ratio,amount)
                            if actual < 0:
                                invalidTransactionCount += 1
                            elif bancor < 0:
                                failureTransactionCount += 1
                            elif actual < bancor:
                                print 'Implementation Error:',Record(supply,reserve,ratio,amount,bancor,actual)
                                return
                            else: # 0 <= bancor <= actual
                                absoluteLoss = actual-bancor
                                relativeLoss = 1-bancor/actual
                                worstAbsoluteLoss.Update(supply,reserve,ratio,amount,bancor,actual,absoluteLoss,relativeLoss)
                                worstRelativeLoss.Update(supply,reserve,ratio,amount,bancor,actual,relativeLoss,absoluteLoss)
                                worstAbsoluteLossStr = 'worstAbsoluteLoss = {:.0f} (relativeLoss = {:.0f}%)'.format(worstAbsoluteLoss.major,worstAbsoluteLoss.minor*100)
                                worstRelativeLossStr = 'worstRelativeLoss = {:.0f}% (absoluteLoss = {:.0f})'.format(worstRelativeLoss.major*100,worstRelativeLoss.minor)
                                print 'Test {} out of {}: {}, {}'.format(testNum,numOfTests,worstAbsoluteLossStr,worstRelativeLossStr)
    except KeyboardInterrupt:
        print 'Process aborted by user request'
    
    print 'worstAbsoluteLoss:',worstAbsoluteLoss
    print 'worstRelativeLoss:',worstRelativeLoss
    
    print 'failureTransactionCount:',failureTransactionCount
    print 'invalidTransactionCount:',invalidTransactionCount


def Test(supply,reserve,ratio,amount):
    try:
        bancor = BancorFormula.calculatePurchaseReturn(supply,reserve,ratio,amount)
    except Exception:
        bancor = -1
    try:
        actual = ActualFormula.calculatePurchaseReturn(supply,reserve,ratio,amount)
    except Exception:
        actual = -1
    return bancor,actual


def GenerateRange(minimumValue,maximumValue,growthFactor):
    return [int(minimumValue*growthFactor**n) for n in range(int(math.log(float(maximumValue)/float(minimumValue),growthFactor))+1)]


class Record():
    def __init__(self,supply,reserve,ratio,amount,bancor,actual,major=0.0,minor=0.0):
        self._set(supply,reserve,ratio,amount,bancor,actual,major,minor)
    def __str__(self):
        return ', '.join(['{} = {}'.format(var,eval('self.'+var)) for var in 'supply,reserve,ratio,amount,bancor,actual'.split(',')])
    def Update(self,supply,reserve,ratio,amount,bancor,actual,major,minor):
        if self.major < major or (self.major == major and self.minor < minor):
            self._set(supply,reserve,ratio,amount,bancor,actual,major,minor)
    def _set(self,supply,reserve,ratio,amount,bancor,actual,major,minor):
        self.supply  = supply 
        self.reserve = reserve
        self.ratio   = ratio  
        self.amount  = amount 
        self.bancor  = bancor 
        self.actual  = actual 
        self.major   = major  
        self.minor   = minor  


Main()
