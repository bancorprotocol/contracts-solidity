from common import getMaxExpArray
from constants import MIN_PRECISION
from constants import MAX_PRECISION


maxExpArray = getMaxExpArray(MAX_PRECISION+1)
maxExpArrayShl = [((maxExpArray[precision]+1)<<(MAX_PRECISION-precision))-1 for precision in range(len(maxExpArray))]


len1 = len(str(MAX_PRECISION))
len2 = len(hex(maxExpArrayShl[0]))


print('    uint256[{}] private maxExpArray;'.format(len(maxExpArray)))
print('    function BancorFormula() public {')
for precision in range(len(maxExpArray)):
    prefix = '  ' if MIN_PRECISION <= precision <= MAX_PRECISION else '//'
    print('    {0:s}  maxExpArray[{1:{2}d}] = {3:#0{4}x};'.format(prefix,precision,len1,maxExpArrayShl[precision],len2))
print('    }')
