import analysis as formula
import random,math


tooLargeReturns = {
        "purchaseReturn" : [], 
        "saleReturn": [],

}
expectedThrows = {
        "purchaseReturn" : [], 
        "saleReturn": [],    
}
def purchaseReturn(S,R,F,E):
    """ Returns a tuple
    ( python high-precision purchase return, python-solidity purchase return )
    """

    T = formula.calculatePurchaseReturn(S,R,F,E)
    try:
        Tsol =  formula.calculatePurchaseReturnSolidity(S,R,F,E)
        if Tsol > T:
            addTooLargeReturnOnPurchase(S,R,F,E,T,Tsol)
        return (T,Tsol)
    except Exception as e:
        addExpectedThrowOnPurchase(S,R,F,E, str(e))
    
    return (T,0)


def saleReturn(S,R,F,T):
    """ Returns a tuple
    ( python high-precision purchase return, python-solidity purchase return )
    """

    E = formula.calculateSaleReturn(S,R,F,T)
    try:
        Esol = formula.calculateSaleReturnSolidity(S,R,F,T)
        if Esol > E:
            addTooLargeReturnOnSale(S,R,F,T,E,Esol)
        return (E,Esol)
    except Exception as e:
        addExpectedThrowOnSale(S,R,F,E, str(e))
    
    return (E,0)




def addTooLargeReturnOnPurchase(S,R,F,E,T,Tsol):
    tooLargeReturns['purchaseReturn'].append([S,R,F,E,Tsol,T])

def addTooLargeReturnOnSale(S,R,F,T,E,Esol):
    tooLargeReturns['saleReturn'].append([S,R,F,T,Esol,E])

def addExpectedThrowOnPurchase(S,R,F,E, ex):
    expectedThrows['purchaseReturn'].append([S,R,F,E, ex])

def addExpectedThrowOnSale(S,R,F,T, ex):
    expectedThrows['saleReturn'].append([S,R,F,T, ex])

    
def generateTestData(outp):
    """ Generates some basic scenarios"""

    S = 300000.0
    R = 63000.0
    F= 21

    outp.append("module.exports.purchaseReturns= [")
    for i in range(1, 1000,2):
        E = float(i * i) # Goes up to 1 million ether 
        (T,Tsol) = purchaseReturn(S,R,F,E)
        outp.append("\t['%d','%d','%d','%d','%d', '%f']," % ( int(S), int(R), F, int(E),Tsol, T ))
    outp.append("];")
    
    outp.append("module.exports.saleReturns = [")
    for i in range(1, 1000,2):
        T = float(i * i) # Goes up to 1 million tokens
        (E, Esol) = saleReturn(S,R,F,T)
        outp.append("\t['%d','%d','%d','%d','%d', '%f']," % ( int(S), int(R), F, int(T),Esol, E ))
    outp.append("];")

def generateTestDataLargeNumbers(outp):
    """ Generates some basic scenarios"""
    M = 1000000000000000000000000000L

    S = 300000L * M
    R = 63000L * M
    F= 21

    outp.append("module.exports.purchaseReturnsLarge= [")
    for i in range(1, 1000,2):
        E = long(i)*long(i)*M # Goes up to 1 million ether 
        (T,Tsol) = purchaseReturn(S,R,F,E)
        outp.append("\t['%d','%d','%d','%d','%d', '%f']," % ( int(S), int(R), F, int(E),Tsol, T ))
    outp.append("];")
    
    outp.append("module.exports.saleReturnsLarge = [")
    for i in range(1, 1000,2):
        T = long(i)*long(i)*M # Goes up to 1 million tokens
        (E, Esol) = saleReturn(S,R,F,T)
        outp.append("\t['%d','%d','%d','%d','%d', '%f']," % ( int(S), int(R),F, int(T),Esol, E ))
    outp.append("];")


