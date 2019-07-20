from common.functions import getCoefficients
from common.functions import getMaxExpArray
from common.constants import NUM_OF_COEFFICIENTS
from common.constants import MIN_PRECISION
from common.constants import MAX_PRECISION


coefficients = getCoefficients(NUM_OF_COEFFICIENTS)
maxExpArray = getMaxExpArray(coefficients,MAX_PRECISION+1)
maxExpArrayShl = [((maxExpArray[precision]+1)<<(MAX_PRECISION-precision))-1 for precision in range(len(maxExpArray))]


len1 = len(str(MAX_PRECISION))
len2 = len(hex(maxExpArrayShl[0]))


print('    uint256[{}] private maxExpArray;'.format(len(maxExpArray)))
print('    constructor() public {')
for precision in range(len(maxExpArray)):
    prefix = '  ' if MIN_PRECISION <= precision <= MAX_PRECISION else '//'
    print('    {0:s}  maxExpArray[{1:{2}d}] = {3:#0{4}x};'.format(prefix,precision,len1,maxExpArrayShl[precision],len2))
print('    }')
