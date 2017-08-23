import sys
import random
import FormulaSolidityPort


def formulaTest(supply,reserve,ratio,amount):
    newAmount = FormulaSolidityPort.calculatePurchaseReturn(supply,reserve,ratio,amount)
    oldAmount = FormulaSolidityPort.calculateSaleReturn(supply+newAmount,reserve+amount,ratio,newAmount)
    if oldAmount > amount:
        error = ['Implementation Error:']
        error.append('supply    = {}'.format(supply   ))
        error.append('reserve   = {}'.format(reserve  ))
        error.append('ratio     = {}'.format(ratio    ))
        error.append('amount    = {}'.format(amount   ))
        error.append('newAmount = {}'.format(newAmount))
        error.append('oldAmount = {}'.format(oldAmount))
        raise BaseException('\n'.join(error))
    return float(oldAmount)/amount


size = int(sys.argv[1]) if len(sys.argv) > 1 else 0
if size == 0:
    size = input('How many test-cases would you like to execute? ')


worstAccuracy = 1
numOfFailures = 0


for n in xrange(size):
    supply  = random.randrange(2,10**26)
    reserve = random.randrange(1,10**23)
    ratio   = random.randrange(1,1000000)
    amount  = random.randrange(1,supply)
    try:
        accuracy = formulaTest(supply,reserve,ratio,amount)
        worstAccuracy = min(worstAccuracy,accuracy)
    except Exception,error:
        accuracy = 0
        numOfFailures += 1
    except BaseException,error:
        print error
        break
    print 'Test #{}: accuracy = {:.12f}, worst accuracy = {:.12f}, num of failures = {}'.format(n,accuracy,worstAccuracy,numOfFailures)
