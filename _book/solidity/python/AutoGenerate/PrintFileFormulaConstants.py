from common.functions import getCoefficients
from common.functions import getMaxExpArray
from common.functions import getMaxValArray
from common.constants import NUM_OF_COEFFICIENTS
from common.constants import MIN_PRECISION
from common.constants import MAX_PRECISION


coefficients = getCoefficients(NUM_OF_COEFFICIENTS)
maxExpArray = getMaxExpArray(coefficients,MAX_PRECISION+1)
maxValArray = getMaxValArray(coefficients,maxExpArray)


print('module.exports.MIN_PRECISION = {};'.format(MIN_PRECISION))
print('module.exports.MAX_PRECISION = {};'.format(MAX_PRECISION))


print('module.exports.maxExpArray = [')
for precision in range(len(maxExpArray)):
    print('    /* {:3d} */    \'0x{:x}\','.format(precision,maxExpArray[precision]))
print('];')


print('module.exports.maxValArray = [')
for precision in range(len(maxValArray)):
    print('    /* {:3d} */    \'0x{:x}\','.format(precision,maxValArray[precision]))
print('];')
