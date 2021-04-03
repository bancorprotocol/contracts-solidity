import sys
import random
import FormulaSolidityPort
import FormulaNativePython


def formulaTest(x):
    resultSolidityPort = FormulaSolidityPort.lambertPos2(x)
    resultNativePython = FormulaNativePython.lambertPos(x, FormulaSolidityPort.MAX_PRECISION)
    return resultSolidityPort / resultNativePython


size = int(sys.argv[1]) if len(sys.argv) > 1 else 0
if size == 0:
    size = int(input('How many test-cases would you like to execute? '))


minRatio = float('+inf')
maxRatio = float('-inf')


for n in range(size):
    x = random.randrange(FormulaSolidityPort.LAMBERT_CONV_RADIUS + 1, FormulaSolidityPort.LAMBERT_POS2_MAXVAL + 1)
    ratio = formulaTest(x)
    minRatio = min(minRatio, ratio)
    maxRatio = max(maxRatio, ratio)
    print('Test #{}: ratio = {:.18f}, minRatio = {:.18f}, maxRatio = {:.18f}'.format(n, ratio, minRatio, maxRatio))
