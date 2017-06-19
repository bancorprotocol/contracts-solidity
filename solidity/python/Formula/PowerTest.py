from sys    import argv
from math   import log
from random import randrange
from Power  import power
from Power  import PRECISION


def powerTest(_baseN, _baseD, _expN, _expD):
    fixed = float(power(_baseN, _baseD, _expN, _expD))/(1<<PRECISION)
    real = (float(_baseN)/float(_baseD))**(float(_expN)/float(_expD))
    return fixed,real


size = int(argv[1]) if len(argv) > 1 else 0
if size == 0:
    size = input('How many test-cases would you like to execute? ')


n = 0
worstAccuracy = 1
while n < size:
    _baseN = randrange(1<<PRECISION,1<<(256-PRECISION))
    _baseD = randrange(1<<PRECISION,_baseN+1)
    _expN  = randrange(1<<PRECISION,1<<(256-PRECISION))
    _expD  = randrange(1<<PRECISION,_expN+1)
    try:
        fixed,real = powerTest(_baseN, _baseD, _expN, _expD)
        if fixed <= real:
            accuracy = fixed / real
            if worstAccuracy > accuracy:
                worstAccuracy = accuracy
                print 'worst accuracy of {:.8f} found for {:.4f}^{:.4f}'.format(accuracy,float(_baseN)/float(_baseD),float(_expN)/float(_expD))
            n += 1
        else:
            print 'error accuracy of {:.8f} found for {:.4f}^{:.4f}'.format(accuracy,float(_baseN)/float(_baseD),float(_expN)/float(_expD))
            break
    except:
        pass
