from common import getMaxExpArray


MIN_PRECISION = 32
MAX_PRECISION = 127


maxExpArray = getMaxExpArray(MAX_PRECISION+1)


def maxExpArrayShl(precision):
    return ((maxExpArray[precision]+1)<<(MAX_PRECISION-precision))-1


len1 = len('{:d}'.format(MAX_PRECISION))
len2 = len('0x{:x}'.format(maxExpArrayShl(0)))


print '    uint256[{}] private maxExpArray;'.format(len(maxExpArray))
print ''
print '    function BancorFormula() {'
for precision in range(len(maxExpArray)):
    prefix = '  ' if MIN_PRECISION <= precision <= MAX_PRECISION else '//'
    print '    {0:s}  maxExpArray[{1:{2}d}] = {3:#0{4}x};'.format(prefix,precision,len1,maxExpArrayShl(precision),len2)
print '    }'
