import sys
import random
import FormulaSolidityPort
import FormulaNativePython


def formulaTest(x):
    resultSolidityPort = FormulaSolidityPort.lambertNeg1(x)
    resultNativePython = FormulaNativePython.lambertNeg(x, FormulaSolidityPort.MAX_PRECISION)
    if resultSolidityPort > resultNativePython:
        error = ['Implementation Error:']
        error.append('x                  = {}'.format(x))
        error.append('resultSolidityPort = {}'.format(resultSolidityPort))
        error.append('resultNativePython = {}'.format(resultNativePython))
        raise BaseException('\n'.join(error))
    return resultSolidityPort / resultNativePython


size = int(sys.argv[1]) if len(sys.argv) > 1 else 0
if size == 0:
    size = int(input('How many test-cases would you like to execute? '))


worstAccuracy = 1


for n in range(size):
    x = random.randrange(1, FormulaSolidityPort.LAMBERT_CONV_RADIUS + 1)
    try:
        accuracy = formulaTest(x)
        worstAccuracy = min(worstAccuracy, accuracy)
    except BaseException as error:
        print(error)
        break
    print('Test #{}: accuracy = {:.18f}, worst accuracy = {:.18f}'.format(n, accuracy, worstAccuracy))
