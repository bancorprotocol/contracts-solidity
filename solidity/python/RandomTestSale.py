from sys     import argv
from decimal import Decimal
from random  import randrange
from Formula import calculateSaleReturn


from decimal import getcontext
getcontext().prec = 80 # 78 digits for a maximum of 2^256-1, and 2 more digits for after the decimal point


def formulaTest(supply,reserve,ratio,amount):
    fixed = Decimal(calculateSaleReturn(supply,reserve,ratio,amount))
    real  = Decimal(reserve)*(1-(1-Decimal(amount)/Decimal(supply))**(100/Decimal(ratio)))
    if fixed > real:
        error = []
        error.append('error occurred on:')
        error.append('supply  = {}'.format(supply))
        error.append('reserve = {}'.format(reserve))
        error.append('ratio   = {}'.format(ratio))
        error.append('amount  = {}'.format(amount))
        error.append('fixed   = {}'.format(fixed))
        error.append('real    = {}'.format(real))
        raise BaseException('\n'.join(error))
    return fixed/real


size = int(argv[1]) if len(argv) > 1 else 0
if size == 0:
    size = input('How many test-cases would you like to execute? ')


worstAccuracy = 1
numOfFailures = 0


for n in xrange(size):
    supply  = randrange(2,10**26)
    reserve = randrange(1,10**23)
    ratio   = randrange(1,99)
    amount  = randrange(1,supply)
    try:
        accuracy = formulaTest(supply,reserve,ratio,amount)
        worstAccuracy = min(worstAccuracy,accuracy)
    except Exception,error:
        accuracy = 0
        numOfFailures += 1
    except BaseException,error:
        print error
        break
    print 'Test #{}: accuracy = {:.12f}, worst accuracy = {:.12f}, num of failures = {}'.format(n,accuracy,worstAccuracy,numOfFailures)
