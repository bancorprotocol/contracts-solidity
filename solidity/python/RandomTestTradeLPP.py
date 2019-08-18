import sys
import random
import FormulaSolidityPort


from decimal import Decimal
from decimal import getcontext
getcontext().prec = 80 # 78 digits for a maximum of 2^256-1, and 2 more digits for after the decimal point


def formulaTest(supply, balance1, weight1, balance2, weight2, amount):
    amount1 = FormulaSolidityPort.calculateLiquidateReturn(supply, balance1, weight1 + weight2, amount)
    amount2 = FormulaSolidityPort.calculateLiquidateReturn(supply, balance2, weight1 + weight2, amount)
    amount3 = FormulaSolidityPort.calculatePurchaseReturn(supply - amount, balance1, weight1, amount1)
    amount4 = FormulaSolidityPort.calculatePurchaseReturn(supply - amount + amount3, balance2, weight2, amount2)
    before, after = amount, amount3 + amount4
    if after > before:
        error = ['Implementation Error:']
        error.append('supply   = {}'.format(supply))
        error.append('balance1 = {}'.format(balance1))
        error.append('weight1  = {}'.format(weight1))
        error.append('balance2 = {}'.format(balance2))
        error.append('weight2  = {}'.format(weight2))
        error.append('amount   = {}'.format(amount))
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
    weight1 = random.randrange(1, 1000000)
    balance2 = random.randrange(1, 10 ** 23)
    weight2 = random.randrange(1, 1000000)
    amount = random.randrange(1, supply)
    try:
        accuracy = formulaTest(supply, balance1, weight1, balance2, weight2, amount)
        worstAccuracy = min(worstAccuracy, accuracy)
    except Exception as error:
        accuracy = 0
        numOfFailures += 1
    except BaseException as error:
        print(error)
        break
    print('Test #{}: accuracy = {:.12f}, worst accuracy = {:.12f}, num of failures = {}'.format(n, accuracy, worstAccuracy, numOfFailures))
