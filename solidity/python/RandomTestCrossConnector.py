import sys
import random
import FormulaSolidityPort
import FormulaNativePython


from decimal import Decimal
from decimal import getcontext
getcontext().prec = 80 # 78 digits for a maximum of 2^256-1, and 2 more digits for after the decimal point


def singleHopTest(balance1, weight1, balance2, weight2, amount):
    try:
        return FormulaSolidityPort.calculateCrossConnectorReturn(balance1, weight1, balance2, weight2, amount)
    except:
        return -1


def doubleHopTest(supply, balance1, weight1, balance2, weight2, amount):
    amount = FormulaNativePython.calculatePurchaseReturn(supply, balance1, weight1, amount)
    return FormulaNativePython.calculateSaleReturn(supply + amount, balance2, weight2, amount)


size = int(sys.argv[1]) if len(sys.argv) > 1 else 0
if size == 0:
    size = int(input('How many test-cases would you like to execute? '))


minRatio = Decimal('+inf')


for n in range(size):
    supply = random.randrange(2, 10 ** 26)
    balance1 = random.randrange(1, 10 ** 23)
    weight1 = random.randrange(1, 1000000)
    balance2 = random.randrange(1, 10 ** 23)
    weight2 = random.randrange(1, 1000000)
    amount = random.randrange(1, supply)
    singleHop = singleHopTest(balance1, weight1, balance2, weight2, amount)
    doubleHop = doubleHopTest(supply, balance1, weight1, balance2, weight2, amount)
    if 0 <= singleHop <= doubleHop:
        ratio = Decimal(singleHop) / Decimal(doubleHop)
        minRatio = min(minRatio, ratio)
        print('Test #{}: ratio = {:.24f}, minRatio = {:.24f}'.format(n, ratio, minRatio))
    elif singleHop < 0:
        ratio = Decimal(0)
        print('Test #{}: ratio = {:.24f}, minRatio = {:.24f}'.format(n, ratio, minRatio))
    else:
        print('Implementation Error:')
        print('supply    = {}'.format(supply))
        print('balance1  = {}'.format(balance1))
        print('weight1   = {}'.format(weight1))
        print('balance2  = {}'.format(balance2))
        print('weight2   = {}'.format(weight2))
        print('amount    = {}'.format(amount))
        print('singleHop = {}'.format(singleHop))
        print('doubleHop = {}'.format(doubleHop))
        break
