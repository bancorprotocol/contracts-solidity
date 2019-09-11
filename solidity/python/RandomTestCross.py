import sys
import random
import FormulaSolidityPort
import FormulaNativePython


def formulaTest(balance1, ratio1, balance2, ratio2, amount):
    resultSolidityPort = FormulaSolidityPort.calculateCrossReserveReturn(balance1, ratio1, balance2, ratio2, amount)
    resultNativePython = FormulaNativePython.calculateCrossReserveReturn(balance1, ratio1, balance2, ratio2, amount)
    if resultSolidityPort > resultNativePython:
        error = ['Implementation Error:']
        error.append('balance1           = {}'.format(balance1))
        error.append('ratio1             = {}'.format(ratio1))
        error.append('balance2           = {}'.format(balance2))
        error.append('ratio2             = {}'.format(ratio2))
        error.append('amount             = {}'.format(amount))
        error.append('resultSolidityPort = {}'.format(resultSolidityPort))
        error.append('resultNativePython = {}'.format(resultNativePython))
        raise BaseException('\n'.join(error))
    return resultSolidityPort / resultNativePython


size = int(sys.argv[1]) if len(sys.argv) > 1 else 0
if size == 0:
    size = int(input('How many test-cases would you like to execute? '))


worstAccuracy = 1
numOfFailures = 0


for n in range(size):
    balance1 = random.randrange(1, 10 ** 23)
    ratio1 = random.randrange(1, 1000000)
    balance2 = random.randrange(1, 10 ** 23)
    ratio2 = random.randrange(1, 1000000)
    amount = random.randrange(1, balance1 * 10)
    try:
        accuracy = formulaTest(balance1, ratio1, balance2, ratio2, amount)
        worstAccuracy = min(worstAccuracy, accuracy)
    except Exception as error:
        accuracy = 0
        numOfFailures += 1
    except BaseException as error:
        print(error)
        break
    print('Test #{}: accuracy = {:.18f}, worst accuracy = {:.18f}, num of failures = {}'.format(n, accuracy, worstAccuracy, numOfFailures))
