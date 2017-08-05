from common import coefficients


print '    function fixedExp(uint256 _x, uint8 _precision) internal constant returns (uint256) {'
print '        uint256 xi = _x;'
print '        uint256 res = uint256(0x{:x}) << _precision;\n'.format(coefficients[0])
for coefficient in coefficients[1:-1]:
    print '        res += xi * 0x{:x};'.format(coefficient)
    print '        xi = (xi * _x) >> _precision;'
print '        res += xi * 0x{:x};\n'.format(coefficients[-1])
print '        return res / 0x{:x};'.format(coefficients[0])
print '    }'
