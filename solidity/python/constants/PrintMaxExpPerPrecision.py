from math import factorial


MIN_PRECISION = 32
MAX_PRECISION = 63


NUM_OF_VALUES_PER_ROW = 4
assert((MAX_PRECISION+1) % NUM_OF_VALUES_PER_ROW == 0)


NUM_OF_COEFS = 34
maxFactorial = factorial(NUM_OF_COEFS)
coefficients = [maxFactorial/factorial(i) for i in range(NUM_OF_COEFS)]


def fixedExpUnsafe(x,precision):
    xi = x
    res = safeMul(coefficients[0],1 << precision)
    for i in range(1,NUM_OF_COEFS-1):
        res = safeAdd(res,safeMul(xi,coefficients[i]))
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


def getMaxExp(precision,factor):
    maxExp = maxExpArray[MIN_PRECISION]
    for p in range (MIN_PRECISION,precision):
        maxExp = safeMul(maxExp,factor) >> MAX_PRECISION
        fixedExpUnsafe(maxExp,precision)
    return maxExp


def assertFactor(factor,args):
    for precision in range(MIN_PRECISION,MAX_PRECISION+1):
        getMaxExp(precision,factor)


maxExpArray = [0]*(MAX_PRECISION+1)
for precision in range(MAX_PRECISION+1):
    maxExpArray[precision] = binarySearch(fixedExpUnsafe,precision)


growthFactor = binarySearch(assertFactor,None)


maxMaxExpLen = len('0x{:x}'.format(maxExpArray[-1]))


print 'Max Exp Per Precision:'
formatString = '{:s}{:d}{:s}'.format('Precision = {:2d} | Max Exp = {:',maxMaxExpLen,'s} | Ratio = {:9.7f}')
for precision in range(MAX_PRECISION+1):
    maxExp = '0x{:x}'.format(maxExpArray[precision])
    ratio = float(maxExpArray[precision])/float(maxExpArray[precision-1]) if precision > 0 else 0.0
    print formatString.format(precision,maxExp,ratio)
print ''


print 'maxExpArray = ['
formatString = '{:s}{:d}{:s}'.format('{:',maxMaxExpLen,'s},')
for i in range(len(maxExpArray)/NUM_OF_VALUES_PER_ROW):
    items = []
    for j in range(NUM_OF_VALUES_PER_ROW):
        items.append('0x{:x}'.format(maxExpArray[i*NUM_OF_VALUES_PER_ROW+j]))
    print '    '+''.join([formatString.format(item) for item in items])
print ']\n'


print 'Compute the values dynamically, using a growth-factor of 0x{:x} >> {:d}:'.format(growthFactor,MAX_PRECISION)
formatString = '{:s}{:d}{:s}{:d}{:s}'.format('Precision = {:2d} | Theoretical Max Exp = {:',maxMaxExpLen,'s} | Practical Max Exp = {:',maxMaxExpLen,'s} | Difference = {:d}')
for precision in range(MIN_PRECISION,MAX_PRECISION+1):
    theoreticalMaxExp = maxExpArray[precision]
    practicalMaxExp = getMaxExp(precision,growthFactor)
    print formatString.format(precision,'0x{:x}'.format(theoreticalMaxExp),'0x{:x}'.format(practicalMaxExp),theoreticalMaxExp-practicalMaxExp)
