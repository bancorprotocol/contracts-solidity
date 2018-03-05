import sys
import random
import FormulaSolidityPort


def formulaTest(supply, balance1, weight1, balance2, weight2, amount):
    singleHopResult = FormulaSolidityPort.calculateRelayReturn(balance1, weight1, balance2, weight2, amount)
    newAmount       = FormulaSolidityPort.calculatePurchaseReturn(supply, balance1, weight1, amount)
    doubleHopResult = FormulaSolidityPort.calculateSaleReturn(supply + newAmount, balance2, weight2, newAmount)
    return singleHopResult, doubleHopResult


size = int(sys.argv[1]) if len(sys.argv) > 1 else 0
if size == 0:
    size = int(input('How many test-cases would you like to execute? '))


numOfFailures = 0


for n in range(size):
    supply = random.randrange(2, 10 ** 26)
    balance1 = random.randrange(1, 10 ** 23)
    weight1 = random.randrange(1, 1000000)
    balance2 = random.randrange(1, 10 ** 23)
    weight2 = random.randrange(1, 1000000)
    amount = random.randrange(1, supply)
    try:
        singleHopResult, doubleHopResult = formulaTest(supply, balance1, weight1, balance2, weight2, amount)
    except Exception as error:
        numOfFailures += 1
    print('Test #{}: singleHopResult = {}, doubleHopResult = {}, num of failures = {}'.format(n, singleHopResult, doubleHopResult, numOfFailures))
