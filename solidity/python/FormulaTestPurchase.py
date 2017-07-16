from sys     import argv
from decimal import Decimal
from random  import randrange
from Formula import calculatePurchaseReturn


def formulaTest(supply,reserve,ratio,amount):
    fixed = Decimal(calculatePurchaseReturn(supply,reserve,ratio,amount))
    real  = Decimal(supply)*((1+Decimal(amount)/Decimal(reserve))**(Decimal(ratio)/100)-1)
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


n = 0
worstAccuracy = 1
numOfFailures = 0
while n < size: # avoid creating a large range in memory
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
    n += 1
