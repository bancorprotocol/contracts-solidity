from constants import *
from functions import *
from math import factorial
from decimal import Decimal
from decimal import getcontext
from collections import namedtuple


getcontext().prec = 100
FIXED_1 = (1<<MAX_PRECISION)


HiTerm = namedtuple('HiTerm','bit,num,den')
LoTerm = namedtuple('LoTerm','val,ind')


hiTerms = []
loTerms = []


top = int(Decimal(2**(0+EXP_MAX_HI_TERM_VAL-EXP_NUM_OF_HI_TERMS)).exp()*FIXED_1)-1
for n in range(EXP_NUM_OF_HI_TERMS+1):
    cur = Decimal(2**(n+EXP_MAX_HI_TERM_VAL-EXP_NUM_OF_HI_TERMS)).exp()
    den = int(((1<<256)-1)/(cur*top))
    num = int(den*cur)
    top = top*num//den
    bit = (FIXED_1<<(n+EXP_MAX_HI_TERM_VAL))>>EXP_NUM_OF_HI_TERMS
    hiTerms.append(HiTerm(bit,num,den))


MAX_VAL = hiTerms[-1].bit-1
loTerms = [LoTerm(1,1)]
res = optimalExp(MAX_VAL,hiTerms,loTerms,FIXED_1)
while True:
    n = len(loTerms)+1
    val = factorial(n)
    loTermsNext = [LoTerm(val//factorial(i+1),i+1) for i in range(n)]
    resNext = optimalExp(MAX_VAL,hiTerms,loTermsNext,FIXED_1)
    if res < resNext:
        res = resNext
        loTerms = loTermsNext
    else:
        break


hiTermBitMaxLen = max([len(hex(term.bit)) for term in hiTerms[:-1]])
hiTermNumMaxLen = max([len(hex(term.num)) for term in hiTerms[:-1]])
hiTermDenMaxLen = max([len(hex(term.den)) for term in hiTerms[:-1]])
loTermValMaxLen = max([len(hex(term.val)) for term in loTerms[+1:]])
loTermIndMaxLen = max([len(str(term.ind)) for term in loTerms[+1:]])


print('        z = y = x % 0x{:x};'.format(hiTerms[0].bit))
for term in loTerms[+1:]:
    print('        z = z * y / FIXED_1; res += z * {0:#0{4}x}; // add y^{1:0{5}d} * ({2:0{5}d}! / {3:0{5}d}!)'.format(term.val,term.ind,len(loTerms),term.ind,loTermValMaxLen,loTermIndMaxLen))
print('        res = res / 0x{:x} + y + FIXED_1; // divide by {}! and then add y^1 / 1! + y^0 / 0!'.format(loTerms[0].val,len(loTerms)))
print('')
for term in hiTerms[:-1]:
    print('        if ((x & {0:#0{1}x}) != 0) res = res * {2:#0{3}x} / {4:#0{5}x};'.format(term.bit,hiTermBitMaxLen,term.num,hiTermNumMaxLen,term.den,hiTermDenMaxLen))
print('')
print('    uint256 private constant OPT_EXP_MAX_VAL = 0x{:x};'.format(hiTerms[-1].bit))
