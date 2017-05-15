import analysis as formula
import random,math

def generateTestData():
    """ Generates some basic scenarios"""

    S = 300000.0
    R = 63000.0
    F= 21

    print("module.exports.purchaseReturns= [")
    for i in range(1, 1000,2):
        E = float(i * i) # Goes up to 1 million ether 
        T = formula.calculatePurchaseReturn(S,R,F,E)
        print("\t[%d,%d,%d,%d,%d, %f]," % ( int(S), int(R), F, int(E),math.floor(T), T ))
    print("];")
    
    print("module.exports.saleReturns = [")
    for i in range(1, 1000,2):
        T = float(i * i) # Goes up to 1 million tokens
        E = formula.calculateSaleReturn(S,R,F,T)
        print("\t[%d,%d,%d,%d,%d, %f]," % ( int(S), int(R), F, int(T),math.floor(E), E ))
    print("];")

def generateTestDataLargeNumbers():
    """ Generates some basic scenarios"""
    M = 1000000000000000000000000000L

    S = 300000L * M
    R = 63000L * M
    F= 21

    print("module.exports.purchaseReturnsLarge= [")
    for i in range(1, 1000,2):
        E = long(i)*long(i)*M # Goes up to 1 million ether 
        T = formula.calculatePurchaseReturn(S,R,F,E)
        print("\t[%d,%d,%d,%d,%d, %f]," % ( int(S), int(R), F, int(E),math.floor(T), T ))
    print("];")
    
    print("module.exports.saleReturnsLarge = [")
    for i in range(1, 1000,2):
        T = long(i)*long(i)*M # Goes up to 1 million tokens
        E = formula.calculateSaleReturn(S,R,F,T)
        print("\t[%d,%d,%d,%d,%d, %f]," % ( int(S), int(R),F, int(T),math.floor(E), E ))
    print("];")


def generateRandomTestData():
    M = 1000000000000000000000000000L

    print("module.exports.randomPurchaseReturns = [")
    for i in range(1, 100):
        S = float(random.randint(1e6, 3e6))
        F = random.randint(1, 100 )
        R = math.floor(F*S / 100)
        E = float(random.randint(700, 300000))

        lS = long(S) * M
        lR = long(R) * M
        lE = long(E) * M

        T = formula.calculatePurchaseReturn(S,R,float(F),E)
        lT = formula.calculatePurchaseReturn(lS,lR,float(F),lE)
        print("\t[%d,%d,%d,%d,%d, %f]," % ( int(S), int(R), int(F), int(E),math.floor(T), T ))
        print("\t[%d,%d,%d,%d,%d, %f]," % ( lS, lR, F, lE ,math.floor(lT), lT ))
    print("];")

    print("module.exports.randomSaleReturns = [")
    for i in range(1, 100):
        S = float(random.randint(1e6, 3e6))
        F = random.randint(1, 100 )
        R = math.floor(F*S / 100)
        T = float(random.randint(700, 300000))

        lS = long(S) * M
        lR = long(R) * M
        lT = long(T) * M

        E = formula.calculateSaleReturn(S,R,float(F),T)
        lE = formula.calculateSaleReturn(lS,lR,float(F),lT)
        print("\t[%d,%d,%d,%d,%d, %f]," % ( int(S), int(R), F, int(T),math.floor(E), E ))
        print("\t[%d,%d,%d,%d,%d, %f]," % ( lS, lR, F, lT,math.floor(lE), lE ))
    print("];")



