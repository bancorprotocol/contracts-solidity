from sys     import argv
from decimal import Decimal
from random  import randrange
from Formula import calculateSaleReturn


def formulaTest(_supply, _reserveBalance, _reserveRatio, _amount):
    fixed = calculateSaleReturn(_supply, _reserveBalance, _reserveRatio, _amount)
    real  = Decimal(_reserveBalance)*(1-(1-Decimal(_amount)/Decimal(_supply))**(100/Decimal(_reserveRatio)))
    if fixed > real:
        error = []
        error.append('error occurred on:')
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
worstAccuracy = 1
while n < size: # avoid creating a large range in memory
    _supply         = randrange(1,10**26)
    _reserveBalance = randrange(1,10**23)
    _reserveRatio   = randrange(1,99)
    _amount         = randrange(1,_supply)
    try:
        accuracy = formulaTest(_supply, _reserveBalance, _reserveRatio, _amount)
        if worstAccuracy > accuracy:
            worstAccuracy = accuracy
        print 'accuracy = {:.12f}, worst accuracy = {:.12f}'.format(accuracy,worstAccuracy)
        n += 1
    except Exception,error:
        pass
    except BaseException,error:
        print error
        break
