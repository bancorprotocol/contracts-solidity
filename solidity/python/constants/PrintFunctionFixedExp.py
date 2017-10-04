from common import coefficients


print '    function fixedExp(uint256 _x, uint8 _precision) internal constant returns (uint256) {'
print '        uint256 xi = _x;'
print '        uint256 res = 0;'
print ''
for coefficient in coefficients[1:]:
    print '        xi = (xi * _x) >> _precision;'
    print '        res += xi * 0x{:x};'.format(coefficient)
print ''
print '        return res / 0x{:x} + _x + (ONE << _precision);'.format(coefficients[0])
print '    }'
