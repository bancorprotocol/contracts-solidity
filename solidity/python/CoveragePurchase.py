from math    import log
from decimal import Decimal
from decimal import getcontext
from Formula import calculatePurchaseReturn


MINIMUM_VALUE_SUPPLY  = 1
MAXIMUM_VALUE_SUPPLY  = 10**34
GROWTH_FACTOR_SUPPLY  = 1.5


MINIMUM_VALUE_RESERVE = 1
MAXIMUM_VALUE_RESERVE = 10**34
GROWTH_FACTOR_RESERVE = 1.5


MINIMUM_VALUE_RATIO   = 10
MAXIMUM_VALUE_RATIO   = 90
GROWTH_FACTOR_RATIO   = 1.25


MINIMUM_VALUE_AMOUNT  = 1
MAXIMUM_VALUE_AMOUNT  = 10**34
GROWTH_FACTOR_AMOUNT  = 1.5


def Main():
    getcontext().prec = 80 # 78 digits for a maximum of 2^256-1, and 2 more digits for after the decimal point
    
    range_supply  = [int(MINIMUM_VALUE_SUPPLY *GROWTH_FACTOR_SUPPLY **n) for n in range(int(log(MAXIMUM_VALUE_SUPPLY ,GROWTH_FACTOR_SUPPLY ))+1)]
    range_reserve = [int(MINIMUM_VALUE_RESERVE*GROWTH_FACTOR_RESERVE**n) for n in range(int(log(MAXIMUM_VALUE_RESERVE,GROWTH_FACTOR_RESERVE))+1)]
    range_ratio   = [int(MINIMUM_VALUE_RATIO  *GROWTH_FACTOR_RATIO  **n) for n in range(int(log(MAXIMUM_VALUE_RATIO  ,GROWTH_FACTOR_RATIO  ))+1)]
    range_amount  = [int(MINIMUM_VALUE_AMOUNT *GROWTH_FACTOR_AMOUNT **n) for n in range(int(log(MAXIMUM_VALUE_AMOUNT ,GROWTH_FACTOR_AMOUNT ))+1)]
    
    testNum = 0
    numOfTests = len(range_supply)*len(range_reserve)*len(range_ratio)*len(range_amount)
    
    worstAbsoluteLoss = Record(range_supply[0],range_reserve[0],range_ratio[0],range_amount[0],0,0.0)
    worstRelativeLoss = Record(range_supply[0],range_reserve[0],range_ratio[0],range_amount[0],0,0.0)
    
    try:
        for             supply  in range_supply :
            for         reserve in range_reserve:
                for     ratio   in range_ratio  :
                    for amount  in range_amount :
                        testNum += 1
                        if amount > reserve:
                            continue
                        fixed,real = Test(supply,reserve,ratio,amount)
                        if real < 0:
                            pass # Transaction Invalid
                        elif fixed < 0:
                            pass # Transaction Failure
                        elif real < fixed:
                            print 'Implementation Error:',Record(supply,reserve,ratio,amount,fixed,real)
                            return
                        else: # 0 <= fixed <= real
                            absoluteLoss = real-fixed
                            relativeLoss = 1-fixed/real
                            worstAbsoluteLoss.Update(supply,reserve,ratio,amount,fixed,real,absoluteLoss,relativeLoss)
                            worstRelativeLoss.Update(supply,reserve,ratio,amount,fixed,real,relativeLoss,absoluteLoss)
                            worstAbsoluteLossStr = 'worstAbsoluteLoss = {:.0f} (relativeLoss = {:.0f}%)'.format(worstAbsoluteLoss.major,worstAbsoluteLoss.minor*100)
                            worstRelativeLossStr = 'worstRelativeLoss = {:.0f}% (absoluteLoss = {:.0f})'.format(worstRelativeLoss.major*100,worstRelativeLoss.minor)
                            print 'Test {} out of {}: {}, {}'.format(testNum,numOfTests,worstAbsoluteLossStr,worstRelativeLossStr)
    except KeyboardInterrupt:
        print 'Process aborted by user request'
    
    print 'worstAbsoluteLoss:',worstAbsoluteLoss
    print 'worstRelativeLoss:',worstRelativeLoss


def Test(supply,reserve,ratio,amount):
    try:
        fixed = calculatePurchaseReturn(supply,reserve,ratio,amount)
    except Exception:
        fixed = -1
    try:
        real = Decimal(supply)*((1+Decimal(amount)/Decimal(reserve))**(Decimal(ratio)/100)-1)
    except Exception:
        real = -1
    return fixed,real


class Record():
    def __init__(self,supply,reserve,ratio,amount,fixed,real,major=0.0,minor=0.0):
        self._set(supply,reserve,ratio,amount,fixed,real,major,minor)
    def __str__(self):
        return ', '.join(['{} = {}'.format(var,eval('self.'+var)) for var in 'supply,reserve,ratio,amount,fixed,real'.split(',')])
    def Update(self,supply,reserve,ratio,amount,fixed,real,major,minor):
        if self.major < major or (self.major == major and self.minor < minor):
            self._set(supply,reserve,ratio,amount,fixed,real,major,minor)
    def _set(self,supply,reserve,ratio,amount,fixed,real,major,minor):
        self.supply  = supply 
        self.reserve = reserve
        self.ratio   = ratio  
        self.amount  = amount 
        self.fixed   = fixed  
        self.real    = real   
        self.major   = major  
        self.minor   = minor  


Main()