from common import getMaxExpArray


MIN_PRECISION = 32
MAX_PRECISION = 127


maxExpArray = getMaxExpArray(MAX_PRECISION+1)


print '    uint256[{}] maxExpArray;'.format(len(maxExpArray))
print '    function BancorFormula() {'
for precision in range(len(maxExpArray)):
    prefix = '  ' if MIN_PRECISION <= precision <= MAX_PRECISION else '//'
    print '    {}  maxExpArray[{:3d}] = 0x{:x};'.format(prefix,precision,maxExpArray[precision])
print '    }'
