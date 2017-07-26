import os
import sys
sys.path.append(os.path.join(os.path.dirname(__file__),'..'))


from decimal import Decimal
from decimal import getcontext
from BancorFormula import fixedLog2


MIN_PRECISION = 32
MAX_PRECISION = 127


getcontext().prec = MAX_PRECISION
ln2 = Decimal(2).ln()


fixedLog2MaxInput  = ((1<<(256-MAX_PRECISION))-1)<<MAX_PRECISION
fixedLog2MaxOutput = fixedLog2(fixedLog2MaxInput,MAX_PRECISION)


FLOOR_LN2_EXPONENT   = int((((1<<256)-1)/(fixedLog2MaxOutput*ln2)).ln()/ln2)
FLOOR_LN2_MANTISSA   = int(2**FLOOR_LN2_EXPONENT*ln2)
CEILING_LN2_MANTISSA = int(ln2*(1<<MIN_PRECISION)+1)


print '    uint256 constant CEILING_LN2_MANTISSA = 0x{:x};'.format(CEILING_LN2_MANTISSA)
print '    uint256 constant FLOOR_LN2_MANTISSA   = 0x{:x};'.format(FLOOR_LN2_MANTISSA  )
print '    uint8   constant FLOOR_LN2_EXPONENT   = {:d};'  .format(FLOOR_LN2_EXPONENT  )
