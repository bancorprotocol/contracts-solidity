from sys     import argv
from decimal import Decimal
from Formula import calculatePurchaseReturn


from decimal import getcontext
getcontext().prec = 80 # 78 digits for a maximum of 2^256-1, and 2 more digits for after the decimal point


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


bgn = 10**14
end = 10**23
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
    print 'Test #{}: amount = {:23d}, accuracy = {:.12f}, worst accuracy = {:.12f}, num of failures = {}'.format(n,amount,accuracy,worstAccuracy,numOfFailures)
