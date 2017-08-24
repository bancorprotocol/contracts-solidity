MAX_PRECISION = 127


FIXED_1 = 1<<MAX_PRECISION
FIXED_2 = 2<<MAX_PRECISION
MAX_NUM = (1<<(256-MAX_PRECISION))-1


totalLen = len('0x{:x}'.format(MAX_NUM))


print '    uint256 private constant FIXED_1 = {0:#0{1}x};'.format(FIXED_1,totalLen)
print '    uint256 private constant FIXED_2 = {0:#0{1}x};'.format(FIXED_2,totalLen)
print '    uint256 private constant MAX_NUM = {0:#0{1}x};'.format(MAX_NUM,totalLen)
