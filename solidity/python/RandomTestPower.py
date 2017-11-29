import sys
import random
import FormulaSolidityPort
import FormulaNativePython


def powerTest(baseN, baseD, expN, expD):
    resultSolidityPort, precision = FormulaSolidityPort.power(baseN, baseD, expN, expD)
    resultNativePython = FormulaNativePython.power(baseN, baseD, expN, expD, precision)
    if resultSolidityPort > resultNativePython:
        error = ['Implementation Error:']
        error.append('baseN              = {}'.format(baseN             ))
        error.append('baseD              = {}'.format(baseD             ))
        error.append('expN               = {}'.format(expN              ))
        error.append('expD               = {}'.format(expD              ))
        error.append('resultSolidityPort = {}'.format(resultSolidityPort))
        error.append('resultNativePython = {}'.format(resultNativePython))
        raise BaseException('\n'.join(error))
    return resultSolidityPort/resultNativePython


size = int(sys.argv[1]) if len(sys.argv) > 1 else 0
if size == 0:
    size = input('How many test-cases would you like to execute? ')


worstAccuracy = 1
numOfFailures = 0


for n in xrange(size):
    baseN = random.randrange(2, 10**26)
    baseD = random.randrange(1, baseN)
    expN  = random.randrange(1, 1000000)
    expD  = random.randrange(expN, 1000001)
    try:
        accuracy = powerTest(baseN, baseD, expN, expD)
        worstAccuracy = min(worstAccuracy, accuracy)
    except Exception, error:
        accuracy = 0
        numOfFailures += 1
    except BaseException, error:
        print error
        break
    print 'Test #{}: accuracy = {:.12f}, worst accuracy = {:.12f}, num of failures = {}'.format(n, accuracy, worstAccuracy, numOfFailures)
