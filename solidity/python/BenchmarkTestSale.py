import sys
import FormulaSolidityPort
import FormulaNativePython


def formulaTest(supply, balance, weight, amount):
    resultSolidityPort = FormulaSolidityPort.calculateSaleReturn(supply, balance, weight, amount)
    resultNativePython = FormulaNativePython.calculateSaleReturn(supply, balance, weight, amount)
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


bgn = 10 ** 17
end = 10 ** 26
gap = (end-bgn) / size


worstAccuracy = 1
numOfFailures = 0

for n in xrange(size):
    supply = 10 ** 26
    balance = 10 ** 23
    weight = 100000
    amount = bgn + gap * n
    try:
        accuracy = formulaTest(supply, balance, weight, amount)
        worstAccuracy = min(worstAccuracy, accuracy)
    except Exception, error:
        accuracy = 0
        numOfFailures += 1
    except BaseException, error:
        print error
        break
    print 'Test #{}: amount = {:26d}, accuracy = {:.12f}, worst accuracy = {:.12f}, num of failures = {}'.format(n, amount, accuracy, worstAccuracy, numOfFailures)
