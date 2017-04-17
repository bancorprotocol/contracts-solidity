import analysis as formula

def testCornercase():
    print formula.calculatePurchaseReturnSolidity(300000,186000,62,1000000000)
    print "Expected %f" % formula.calculatePurchaseReturn(300000,186000,62,1000000000)


def testLimits(fn):
    #n = 0x000ffffffffff4b5ee29641798873e6b8dff4787ce9c683c9572bf55b6a80000L
    n = 0x1309f119cdab35f002c35bf2c65384341f889b4f0e8952c3d969df76e7a4aa08L
    a=0

    def testThrows(n):
        try:
            fn(n)
        except Exception,e:
            return True
        return False

    delta = n
    direction = 0

    while a < 10000:
        a = a+1
        n = n & 0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffL
        if(testThrows(n)):
            if direction != 1:
                delta = delta/2
                print("throws >= %d" % n)
            n -= delta
            direction =1
        else:
            if direction != 0:
                delta = delta/2
                print("ok at <= %d" % n)
            direction =0
            n += delta
        if delta < 1:
            break 

    for n in range(n-2,n+2):
        if testThrows(n) and not testThrows(n-1):
            print "Function ok at %s " % hex((n-1))
            print hex(fn(n-1))
            print "Function throws at %s :\n" % hex(n)
            print("")
            fn(n)
            break
    else:
        print("No limit found (n > %s)" % hex(n))


def testLog2():
    import math
    import random

    scale = 1 << 32
    def soltest(x):
        return float(formula.fixedLog2(x)) 

    def correct(x):
        return math.log(float(x) / scale,2) * scale

    def diff(x):
        try:
            a = soltest(x)# 98
            b = correct(x)# 100
            return abs(b - a ) * 100 * 1e9 / b
        except Exception, e:
            print("log2(%s) : Exception occurred" % hex(x))
            print e
            return 0
    
    biggestdiff = 0
    for i in range(0,1000000):
        x = random.randint(0,0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffL)
        delta = diff(x)
        if delta >  biggestdiff:
            biggestdiff = delta
            print("log2(%s) error: %f nanopercent " % (hex(x), delta))
   

    """
    log2(0x1046033c3d73d149b2c8445acb25edb45d323bb21e587cd0bc45e8de797bd228L) error: 0.352635 nanopercent
    log2(0x80bc764ffa40fd27684f4f79868d27b7dee660aa502a906bcde63dc62083af5cL) error: 0.358852 nanopercent
    log2(0x81e951b47ea5f84c32026edb06398c6d345ab52625301a693219af566033dd47L) error: 0.366503 nanopercent
    log2(0x413b4e557f74c78d054341ea51c315cd480cb086de8b2fd2cf25ff9d360158c3L) error: 0.371011 nanopercent
    log2(0x20416d8b9f09d345031eb56b29f53708324b2232b812bc84a0c3e740921d1b62L) error: 0.371572 nanopercent
    """

testCornercase()
#testLimits(formula.fixedExp)
#testLimits(formula.fixedLog2)
#testLog2()
#calculateFactorials()
print(formula.fixedLog2(0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffL))
print(formula.fixedLog2(0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffL-1))
print(formula.fixedLog2(0x100000001))
print("done")