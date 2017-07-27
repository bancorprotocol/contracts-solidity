from math import exp


MIN_PRECISION = 32


for n in [0.5,1.0,2.0,3.0]:
    print '    uint256 constant SCALED_EXP_{} = 0x{:x};'.format(n,int(exp(n)*(1<<MIN_PRECISION))).replace('.','P')
    print '    uint256 constant SCALED_VAL_{} = 0x{:x};'.format(n,int(   (n)*(1<<MIN_PRECISION))).replace('.','P')
