from decimal import Decimal
from decimal import getcontext
from decimal import ROUND_FLOOR
from decimal import ROUND_CEILING


MIN_PRECISION = 32
MAX_PRECISION = 127


def ln(n):
    return Decimal(n).ln()


def log2(n):
    return ln(n)/ln(2)


def floor(d):
    return int(d.to_integral_exact(rounding=ROUND_FLOOR))


def ceiling(d):
    return int(d.to_integral_exact(rounding=ROUND_CEILING))


getcontext().prec = MAX_PRECISION


maxVal = floor(log2(2**(256-MAX_PRECISION)-1)*2**MAX_PRECISION)-1


FLOOR_LN2_EXPONENT   = floor(log2((2**256-1)/(maxVal*ln(2))))
FLOOR_LN2_MANTISSA   = floor(2**FLOOR_LN2_EXPONENT*ln(2))
CEILING_LN2_MANTISSA = ceiling(2**MIN_PRECISION*ln(2))


print '    uint256 constant CEILING_LN2_MANTISSA = 0x{:x};'.format(CEILING_LN2_MANTISSA)
print '    uint256 constant FLOOR_LN2_MANTISSA   = 0x{:x};'.format(FLOOR_LN2_MANTISSA  )
print '    uint8   constant FLOOR_LN2_EXPONENT   = {:d};'  .format(FLOOR_LN2_EXPONENT  )
