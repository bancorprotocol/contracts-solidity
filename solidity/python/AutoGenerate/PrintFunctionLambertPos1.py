from common.functions import getLambertCoefs
from common.constants import NUM_OF_LAMBERT_COEFS


coefficients = getLambertCoefs(NUM_OF_LAMBERT_COEFS)


valueMaxLen = len(hex(coefficients[-1]))
indexMaxLen = len(str(len(coefficients)))


print('    function lambertPos1(uint256 _x) internal pure returns (uint256) {')
print('        uint256 xi = _x;')
print('        uint256 res = (FIXED_1 - _x) * 0x{:x}; // x^(1-1) * ({}! * 1^(1-1) / 1!) - x^(2-1) * ({}! * 2^(2-1) / 2!)'.format(coefficients[0],len(coefficients),len(coefficients)))
print('')
for i in range(2,len(coefficients)):
    print('        xi = (xi * _x) / FIXED_1; res {5:s}= xi * {0:#0{3}x}; // {6:s} x^({1:0{4}d}-1) * ({2:d}! * {1:0{4}d}^({1:0{4}d}-1) / {1:0{4}d}!)'.format(coefficients[i],i+1,len(coefficients),valueMaxLen,indexMaxLen,'+-'[i%2],['add','sub'][i%2]))
print('')
print('        return res / 0x{:x}; // divide by {}!'.format(coefficients[0],len(coefficients)))
print('    }')
