from sys     import argv
from math    import log
from random  import randrange
from Formula import calculateSaleReturn
from Formula import calculatePurchaseReturn


def calculateSaleReturnTest(_supply, _reserveBalance, _reserveRatio, _sellAmount):
    fixed = calculateSaleReturn(_supply, _reserveBalance, _reserveRatio, _sellAmount)
    real = _reserveBalance * (1-(1-float(_sellAmount)/float(_supply))**(100.0/_reserveRatio))
    return fixed,real


def calculatePurchaseReturnTest(_supply, _reserveBalance, _reserveRatio, _depositAmount):
    fixed = calculatePurchaseReturn(_supply, _reserveBalance, _reserveRatio, _depositAmount)
    real = _supply * ((1+float(_depositAmount)/float(_reserveBalance))**(_reserveRatio/100.0)-1)
    return fixed,real


def runTest(func, _supply, _reserveBalance, _reserveRatio, _amount):
    try:
        fixed,real = func(_supply, _reserveBalance, _reserveRatio, _amount)
        if fixed > real:
            print 'error occurred for {}:'.format(func.__name__)
            print '_supply = {}'.format(_supply)
            print '_reserveBalance = {}'.format(_reserveBalance)
            print '_reserveRatio = {}'.format(_reserveRatio)
            print '_amount = {}'.format(_amount)
            print 'fixed result = {}'.format(fixed)
            print 'real  result = {}'.format(int(real))
            return 2
        return fixed / real
    except Exception, error:
        return 0


size = int(argv[1]) if len(argv) > 1 else 0
if size == 0:
    size = input('How many test-cases would you like to execute? ')


n = 0
worst_ratio = 1
while n < size:
    _supply          = randrange(1,80000000*10**18)
    _reserveBalance  = randrange(1,80000*10**18)
    _reserveRatio    = randrange(1,99)
    _amount          = randrange(1,_supply)
    saleAccuracy     = runTest(calculateSaleReturnTest    , _supply, _reserveBalance, _reserveRatio, _amount)
    purchaseAccuracy = runTest(calculatePurchaseReturnTest, _supply, _reserveBalance, _reserveRatio, _amount)
    if saleAccuracy > 1 or purchaseAccuracy > 1:
        break
    if saleAccuracy > 0 and purchaseAccuracy > 0:
        print 'saleAccuracy = {:.12f}, purchaseAccuracy = {:.12f}'.format(saleAccuracy,purchaseAccuracy)
        n += 1
