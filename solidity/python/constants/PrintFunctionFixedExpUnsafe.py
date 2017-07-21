from math import factorial


NUM_OF_COEFS = 34


maxFactorial = factorial(NUM_OF_COEFS)
coefficients = [maxFactorial/factorial(i) for i in range(NUM_OF_COEFS)]


print '    function fixedExpUnsafe(uint256 _x, uint8 _precision) constant returns (uint256) {'
print '        uint256 xi = _x;'
print '        uint256 res = uint256(0x{:x}) << _precision;\n'.format(coefficients[0])
for i in range(1,NUM_OF_COEFS-1):
    print '        res += xi * 0x{:x};'.format(coefficients[i])
    print '        xi = (xi * _x) >> _precision;'
print '        res += xi * 0x{:x};\n'.format(coefficients[-1])
print '        return res / 0x{:x};'.format(coefficients[0])
print '    }'