def generateRandomTestData(outp):
    M = 1000000000000000000000000000L

    outp.append("module.exports.randomPurchaseReturns = [")
    for i in range(1, 30000):
        S = long(random.randint(1e6, 3e6))
        F = random.randint(1, 100 )
        R = math.floor(F*S / 100)
        E = long(random.randint(700, 300000))

        (T,Tsol) = purchaseReturn(S,R,F,E)

        lS = long(S) * M
        lR = long(R) * M
        lE = long(E) * M

        (largeT,largeTsol) = purchaseReturn(lS,lR,F,lE)

        outp.append("\t['%d','%d','%d','%d','%d', '%f']," % ( S, R, F, E,Tsol, T ))
        outp.append("\t['%d','%d','%d','%d','%d', '%f']," % ( lS, lR, F, lE ,largeTsol, largeT ))
    outp.append("];")

    saleReturnDiffs = []

    def addDiff(s,r,f,t, e,esol):
        diff = e - esol
        diff_percent = 100*diff / e
        saleReturnDiffs.append([s,r,f,t, e, esol, diff, diff_percent])


    outp.append("module.exports.randomSaleReturns = [")
    for i in range(1, 30000):
        S = long(random.randint(1e6, 3e6))
        F = random.randint(1, 100 )
        R = math.floor(F*S / 100)
        T = long(random.randint(700, 300000))

        (E, Esol) = saleReturn(S,R,F,T)

        lS = long(S) * M
        lR = long(R) * M
        lT = long(T) * M
    
        (largeE, largeEsol) = saleReturn(lS,lR,F,lT)
        
        addDiff(S,R,F,T,E, Esol)
        addDiff(lS,lR,F,lT,largeE, largeEsol)
    
        outp.append("\t['%d','%d','%d','%d','%d', '%f']," % ( S, R, F, T,Esol, E ))
        outp.append("\t['%d','%d','%d','%d','%d', '%f']," % ( lS, lR, F, lT, largeEsol, largeE ))
    outp.append("];")

    maxdiff = 0
    for diff in saleReturnDiffs: 
        [s,r,f,t,e, e_sol, d, d_percent] = diff
        if maxdiff < d_percent:
            maxdiff = d_percent
        #print("Sale diff %s percent, for values %s" % (d_percent, [s,r,f,t, e_sol, e]))
    print "Largest diff %s percent" % maxdiff


def printTooLargeReturns(outp):

    outp.append("module.exports.tooLargePurchaseReturns = [")
    for l in tooLargeReturns['purchaseReturn']:
        outp.append("\t[%s]," % (",".join(["'%s'" % str(i) for i in l])))
    outp.append("];")

    outp.append("module.exports.tooLargeSaleReturns = [")
    for l in tooLargeReturns['saleReturn']:
        outp.append("\t[%s]," % (",".join(["'%s'" % str(i) for i in l])))
    outp.append("];")

def printExpectedThrows(outp):
    outp.append("module.exports.purchaseReturnExpectedThrows = [")
    for l in expectedThrows['purchaseReturn']:
        outp.append("\t[%s]," % (",".join(["'%s'" % str(i) for i in l])))
    outp.append("];")

    outp.append("module.exports.saleReturnExpectedThrows = [")
    for l in expectedThrows['saleReturn']:
        outp.append("\t[%s]," % (",".join(["'%s'" % str(i) for i in l])))
    outp.append("];")


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

def testCornercase():


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

def testTooLargeSaleReturns():
    """
    Contains some testcases, found during random testing, where the sale return was larger than expected
    """


    testdata = [
        [2571869000000000000000000000000000,360061000000000000000000000000000,14,284283000000000000000000000000000,204102574328104782565993111517581,2.04102574323e+32],
        [300000000000000000000000000000000,63000000000000000000000000000000,21,2401000000000000000000000000000,2365120993837509886570622084182,0],        
        [300000000000000000000000000000000,63000000000000000000000000000000,21,1000000000000000000000000000,1000012229933918459614528650,9.99993730188e+26],
        [300000000000000000000000000000000,63000000000000000000000000000000,21,49000000000000000000000000000,48984954188962049634901119411,4.89849483746e+28],
        [300000000000000000000000000000000,63000000000000000000000000000000,21,81000000000000000000000000000,80958876280831287208758481856,8.09588737955e+28],
    ]
    for td in testdata:
        [s,r,f,t,x,y] = td
        e = formula.calculateSaleReturnSolidity(s,r,f,t)
        e_cor = formula.calculateSaleReturn(s,r,f,t)
        print("E   : %s"% e)
        print("E_C : %s"% e_cor)
        diff = e - e_cor
        smin = formula.calcSaleMin(r)
        print("diff: %s"%  diff)
        print("smin: %s "%  smin )
        print("d/s : %s " % (diff/smin))
        print("")

