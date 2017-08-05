from math import factorial


NUM_OF_COEFS = 34
maxFactorial = factorial(NUM_OF_COEFS)
coefficients = [maxFactorial/factorial(i) for i in range(NUM_OF_COEFS)]


def getMaxExpArray(numOfPrecisions):
    return [binarySearch(fixedExpSafe,precision) for precision in range(numOfPrecisions)]


def getMaxValArray(maxExpArray):
    return [fixedExpSafe(maxExpArray[precision],precision) for precision in range(len(maxExpArray))]


def binarySearch(func,args):
    lo = 0
    hi = (1<<256)-1
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


def fixedExpSafe(x,precision):
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
