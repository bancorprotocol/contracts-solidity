from math import factorial


def getCoefficients(numOfCoefficients):
    maxFactorial = factorial(numOfCoefficients-1)
    return [maxFactorial//factorial(i) for i in range(1,numOfCoefficients)]


def getMaxExpArray(coefficients,numOfPrecisions):
    return [binarySearch(generalExp,[coefficients,precision]) for precision in range(numOfPrecisions)]


def getMaxValArray(coefficients,maxExpArray):
    return [generalExp(maxExpArray[precision],coefficients,precision) for precision in range(len(maxExpArray))]


def binarySearch(func,args):
    lo = 0
    hi = (1<<256)-1
    while lo+1 < hi:
        mid = (lo+hi)//2
        try:
            func(mid,*args)
            lo = mid
        except:
            hi = mid
    try:
        func(hi,*args)
        return hi
    except:
        func(lo,*args)
        return lo


def generalExp(x,coefficients,precision):
    xi = x
    res = 0
    for coefficient in coefficients[1:]:
        xi = safeMul(xi,x)>>precision
        res = safeAdd(res,safeMul(xi,coefficient))
    return safeAdd(safeAdd(res//coefficients[0],x),1<<precision)


def optimalLog(x,hiTerms,loTerms,fixed1):
    res = 0
    for term in hiTerms[+1:]:
        if x >= term.exp:
            res = safeAdd(res,term.val)
            x = safeMul(x,fixed1)//term.exp
    z = y = safeSub(x,fixed1)
    w = safeMul(y,y)//fixed1
    for term in loTerms[:-1]:
        res = safeAdd(res,safeMul(z,safeSub(term.num,y))//term.den)
        z = safeMul(z,w)//fixed1
    res = safeAdd(res,safeMul(z,safeSub(loTerms[-1].num,y))//loTerms[-1].den)
    return res


def optimalExp(x,hiTerms,loTerms,fixed1):
    res = 0
    z = y = x % hiTerms[0].bit
    for term in loTerms[+1:]:
        z = safeMul(z,y)//fixed1
        res = safeAdd(res,safeMul(z,term.val))
    res = safeAdd(safeAdd(res//loTerms[0].val,y),fixed1)
    for term in hiTerms[:-1]:
        if x & term.bit:
            res = safeMul(res,term.num)//term.den
    return res


def safeSub(x,y):
    assert (x - y) >= 0
    return (x - y)


def safeAdd(x,y):
    assert (x + y) < (1 << 256)
    return (x + y)


def safeMul(x,y):
    assert (x * y) < (1 << 256)
    return (x * y)


def safeShl(x,y):
    assert (x << y) < (1 << 256)
    return (x << y)
