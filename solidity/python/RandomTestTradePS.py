import sys
import random
import FormulaSolidityPort


from decimal import Decimal
from decimal import getcontext
getcontext().prec = 80 # 78 digits for a maximum of 2^256-1, and 2 more digits for after the decimal point


def formulaTest(supply, balance, ratio, amount):
    amount1 = FormulaSolidityPort.calculatePurchaseReturn(supply, balance, ratio, amount)
    amount2 = FormulaSolidityPort.calculateSaleReturn(supply + amount1, balance + amount, ratio, amount1)
    before, after = amount, amount2
    if after > before:
        error = ['Implementation Error:']
        error.append('supply  = {}'.format(supply))
        error.append('balance = {}'.format(balance))
        error.append('ratio   = {}'.format(ratio))
        error.append('amount  = {}'.format(amount))
        error.append('amount1 = {}'.format(amount1))
        error.append('amount2 = {}'.format(amount2))
        error.append('before  = {}'.format(before))
        error.append('after   = {}'.format(after))
        raise BaseException('\n'.join(error))
    return Decimal(after) / Decimal(before)


size = int(sys.argv[1]) if len(sys.argv) > 1 else 0
if size == 0:
    size = int(input('How many test-cases would you like to execute? '))


worstAccuracy = 1
numOfFailures = 0


for n in range(size):
    supply = random.randrange(2, 10 ** 26)
    balance = random.randrange(1, 10 ** 23)
    ratio = random.randrange(1, 1000000)
    amount = random.randrange(1, balance * 10)
    try:
        accuracy = formulaTest(supply, balance, ratio, amount)
        worstAccuracy = min(worstAccuracy, accuracy)
    except Exception as error:
        accuracy = 0
        numOfFailures += 1
    except BaseException as error:
        print(error)
        break
    print('Test #{}: accuracy = {:.18f}, worst accuracy = {:.18f}, num of failures = {}'.format(n, accuracy, worstAccuracy, numOfFailures))
