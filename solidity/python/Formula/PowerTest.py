from sys     import argv
from decimal import Decimal
from random  import randrange
from Power   import power


PRECISION = 32


def powerTest(_baseN, _baseD, _expN, _expD):
    fixed = power(_baseN, _baseD, _expN, _expD, PRECISION) >> PRECISION
    real  = (Decimal(_baseN)/Decimal(_baseD))**(Decimal(_expN)/Decimal(_expD))
    if fixed > real:
        error = []
        error.append('error occurred on {}^{}:'.format(Decimal(_baseN)/Decimal(_baseD),Decimal(_expN)/Decimal(_expD)))
        error.append('fixed result = {}'.format(fixed))
        error.append('real  result = {}'.format(real))
        raise BaseException('\n'.join(error))
    return float(fixed / real)


size = int(argv[1]) if len(argv) > 1 else 0
if size == 0:
    size = input('How many test-cases would you like to execute? ')


n = 0
worstAccuracy = 1
numOfFailures = 0
while n < size: # avoid creating a large range in memory
    _baseN = randrange(1<<PRECISION,1<<(256-PRECISION))
    _baseD = randrange(1<<PRECISION,_baseN+1)
    _expN  = randrange(1<<PRECISION,1<<(256-PRECISION))
    _expD  = randrange(1<<PRECISION,_expN+1)
    try:
        accuracy = powerTest(_baseN, _baseD, _expN, _expD)
        worstAccuracy = min(worstAccuracy,accuracy)
    except Exception,error:
        accuracy = 0
        numOfFailures += 1
    except BaseException,error:
        print error
        break
    print 'Test #{}: accuracy = {:.12f}, worst accuracy = {:.12f}, num of failures = {}'.format(n,accuracy,worstAccuracy,numOfFailures)
    n += 1