def writeTestdataToFile():
    """ Write generated data to a file, for js-based unit-testing in e.g. truffle"""
    
    outp = []
    generateTestData(outp)
    generateTestDataLargeNumbers(outp)
    generateRandomTestData(outp)
    outp = []
    printTooLargeReturns(outp)
    printExpectedThrows(outp)
    print "\n".join(outp)

    with open("testdata.js", "w+") as f:
        f.write("\n".join(outp))
        
    

def generateRandomTestWithGiven(S,R,F):


    d = {"largestDiff" : 0, "largest" : "", "largestNegativeDiff": "", "largestNegative" : 0}
    
    def addDiff(sale, isSale=True):

        corr = sale[-1]
        act  = sale[-2]
        diff = corr - act
        if corr == 0 and act != 0:
            print("0 expected, got %d" % act)
            print(sale)
        elif act == 0 and corr != 0:
            pass
        else:
            diff_percent = 100*diff / corr
            out = ["Expected %d got %d,diff of %f percent" % (corr, act, diff_percent)]
            if isSale:
                out.append("S: %s" % (sale))
            else:
                out.append("P: %s" % (sale))
            
            if diff_percent > d["largestDiff"]:
                d["largestDiff"] = diff_percent
                d["largest"] = "\n".join(out)
            if diff_percent < d["largestNegative"]:
                d["largestNegativeDiff"] = diff_percent
                d["largestNegative"] = "\n".join(out)



            #print "\n".join(out)

    for i in range(1, 10000000):

        randE = long(random.randint(700, S))
        randT = long(random.randint(700, S))

        (T,Tsol) = purchaseReturn(S,R,F,randE)
        (E, Esol) = saleReturn(S,R,F,randT)

        purchase = [S,R,F,randE,Tsol,T]
        sale     = [S,R,F,randT,Esol,E]

        addDiff(sale)
        addDiff(purchase, False)


    print("Largest diff:")
    print d["largest"]

    print("Largest negative diff:")
    print d["largestNegative"]

def doFixedLog2MaxTest():
    def f(inp):
        a = formula.fixedLog2_max(inp)
        b = formula.realFixedLogn(inp,2)
        if a  < b:
            print "%s => %s < %s" % (inp, a, b)
            return 1
        return 0
    iterations = 10000
    count =0 
    for i in range(1,iterations):
        x = random.randint(0x100000000,0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffL)
        count = count +  f(x)    
    
    print("doFixedLog2MaxTest : Found %d cases out of %d" % (count, iterations))

def doFixedLog2MinTest():
    def f(inp):
        a = formula.fixedLog2_min(inp)
        b = formula.realFixedLogn(inp,2)
        if a > b:
            print "%s => %s > %s" % (inp, a, b)
            return 1
        return 0
    iterations = 100000
    count =0 
    for i in range(1,iterations):
        x = random.randint(0x100000000,0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffL)
        count = count +  f(x)    
    
    print("doFixedLog2MinTest : Found %d cases out of %d " % (count, iterations))

# 
M = 1000000000000000000L
S = 79323978L
R = 79344L
F = 10
generateRandomTestWithGiven(M*S,M*R,F)
# 916 136 292 775 233 477
#[S,R,F,T,a,b] = [79323978000000000000000000L, 79344000000000000000000L, 10, 916136292775233477L, 0, 9163674940076306.0]
#
##[S,R,F,T,a,b] = [79323978000000000000000000L, 79344000000000000000000L, 10, 8800523918738181190L, 88101047014325420L, 8.802740859166925e+16]             
#formula.verbose = True
#print formula.calculateSaleReturn(S,R,F,T)
#print formula.calculateSaleReturnSolidity(S,R,F,T)
#

#doFixedLog2MinTest()
#doFixedLog2MaxTest()
#x = 67504686562770247832571536239480371532496774510112092282143228637781870841065
#formula.verbose = True
#formula.fixedLog2_max(x)
#print formula.realFixedLogFloat(x,2)
# 0.000 532 574 797 862 395
# 0.000 184 737 145 470 601

