import sys
import random
import FormulaSolidityPort


from decimal import Decimal
from decimal import getcontext
getcontext().prec = 80 # 78 digits for a maximum of 2^256-1, and 2 more digits for after the decimal point


def formulaTest(supply, balance1, weight1, balance2, weight2, amount1):
    try:
        amount0 = FormulaSolidityPort.calculatePurchaseReturn(supply, balance1, weight1, amount1)
        resultL = FormulaSolidityPort.calculateSaleReturn(supply + amount0, balance2, weight2, amount0)
    except:
        resultL = -1
    try:
        resultH = FormulaSolidityPort.calculateCrossReserveReturn(balance1, weight1, balance2, weight2, amount1)
    except:
        resultH = -1
    if resultL > resultH or resultL * resultH < 0:
        error = ['Implementation Error:']
        error.append('supply   = {}'.format(supply))
        error.append('balance1 = {}'.format(balance1))
        error.append('weight1  = {}'.format(weight1))
        error.append('balance2 = {}'.format(balance2))
        error.append('weight2  = {}'.format(weight2))
        error.append('amount1  = {}'.format(amount1))
        error.append('resultL  = {}'.format(resultL))
        error.append('resultH  = {}'.format(resultH))
        raise BaseException('\n'.join(error))
    return Decimal(resultL) / Decimal(resultH)


size = int(sys.argv[1]) if len(sys.argv) > 1 else 0
if size == 0:
    size = int(input('How many test-cases would you like to execute? '))


worstAccuracy = 1
numOfFailures = 0


for n in range(size):
    supply = random.randrange(2, 10 ** 26)
    balance1 = random.randrange(1, 10 ** 23)
    weight1 = random.randrange(1, 1000000)
    balance2 = random.randrange(1, 10 ** 23)
    weight2 = random.randrange(1, 1000000)
    amount1 = random.randrange(1, balance1 * 10)
    try:
        accuracy = formulaTest(supply, balance1, weight1, balance2, weight2, amount1)
        worstAccuracy = min(worstAccuracy, accuracy)
    except Exception as error:
        accuracy = 0
        numOfFailures += 1
    except BaseException as error:
        print(error)
        break
    print('Test #{}: accuracy = {:.24f}, worst accuracy = {:.24f}, num of failures = {}'.format(n, accuracy, worstAccuracy, numOfFailures))
