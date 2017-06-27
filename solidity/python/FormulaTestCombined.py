from sys     import argv
from decimal import Decimal
from random  import randrange
from Formula import calculateSaleReturn
from Formula import calculatePurchaseReturn


def formulaTest(_supply, _reserveBalance, _reserveRatio, _amount):
    _new_amount = calculatePurchaseReturn(_supply, _reserveBalance, _reserveRatio, _amount)
    _old_amount = calculateSaleReturn(_supply+_new_amount, _reserveBalance+_amount, _reserveRatio, _new_amount)	
    if _old_amount > _amount:
        error = []
        error.append('error occurred on:')
        error.append('_supply         = {}'.format(_supply))
        error.append('_reserveBalance = {}'.format(_reserveBalance))
        error.append('_reserveRatio   = {}'.format(_reserveRatio))
        error.append('_amount         = {}'.format(_amount))
        raise BaseException('\n'.join(error))
    return float(Decimal(_old_amount) / Decimal(_amount))


size = int(argv[1]) if len(argv) > 1 else 0
if size == 0:
    size = input('How many test-cases would you like to execute? ')


n = 0
worstGain = 1
while n < size: # avoid creating a large range in memory
    _supply         = randrange(1,10**26)
    _reserveBalance = randrange(1,10**23)
    _reserveRatio   = randrange(1,99)
    _amount         = randrange(1,_supply)
    try:
        gain = formulaTest(_supply, _reserveBalance, _reserveRatio, _amount)
        if worstGain > gain:
            worstGain = gain
        print 'gain = {:.12f}, worst gain = {:.12f}'.format(gain,worstGain)
        n += 1
    except Exception,error:
        pass
    except BaseException,error:
        print error
        break
