import sys
import random
import FormulaSolidityPort
import FormulaNativePython


def formulaTest(supply, balance, weight, amount):
    resultSolidityPort = FormulaSolidityPort.calculatePurchaseReturn(supply, balance, weight, amount)
    resultNativePython = FormulaNativePython.calculatePurchaseReturn(supply, balance, weight, amount)
    if resultSolidityPort > resultNativePython:
        error = ['Implementation Error:']
        error.append('supply             = {}'.format(supply))
        error.append('balance            = {}'.format(balance))
        error.append('weight             = {}'.format(weight))
        error.append('amount             = {}'.format(amount))
        error.append('resultSolidityPort = {}'.format(resultSolidityPort))
        error.append('resultNativePython = {}'.format(resultNativePython))
        raise BaseException('\n'.join(error))
    return resultSolidityPort / resultNativePython


size = int(sys.argv[1]) if len(sys.argv) > 1 else 0
if size == 0:
    size = input('How many test-cases would you like to execute? ')

worstAccuracy = 1
numOfFailures = 0

for n in xrange(size):
    supply = random.randrange(2, 10 ** 26)
    balance = random.randrange(1, 10 ** 23)
    weight = random.randrange(1, 1000000)
    amount = random.randrange(1, supply)
    try:
        accuracy = formulaTest(supply, balance, weight, amount)
        worstAccuracy = min(worstAccuracy, accuracy)
    except Exception, error:
        accuracy = 0
        numOfFailures += 1
    except BaseException, error:
        print error
        break
    print 'Test #{}: accuracy = {:.12f}, worst accuracy = {:.12f}, num of failures = {}'.format(n, accuracy, worstAccuracy, numOfFailures)
