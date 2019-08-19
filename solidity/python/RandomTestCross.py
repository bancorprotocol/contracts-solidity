import sys
import random
import FormulaSolidityPort
import FormulaNativePython


def formulaTest(balance1, weight1, balance2, weight2, amount):
    resultSolidityPort = FormulaSolidityPort.calculateCrossConnectorReturn(balance1, weight1, balance2, weight2, amount)
    resultNativePython = FormulaNativePython.calculateCrossConnectorReturn(balance1, weight1, balance2, weight2, amount)
    if resultSolidityPort > resultNativePython:
        error = ['Implementation Error:']
        error.append('balance1           = {}'.format(balance1))
        error.append('weight1            = {}'.format(weight1))
        error.append('balance2           = {}'.format(balance2))
        error.append('weight2            = {}'.format(weight2))
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
    weight1 = random.randrange(1, 1000000)
    balance2 = random.randrange(1, 10 ** 23)
    weight2 = random.randrange(1, 1000000)
    amount = random.randrange(1, balance1 * 10)
    try:
        accuracy = formulaTest(balance1, weight1, balance2, weight2, amount)
        worstAccuracy = min(worstAccuracy, accuracy)
    except Exception as error:
        accuracy = 0
        numOfFailures += 1
    except BaseException as error:
        print(error)
        break
    print('Test #{}: accuracy = {:.12f}, worst accuracy = {:.12f}, num of failures = {}'.format(n, accuracy, worstAccuracy, numOfFailures))
