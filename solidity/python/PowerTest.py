from sys     import argv
from decimal import Decimal
from random  import randrange
from Formula import power
from Formula import calculateBestPrecision


def powerTest(baseN,baseD,expN,expD):
    precision = calculateBestPrecision(baseN,baseD,expN,expD)
    fixed = Decimal(power(baseN,baseD,expN,expD,precision))/(1<<precision)
    real  = (Decimal(baseN)/Decimal(baseD))**(Decimal(expN)/Decimal(expD))
    if fixed > real:
        error = []
        error.append('error occurred on:')
        error.append('baseN = {}'.format(baseN))
        error.append('baseD = {}'.format(baseD))
        error.append('expN  = {}'.format(expN))
        error.append('expD  = {}'.format(expD))
        error.append('fixed = {}'.format(fixed))
        error.append('real  = {}'.format(real))
        raise BaseException('\n'.join(error))
    return fixed/real


size = int(argv[1]) if len(argv) > 1 else 0
if size == 0:
    size = input('How many test-cases would you like to execute? ')


n = 0
worstAccuracy = 1
numOfFailures = 0
while n < size: # avoid creating a large range in memory
    baseN = randrange(2,10**26)
    baseD = randrange(1,baseN)
    expN  = randrange(1,100)
    expD  = randrange(1,100)
    try:
        accuracy = powerTest(baseN,baseD,expN,expD)
        worstAccuracy = min(worstAccuracy,accuracy)
    except Exception,error:
        accuracy = 0
        numOfFailures += 1
    except BaseException,error:
        print error
        break
    print 'Test #{}: accuracy = {:.12f}, worst accuracy = {:.12f}, num of failures = {}'.format(n,accuracy,worstAccuracy,numOfFailures)
    n += 1
