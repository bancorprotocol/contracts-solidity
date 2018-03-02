from common.functions import getCoefficients
from common.constants import NUM_OF_COEFFICIENTS


coefficients = getCoefficients(NUM_OF_COEFFICIENTS)


valueMaxLen = len(hex(coefficients[1]))
indexMaxLen = len(str(len(coefficients)))


print('    function generalExp(uint256 _x, uint8 _precision) internal pure returns (uint256) {')
print('        uint256 xi = _x;')
print('        uint256 res = 0;')
print('')
for i in range(1,len(coefficients)):
    print('        xi = (xi * _x) >> _precision; res += xi * {0:#0{4}x}; // add x^{1:0{5}d} * ({2:0{5}d}! / {3:0{5}d}!)'.format(coefficients[i],i+1,len(coefficients),i+1,valueMaxLen,indexMaxLen))
print('')
print('        return res / 0x{:x} + _x + (ONE << _precision); // divide by {}! and then add x^1 / 1! + x^0 / 0!'.format(coefficients[0],len(coefficients)))
print('    }')
