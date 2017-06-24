from sys     import argv
from math    import log
from decimal import Decimal
from random  import randrange
from Formula import calculateSaleReturn
from Formula import calculatePurchaseReturn


def calculateSaleReturnTest(_supply, _reserveBalance, _reserveRatio, _sellAmount):
    fixed = calculateSaleReturn(_supply, _reserveBalance, _reserveRatio, _sellAmount)
    real  = Decimal(_reserveBalance)*(1-(1-Decimal(_sellAmount)/Decimal(_supply))**(100/Decimal(_reserveRatio)))
    return fixed,real


def calculatePurchaseReturnTest(_supply, _reserveBalance, _reserveRatio, _depositAmount):
    fixed = calculatePurchaseReturn(_supply, _reserveBalance, _reserveRatio, _depositAmount)
    real  = Decimal(_supply)*((1+Decimal(_depositAmount)/Decimal(_reserveBalance))**(Decimal(_reserveRatio)/100)-1)
    return fixed,real


def runTest(func, _supply, _reserveBalance, _reserveRatio, _amount):
    fixed,real = func(_supply, _reserveBalance, _reserveRatio, _amount)
    if fixed > real:
        error = []
        error.append('error occurred in {}:'.format(func.__name__))
        error.append('_supply         = {}'.format(_supply))
        error.append('_reserveBalance = {}'.format(_reserveBalance))
        error.append('_reserveRatio   = {}'.format(_reserveRatio))
        error.append('_amount         = {}'.format(_amount))
        error.append('fixed result    = {}'.format(fixed))
        error.append('real  result    = {}'.format(real))
        raise BaseException('\n'.join(error))
    return float(fixed / real)


size = int(argv[1]) if len(argv) > 1 else 0
if size == 0:
    size = input('How many test-cases would you like to execute? ')


n = 0
worst_sale_acc = 1
worst_purchase_acc = 1
while n < size: # avoid creating a large range in memory
    _supply          = randrange(1,80000000*10**18)
    _reserveBalance  = randrange(1,80000*10**18)
    _reserveRatio    = randrange(1,99)
    _amount          = randrange(1,_supply)
    try:
        sale_acc     = runTest(calculateSaleReturnTest    , _supply, _reserveBalance, _reserveRatio, _amount)
        purchase_acc = runTest(calculatePurchaseReturnTest, _supply, _reserveBalance, _reserveRatio, _amount)
        worst_sale_acc     = min(worst_sale_acc    ,sale_acc    )
        worst_purchase_acc = min(worst_purchase_acc,purchase_acc)
        print 'sale accuracy = {:.12f}, purchase accuracy = {:.12f}, worst sale accuracy = {:.12f}, worst purchase accuracy = {:.12f}'.format(sale_acc,purchase_acc,worst_sale_acc,worst_purchase_acc)
        n += 1
    except Exception,error:
        pass
    except BaseException,error:
        print error
        break
