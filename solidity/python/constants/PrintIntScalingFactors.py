MAX_PRECISION = 127


print '    uint256 constant FIXED_1 = {0:#0{1}x};'.format(1<<MAX_PRECISION,(MAX_PRECISION+1)/4+3)
print '    uint256 constant FIXED_2 = {0:#0{1}x};'.format(2<<MAX_PRECISION,(MAX_PRECISION+1)/4+3)
