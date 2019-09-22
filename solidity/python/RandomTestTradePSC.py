import sys
import random
import FormulaSolidityPort


from decimal import Decimal
from decimal import getcontext
getcontext().prec = 80 # 78 digits for a maximum of 2^256-1, and 2 more digits for after the decimal point


def formulaTest(supply, balance1, ratio1, balance2, ratio2, amount1):
    amount0 = FormulaSolidityPort.calculatePurchaseReturn(supply, balance1, ratio1, amount1)
    amount2 = FormulaSolidityPort.calculateSaleReturn(supply + amount0, balance2, ratio2, amount0)
    amount3 = FormulaSolidityPort.calculateCrossReserveReturn(balance2 - amount2, ratio2, balance1 + amount1, ratio1, amount2)
    before, after = amount1, amount3
    if after > before:
        error = ['Implementation Error:']
        error.append('supply   = {}'.format(supply))
        error.append('balance1 = {}'.format(balance1))
        error.append('ratio1   = {}'.format(ratio1))
        error.append('balance2 = {}'.format(balance2))
        error.append('ratio2   = {}'.format(ratio2))
        error.append('amount0  = {}'.format(amount0))
        error.append('amount1  = {}'.format(amount1))
        error.append('amount2  = {}'.format(amount2))
        error.append('amount3  = {}'.format(amount3))
        error.append('before   = {}'.format(before))
        error.append('after    = {}'.format(after))
        raise BaseException('\n'.join(error))
    return Decimal(after) / Decimal(before)


size = int(sys.argv[1]) if len(sys.argv) > 1 else 0
if size == 0:
    size = int(input('How many test-cases would you like to execute? '))


worstAccuracy = 1
numOfFailures = 0


for n in range(size):
    supply = random.randrange(2, 10 ** 26)
    balance1 = random.randrange(1, 10 ** 23)
    ratio1 = random.randrange(1, 1000000)
    balance2 = random.randrange(1, 10 ** 23)
    ratio2 = random.randrange(1, 1000000)
    amount1 = random.randrange(1, balance1 * 10)
    try:
        accuracy = formulaTest(supply, balance1, ratio1, balance2, ratio2, amount1)
        worstAccuracy = min(worstAccuracy, accuracy)
    except Exception as error:
        accuracy = 0
        numOfFailures += 1
    except BaseException as error:
        print(error)
        break
    print('Test #{}: accuracy = {:.18f}, worst accuracy = {:.18f}, num of failures = {}'.format(n, accuracy, worstAccuracy, numOfFailures))
