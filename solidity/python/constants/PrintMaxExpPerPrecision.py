NUM_OF_PRECISIONS = 64
NUM_OF_VALUES_PER_ROW = 4
assert(NUM_OF_PRECISIONS % NUM_OF_VALUES_PER_ROW == 0)


def fixedExpUnsafe(_x,precision):
    xi = _x
    res = safeMul(coefs[NUM_OF_COEFS-1],1 << precision)
    for i in range(NUM_OF_COEFS-2,0,-1):
        res = safeAdd(res,safeMul(xi,coefs[i]))
        xi = safeMul(xi,_x) >> precision
    res = safeAdd(res,safeMul(xi,coefs[0]))
    return res / coefs[NUM_OF_COEFS-1]


def safeMul(x,y):
    assert(x * y < (1 << 256))
    return x * y


def safeAdd(x,y):
    assert(x + y < (1 << 256))
    return x + y


NUM_OF_COEFS = 34
coefs = [NUM_OF_COEFS]
for i in range(NUM_OF_COEFS-1,0,-1):
    coefs.append(coefs[-1]*i)


values = []
for precision in range(NUM_OF_PRECISIONS):
    lo = 1
    hi = 1 << 256
    while lo+1 < hi:
        mid = (lo+hi)/2
        try:
            fixedExpUnsafe(mid,precision)
            lo = mid
            mid = (lo+hi)/2
        except Exception,error:
            hi = mid
            mid = (lo+hi)/2
    try:
        fixedExpUnsafe(hi,precision)
        values.append(hi)
    except Exception,error:
        fixedExpUnsafe(lo,precision)
        values.append(lo)


maxLen = len('0x{:x}'.format(values[-1]))


print 'Analysis:'
formatString = '{:s}{:d}{:s}'.format('Precision = {:3d} | Max Exp = {:',maxLen,'s} | Ratio = {:9.7f}')
for precision in range(NUM_OF_PRECISIONS):
    maxExp = '0x{:x}'.format(values[precision])
    ratio = float(values[precision])/float(values[precision-1]) if precision else 0.0
    print formatString.format(precision,maxExp,ratio)
print ''


print 'maxExpArray = ['
formatString = '{:s}{:d}{:s}'.format('{:',maxLen,'s},')
for i in range(len(values)/NUM_OF_VALUES_PER_ROW):
    items = []
    for j in range(NUM_OF_VALUES_PER_ROW):
        items.append('0x{:x}'.format(values[i*NUM_OF_VALUES_PER_ROW+j]))
    print '    '+''.join([formatString.format(item) for item in items])
print ']\n'


lo = 1
hi = 1 << 256
while lo+1 < hi:
    mid = (lo+hi)/2
    try:
        for precision in range(32,64,2):
            maxExp = values[32]
            for p in range (32,precision,2):
                maxExp = safeMul(maxExp,mid)/100000000000000000
                fixedExpUnsafe(maxExp,precision)
        lo = mid
        mid = (lo+hi)/2
    except Exception,error:
        hi = mid
        mid = (lo+hi)/2
try:
    for precision in range(32,64,2):
        maxExp = values[32]
        for p in range (32,precision,2):
            maxExp = safeMul(maxExp,hi)/100000000000000000
            fixedExpUnsafe(maxExp,precision)
    maxFactor = hi
except Exception,error:
    for precision in range(32,64,2):
        maxExp = values[32]
        for p in range (32,precision,2):
            maxExp = safeMul(maxExp,lo)/100000000000000000
            fixedExpUnsafe(maxExp,precision)
    maxFactor = lo


print 'maxFactor = ',maxFactor
formatString = '{:s}{:d}{:s}{:d}{:s}'.format('Precision = {:3d} | Theoretical Max Exp = {:',maxLen,'s} | Practical Max Exp = {:',maxLen,'s}')
for precision in range(32,64,2):
    maxExp = values[32]
    for p in range (32,precision,2):
        maxExp = safeMul(maxExp,maxFactor)/100000000000000000
        fixedExpUnsafe(maxExp,precision)
    print formatString.format(precision,'0x{:x}'.format(values[precision]),'0x{:x}'.format(maxExp))
