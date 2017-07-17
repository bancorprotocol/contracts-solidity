from sys     import argv
from decimal import Decimal
from Formula import calculateSaleReturn


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


bgn = 10**17
end = 10**26
gap = (end-bgn)/size


worstAccuracy = 1
numOfFailures = 0


for n in xrange(size):
    supply  = 10**26
    reserve = 10**23
    ratio   = 10
    amount  = bgn+gap*n
    try:
        accuracy = formulaTest(supply,reserve,ratio,amount)
        worstAccuracy = min(worstAccuracy,accuracy)
    except Exception,error:
        accuracy = 0
        numOfFailures += 1
    except BaseException,error:
        print error
        break
    print 'Test #{}: amount = {:26d}, accuracy = {:.12f}, worst accuracy = {:.12f}, num of failures = {}'.format(n,amount,accuracy,worstAccuracy,numOfFailures)
