from common import getMaxExpArray


MIN_PRECISION = 32
MAX_PRECISION = 127


maxExpArray = getMaxExpArray(MAX_PRECISION+1)


len1 = len('{:d}'.format(MAX_PRECISION))
len2 = len('0x{:x}'.format(maxExpArray[0]<<MAX_PRECISION))


print '    uint256[{}] maxExpArray;'.format(len(maxExpArray))
print '    function BancorFormula() {'
for precision in range(len(maxExpArray)):
    prefix = '  ' if MIN_PRECISION <= precision <= MAX_PRECISION else '//'
    print '    {0:s}  maxExpArray[{1:{2}d}] = {3:#0{4}x};'.format(prefix,precision,len1,maxExpArray[precision]<<(MAX_PRECISION-precision),len2)
print '    }'
