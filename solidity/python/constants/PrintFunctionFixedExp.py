from common import coefficients


print '    function fixedExp(uint256 _x, uint8 _precision) internal constant returns (uint256) {'
print '        uint256 xi = _x;'
print '        uint256 res = 0;'
print ''
for i in range(1,len(coefficients)):
    print '        xi = (xi * _x) >> _precision;'
    print '        res += xi * {0:#0{1}x}; // add x^{2:d} * ({3:d}! / {4:d}!)'.format(coefficients[i],len(hex(coefficients[1])),i+1,len(coefficients),i+1)
print ''
print '        return res / 0x{:x} + _x + (ONE << _precision); // divide by {}! and then add x^1 / 1! + x^0 / 0!'.format(coefficients[0],len(coefficients))
print '    }'
