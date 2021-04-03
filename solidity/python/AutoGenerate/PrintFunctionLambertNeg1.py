from common.functions import getLambertCoefs
from common.constants import NUM_OF_LAMBERT_COEFS


coefficients = getLambertCoefs(NUM_OF_LAMBERT_COEFS)


valueMaxLen = len(hex(coefficients[-1]))
indexMaxLen = len(str(len(coefficients)))


print('    function lambertNeg1(uint256 _x) internal pure returns (uint256) {')
print('        uint256 xi = _x;')
print('        uint256 res = 0;')
print('')
for i in range(2,len(coefficients)):
    print('        xi = (xi * _x) / FIXED_1; res += xi * {0:#0{3}x}; // add x^({1:0{4}d}-1) * ({2:d}! * {1:0{4}d}^({1:0{4}d}-1) / {1:0{4}d}!)'.format(coefficients[i],i+1,len(coefficients),valueMaxLen,indexMaxLen))
print('')
print('        return res / 0x{:x} + _x + FIXED_1; // divide by {}! and then add x^(2-1) * ({}! * 2^(2-1) / 2!) + x^(1-1) * ({}! * 1^(1-1) / 1!)'.format(coefficients[0],len(coefficients),len(coefficients),len(coefficients)))
print('    }')
