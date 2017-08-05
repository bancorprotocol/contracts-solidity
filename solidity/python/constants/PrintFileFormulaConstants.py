from common import getMaxExpArray
from common import getMaxValArray


MIN_PRECISION = 32
MAX_PRECISION = 127


maxExpArray = getMaxExpArray(MAX_PRECISION+1)
maxValArray = getMaxValArray(maxExpArray)


print 'module.exports.MIN_PRECISION = {};'.format(MIN_PRECISION)
print 'module.exports.MAX_PRECISION = {};'.format(MAX_PRECISION)


print 'module.exports.maxExpArray = ['
for precision in range(len(maxExpArray)):
    print '    /* {:3d} */    \'0x{:x}\','.format(precision,maxExpArray[precision])
print '];'


print 'module.exports.maxValArray = ['
for precision in range(len(maxValArray)):
    print '    /* {:3d} */    \'0x{:x}\','.format(precision,maxValArray[precision])
print '];'
