import sys
import random
import FormulaSolidityPort
import FormulaNativePython


from decimal import Decimal
from decimal import getcontext
getcontext().prec = 80 # 78 digits for a maximum of 2^256-1, and 2 more digits for after the decimal point


minSolvable = -Decimal(-1).exp()


def isSolvable(staked1, balance1, balance2, rate1, rate2):
    staked1, balance1, balance2, rate1, rate2 = [Decimal(value) for value in vars().values()]
    return (balance1 / staked1).ln() * (staked1 * rate2) / (balance2 * rate1) >= minSolvable


def formulaTest(staked1, balance1, balance2, rate1, rate2):
    if isSolvable(staked1, balance1, balance2, rate1, rate2):
        weights = FormulaSolidityPort.balancedWeights(staked1, balance1, balance2, rate1, rate2)
        weight1 = weights[0];
        weight2 = weights[1];
        amount1 = staked1 - balance1
        amount2 = FormulaNativePython.crossReserveTargetAmount(balance1, weight1, balance2, weight2, amount1)
        return Decimal((balance1 + amount1) * weight2 * rate2) / Decimal((balance2 - amount2) * weight1 * rate1)
    return Decimal(1)


size = int(sys.argv[1]) if len(sys.argv) > 1 else 0
if size == 0:
    size = int(input('How many test-cases would you like to execute? '))


minRatio = Decimal('+inf')
maxRatio = Decimal('-inf')
numOfFailures = 0


for n in range(size):
    rate = random.randrange(10 ** 18, 10 ** 21)
    staked1 = random.randrange(10 ** 24, 10 ** 27)
    balance1 = staked1 * random.randrange(75, 150) // 100
    balance2 = staked1 * random.randrange(75, 150) // 100
    rate1 = rate * random.randrange(75, 150) // 100
    rate2 = rate * random.randrange(75, 150) // 100
    try:
        ratio = formulaTest(staked1, balance1, balance2, rate1, rate2)
        minRatio = min(minRatio, ratio)
        maxRatio = max(maxRatio, ratio)
    except Exception as error:
        ratio = 0
        numOfFailures += 1
    print('Test #{}: ratio = {:.24f}, minRatio = {:.24f}, maxRatio = {:.24f}, num of failures = {}'.format(n, ratio, minRatio, maxRatio, numOfFailures))
