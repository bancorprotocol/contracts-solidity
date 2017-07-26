import sys
import random
import BancorFormula
import ActualFormula


def powerTest(baseN,baseD,expN,expD):
    precision = BancorFormula.calculateBestPrecision(baseN,baseD,expN,expD)
    bancor = BancorFormula.power(baseN,baseD,expN,expD,precision)
    actual = ActualFormula.power(baseN,baseD,expN,expD,precision)
    if bancor > actual:
        error = []
        error.append('error occurred on:')
        error.append('baseN  = {}'.format(baseN ))
        error.append('baseD  = {}'.format(baseD ))
        error.append('expN   = {}'.format(expN  ))
        error.append('expD   = {}'.format(expD  ))
        error.append('bancor = {}'.format(bancor))
        error.append('actual = {}'.format(actual))
        raise BaseException('\n'.join(error))
    return bancor/actual


size = int(sys.argv[1]) if len(sys.argv) > 1 else 0
if size == 0:
    size = input('How many test-cases would you like to execute? ')


worstAccuracy = 1
numOfFailures = 0


for n in xrange(size):
    baseN = random.randrange(2,10**26)
    baseD = random.randrange(1,baseN)
    expN  = random.randrange(1,100)
    expD  = random.randrange(1,100)
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