def generateRandomTestData2():
    purchaseResults = []

    for i in range(1, 10000):
        S = float(random.randint(1, 3e18))
        F = random.randint(1, 100 )
        R = math.floor(F*S / 100)
        E = float(random.randint(700, 300000))
        try:
            T = formula.calculatePurchaseReturn(int(S),int(R),F,int(E))
            T_S = formula.calculatePurchaseReturnSolidity(int(S),int(R),F,int(E))
            if math.floor(T) < math.floor(T_S):
                purchaseResults.append("\t[%d,%d,%d,%d,%d, %f], # %d" % ( int(S), int(R), int(F), int(E),math.floor(T), T, T_S ))
                
        except Exception, e:
            pass       


    saleResults = []

    for i in range(1, 10000):
        S = float(random.randint(1, 3e18))
        F = random.randint(1, 100 )
        R = math.floor(F*S / 100)
        T = float(random.randint(700, 300000))
        try:
            E = formula.calculateSaleReturn(int(S),int(R),float(F),int(T))
            E_S = formula.calculateSaleReturnSolidity(int(S),int(R),float(F),int(T))
            if math.floor(E) < math.floor(E_S):
                saleResults.append("\t[%d,%d,%d,%d,%d, %f], # %d" % ( int(S), int(R), int(F), int(T),math.floor(E), E ,E_S))
        except Exception, e:
            pass

    print("module.exports.randomPurchaseReturns2 = [")
    print("\n".join(purchaseResults))
    print("];")

    print("module.exports.randomSaleReturns2 = [")
    print("\n".join(saleResults))
    print("];")
# module.exports.randomSaleReturns2 = [
#    [95289326501151232,7623146120092099,8,216782,0, 0.000000], # 21298824
#];
def testCornercase():
    #[S,R,F,T]  = [95289326501151232L,7623146120092099L,8,216782] # 21298824
    #E_S = formula.calculateSaleReturnSolidity(S,R,F,T)
    #E = formula.calculateSaleReturn(S,R,F,T)
    #print("E: %d" % E)
    #print("E_S: %d" % E_S)


    m = formula.Market(95289326501151232L,7623146120092099L,8)

    print "Market"
    print m
    # Attacker has 216782 tokens, 0 ether
    balance = (216782,0)
    print("Balance (tokens, ether): %s" % str(balance))
    # Sells all his tokens
    print("Sells all tokens.")
    balance = (0, m.sellForReserveToken(balance[0]))
    print("Balance : %s" % str(balance))

    print m
    # Buys back
    print("Buys back with all his ether")
    balance = (m.buyWithReserveToken(balance[1]+8e6), 0)
    print("Balance : %s" % str(balance))

    print balance
    print m

    print "Min buy  unit", formula.calcPurchaseMin(95289326501151232L)
    print "Min sale unit", formula.calcSaleMin(7623146120092099L)

def testCornercase2():
    S = 300000e18
    R = 63000e18
    F = 21

    tokens = 1e18 # 99 995 476 193 726 0661

    while True:
        wei = formula.calculateSaleReturnSolidity(S,R,F,tokens)
        correct_wei = formula.calculateSaleReturn(S,R,F,tokens)
        print "%f => %f error" % (tokens , (correct_wei - wei))
        if(correct_wei < wei):
            print("Diff %d wei" % (correct_wei - wei) )
        tokens = tokens+1e10

    print "Market"
    print m

#def testContinuousPurchase():
#
#    m = formula.Market(300000e18,63000e18,21)
#
#    #Now, keep buying, see what happens

def testPrecisionLimits():

    limit = 0
    i = 100
    n = 0
    while n < 1000 and limit < 500:
        print "Min buy  unit", formula.calcPurchaseMin(i)
        i += 5
        n = n+1

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

M = 1000000000000000000L
(S,R,F,T) = (300000*M, 63000*M, 21, 1*M)
formula.verbose = True
a = formula.calculateSaleReturnSolidity(S,R,F,T)
b = formula.calculateSaleReturn(S,R,F,T)
print(a,b,a-b)
#generateTestData()
#generateTestDataLargeNumbers()
#generateRandomTestData()



#generateRandomTestData2()
#testPrecisionLimits()
#testCornercase2()
#testLimits(formula.fixedExp)
#testLimits(formula.fixedLog2)
#testLog2()
#calculateFactorials()
#print(formula.fixedLog2(0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffL))
#print(formula.fixedLog2(0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffL-1))
#print(formula.fixedLog2(0x100000001))
#print("done")