from mpmath import mp
from mpmath import lambertw
from decimal import Decimal
from decimal import getcontext
from common.constants import MAX_PRECISION
from common.constants import LAMBERT_POS2_EXTENT
from common.constants import LAMBERT_POS2_SAMPLES


getcontext().prec = mp.dps = 100


LAMBERT_CONV_RADIUS = int(Decimal(-1).exp()*2**MAX_PRECISION)
LAMBERT_POS2_SAMPLE = LAMBERT_POS2_EXTENT*2**MAX_PRECISION//(LAMBERT_POS2_SAMPLES-1)


samples      = [Decimal(LAMBERT_CONV_RADIUS+1+LAMBERT_POS2_SAMPLE*i) for i in range(LAMBERT_POS2_SAMPLES)]
lambertArray = [int(Decimal(str(lambertw(x/2**MAX_PRECISION)))/(x/2**MAX_PRECISION)*2**MAX_PRECISION) for x in samples]


len1 = len(str(LAMBERT_POS2_SAMPLES))
len2 = len(hex(max(lambertArray)))


print('    uint256[{}] private lambertArray;'.format(len(lambertArray)))
print('    function initLambertArray() private {')
for n in range(len(lambertArray)):
    print('        lambertArray[{0:{1}d}] = {2:#0{3}x};'.format(n,len1,lambertArray[n],len2))
print('    }')
