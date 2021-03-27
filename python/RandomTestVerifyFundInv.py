import sys
import random
import FormulaSolidityPort


from decimal import Decimal
from decimal import getcontext
getcontext().prec = 80 # 78 digits for a maximum of 2^256-1, and 2 more digits for after the decimal point


def formulaTest(supply, balance, weights, amount0):
    amount1 = FormulaSolidityPort.fundSupplyAmount(supply, balance, weights, amount0)
    amount2 = FormulaSolidityPort.fundCost(supply, balance, weights, amount1)
    if amount2 > amount0:
        error = ['Implementation Error:']
        error.append('supply             = {}'.format(supply))
        error.append('balance            = {}'.format(balance))
        error.append('weights            = {}'.format(weights))
        error.append('amount0            = {}'.format(amount0))
        error.append('amount1            = {}'.format(amount1))
        error.append('amount2            = {}'.format(amount2))
        error.append('resultSolidityPort = {}'.format(resultSolidityPort))
        error.append('resultNativePython = {}'.format(resultNativePython))
        raise BaseException('\n'.join(error))
    return Decimal(amount2) / Decimal(amount0)


size = int(sys.argv[1]) if len(sys.argv) > 1 else 0
if size == 0:
    size = int(input('How many test-cases would you like to execute? '))


worstAccuracy = 1
numOfFailures = 0


for n in range(size):
    supply = random.randrange(2, 10 ** 26)
    balance = random.randrange(1, 10 ** 23)
    weights = random.randrange(10000, 2000001)
    amount = random.randrange(1, balance * 10)
    try:
        accuracy = formulaTest(supply, balance, weights, amount)
        worstAccuracy = min(worstAccuracy, accuracy)
    except Exception as error:
        print(error)
        accuracy = 0
        numOfFailures += 1
    except BaseException as error:
        print(error)
        break
    print('Test #{}: accuracy = {:.24f}, worst accuracy = {:.24f}, num of failures = {}'.format(n, accuracy, worstAccuracy, numOfFailures))
