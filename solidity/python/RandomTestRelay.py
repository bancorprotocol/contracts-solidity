import sys
import random
import FormulaSolidityPort


from decimal import Decimal
from decimal import getcontext
getcontext().prec = 80 # 78 digits for a maximum of 2^256-1, and 2 more digits for after the decimal point


def singleHopTest(balance1, weight1, balance2, weight2, amount):
    try:
        return FormulaSolidityPort.calculateRelayReturn(balance1, weight1, balance2, weight2, amount)
    except:
        return -1


def doubleHopTest(supply, balance1, weight1, balance2, weight2, amount):
    try:
        amount = FormulaSolidityPort.calculatePurchaseReturn(supply, balance1, weight1, amount)
        return FormulaSolidityPort.calculateSaleReturn(supply + amount, balance2, weight2, amount)
    except:
        return -1


size = int(sys.argv[1]) if len(sys.argv) > 1 else 0
if size == 0:
    size = int(input('How many test-cases would you like to execute? '))


minRatio = Decimal('+inf')
maxRatio = Decimal('-inf')
singleHopNumOfFailures = 0
doubleHopNumOfFailures = 0


for n in range(size):
    supply = random.randrange(2, 10 ** 26)
    balance1 = random.randrange(1, 10 ** 23)
    weight1 = random.randrange(1, 1000000)
    balance2 = random.randrange(1, 10 ** 23)
    weight2 = random.randrange(1, 1000000)
    amount = random.randrange(1, supply)
    singleHopResult = singleHopTest(balance1, weight1, balance2, weight2, amount)
    doubleHopResult = doubleHopTest(supply, balance1, weight1, balance2, weight2, amount)
    if singleHopResult >= 0 and doubleHopResult >= 0:
        ratio = Decimal(singleHopResult) / Decimal(doubleHopResult)
        minRatio = min(minRatio, ratio)
        maxRatio = max(maxRatio, ratio)
    else:
        singleHopNumOfFailures += singleHopResult < 0
        doubleHopNumOfFailures += doubleHopResult < 0
    print('Test #{}: ratio = {:.12f}, minRatio = {:.12f}, maxRatio = {:.12f}, num of failures (single-hop/double-hop) = {}/{}'.format(n, ratio, minRatio, maxRatio, singleHopNumOfFailures, doubleHopNumOfFailures))
