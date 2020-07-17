from common.functions import getTaylorCoefs
from common.functions import getMaxExpArray
from common.constants import NUM_OF_TAYLOR_COEFS
from common.constants import MIN_PRECISION
from common.constants import MAX_PRECISION


coefficients = getTaylorCoefs(NUM_OF_TAYLOR_COEFS)
maxExpArray = getMaxExpArray(coefficients,MAX_PRECISION+1)
maxExpArray = [((maxExpArray[precision]+1)<<(MAX_PRECISION-precision))-1 for precision in range(len(maxExpArray))]


len1 = len(str(MAX_PRECISION))
len2 = len(hex(max(maxExpArray)))


print('    uint256[{}] private maxExpArray;'.format(len(maxExpArray)))
print('    function initMaxExpArray() private {')
for precision in range(len(maxExpArray)):
    prefix = '  ' if MIN_PRECISION <= precision <= MAX_PRECISION else '//'
    print('    {0:s}  maxExpArray[{1:{2}d}] = {3:#0{4}x};'.format(prefix,precision,len1,maxExpArray[precision],len2))
print('    }')
