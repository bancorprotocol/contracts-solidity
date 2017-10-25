import sys
import random
import FormulaSolidityPort


def formulaTest(supply, connectorBalance, weight, amount):
    newAmount = FormulaSolidityPort.calculatePurchaseReturn(supply, connectorBalance, weight, amount)
    oldAmount = FormulaSolidityPort.calculateSaleReturn(supply + newAmount, connectorBalance + amount, weight, newAmount)
    if oldAmount > amount:
        error = ['Implementation Error:']
        error.append('supply              = {}'.format(supply))
        error.append('connector balance   = {}'.format(connectorBalance))
        error.append('weight              = {}'.format(weight))
        error.append('amount              = {}'.format(amount))
        error.append('newAmount           = {}'.format(newAmount))
        error.append('oldAmount           = {}'.format(oldAmount))
        raise BaseException('\n'.join(error))
    return float(oldAmount) / amount


size = int(sys.argv[1]) if len(sys.argv) > 1 else 0
if size == 0:
    size = input('How many test-cases would you like to execute? ')

worstAccuracy = 1
numOfFailures = 0

for n in xrange(size):
    supply = random.randrange(2, 10**26)
    connectorBalance = random.randrange(1, 10**23)
    weight = random.randrange(1, 1000000)
    amount = random.randrange(1, supply)
    try:
        accuracy = formulaTest(supply, connectorBalance, weight, amount)
        worstAccuracy = min(worstAccuracy, accuracy)
    except Exception, error:
        accuracy = 0
        numOfFailures += 1
    except BaseException, error:
        print error
        break
    print 'Test #{}: accuracy = {:.12f}, worst accuracy = {:.12f}, num of failures = {}'.format(n, accuracy, worstAccuracy, numOfFailures)
