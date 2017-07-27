from binom import coefficients


MIN_PRECISION = 32
MAX_PRECISION = 127


def fixedExpUnsafe(x,precision):
    xi = x
    res = safeMul(coefficients[0],1 << precision)
    for coefficient in coefficients[1:-1]:
        res = safeAdd(res,safeMul(xi,coefficient))
        xi = safeMul(xi,x) >> precision
    res = safeAdd(res,safeMul(xi,coefficients[-1]))
    return res / coefficients[0]


def safeMul(x,y):
    assert(x * y < (1 << 256))
    return x * y


def safeAdd(x,y):
    assert(x + y < (1 << 256))
    return x + y


def binarySearch(func,args):
    lo = 1
    hi = 1 << 256
    while lo+1 < hi:
        mid = (lo+hi)/2
        try:
            func(mid,args)
            lo = mid
        except Exception,error:
            hi = mid
    try:
        func(hi,args)
        return hi
    except Exception,error:
        func(lo,args)
        return lo


maxExpArray = [0]*(MAX_PRECISION+1)
for precision in range(MAX_PRECISION+1):
    maxExpArray[precision] = binarySearch(fixedExpUnsafe,precision)


print '    uint256[{}] maxExpArray;'.format(MAX_PRECISION+1)
print '    function BancorFormula() {'
for precision in range(MAX_PRECISION+1):
    prefix = '  ' if MIN_PRECISION <= precision <= MAX_PRECISION else '//'
    print '    {}  maxExpArray[{:3d}] = 0x{:x};'.format(prefix,precision,maxExpArray[precision])
print '    }'
