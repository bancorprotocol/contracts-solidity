from common.constants import NUM_OF_COEFFICIENTS
from common.constants import MIN_PRECISION
from common.constants import MAX_PRECISION
from common.functions import getCoefficients
from common.functions import getMaxExpArray
from common.functions import binarySearch
from common.functions import generalExp
from common.functions import safeMul


NUM_OF_VALUES_PER_ROW = 4
assert (MAX_PRECISION+1) % NUM_OF_VALUES_PER_ROW == 0


def getMaxExp(precision,factor):
    maxExp = maxExpArray[MIN_PRECISION]
    for p in range(MIN_PRECISION,precision):
        maxExp = safeMul(maxExp,factor)>>MAX_PRECISION
        generalExp(maxExp,coefficients,precision)
    return maxExp


def assertFactor(factor):
    for precision in range(MIN_PRECISION,MAX_PRECISION+1):
        getMaxExp(precision,factor)


coefficients = getCoefficients(NUM_OF_COEFFICIENTS)
maxExpArray = getMaxExpArray(coefficients,MAX_PRECISION+1)
growthFactor = binarySearch(assertFactor,{})
maxMaxExpLen = len('0x{:x}'.format(maxExpArray[-1]))


print('Max Exp Per Precision:')
formatString = '{:s}{:d}{:s}'.format('Precision = {:3d} | Max Exp = {:',maxMaxExpLen,'s} | Ratio = {:9.7f}')
for precision in range(MAX_PRECISION+1):
    maxExp = '0x{:x}'.format(maxExpArray[precision])
    ratio = maxExpArray[precision]/maxExpArray[precision-1] if precision > 0 else 0.0
    print(formatString.format(precision,maxExp,ratio))
print('')


print('maxExpArray = [')
formatString = '{:s}{:d}{:s}'.format('{:',maxMaxExpLen,'s},')
for i in range(len(maxExpArray)//NUM_OF_VALUES_PER_ROW):
    items = []
    for j in range(NUM_OF_VALUES_PER_ROW):
        items.append('0x{:x}'.format(maxExpArray[i*NUM_OF_VALUES_PER_ROW+j]))
    print('    '+''.join([formatString.format(item) for item in items]))
print(']\n')


print('Compute the values dynamically, using a growth-factor of 0x{:x} >> {:d}:'.format(growthFactor,MAX_PRECISION))
formatString = '{:s}{:d}{:s}{:d}{:s}'.format('Precision = {:3d} | Theoretical Max Exp = {:',maxMaxExpLen,'s} | Practical Max Exp = {:',maxMaxExpLen,'s} | Difference = {:d}')
for precision in range(MIN_PRECISION,MAX_PRECISION+1):
    theoreticalMaxExp = maxExpArray[precision]
    practicalMaxExp = getMaxExp(precision,growthFactor)
    print(formatString.format(precision,'0x{:x}'.format(theoreticalMaxExp),'0x{:x}'.format(practicalMaxExp),theoreticalMaxExp-practicalMaxExp))
