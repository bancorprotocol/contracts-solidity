from constants import *
from functions import *
from decimal import Decimal
from decimal import getcontext
from collections import namedtuple


getcontext().prec = 100
FIXED_1 = (1<<MAX_PRECISION)


HiTerm = namedtuple('HiTerm','val,exp')
LoTerm = namedtuple('LoTerm','num,den')


hiTerms = []
loTerms = []


for n in range(LOG_NUM_OF_HI_TERMS+1):
    cur = Decimal(LOG_MAX_HI_TERM_VAL)/2**n
    val = int(FIXED_1*cur)
    exp = int(FIXED_1*cur.exp())
    hiTerms.append(HiTerm(val,exp))


MAX_VAL = hiTerms[0].exp-1
loTerms = [LoTerm(FIXED_1*2,FIXED_1*2)]
res = optimalLog(MAX_VAL,hiTerms,loTerms,FIXED_1)
while True:
    n = len(loTerms)
    val = FIXED_1*(2*n+2)
    loTermsNext = loTerms+[LoTerm(val//(2*n+1),val)]
    resNext = optimalLog(MAX_VAL,hiTerms,loTermsNext,FIXED_1)
    if res < resNext:
        res = resNext
        loTerms = loTermsNext
    else:
        break


hiTermValMaxLen = max([len(hex(term.val)) for term in hiTerms[+1:]])
hiTermExpMaxLen = max([len(hex(term.exp)) for term in hiTerms[+1:]])
loTermNumMaxLen = max([len(hex(term.num)) for term in loTerms])
loTermDenMaxLen = max([len(hex(term.den)) for term in loTerms])


print('    uint256 private constant OPT_LOG_MAX_VAL = 0x{:x};'.format(hiTerms[0].exp))
print('')
print('    function optimalLog(uint256 x) internal pure returns (uint256) {')
print('        uint256 res = 0;')
print('')
print('        uint256 y;')
print('        uint256 z;')
print('        uint256 w;')
print('')
for term in hiTerms[+1:]:
    print('        if (x >= {2:#0{3}x}) {{res += {0:#0{1}x}; x = x * FIXED_1 / {2:#0{3}x};}}'.format(term.val,hiTermValMaxLen,term.exp,hiTermExpMaxLen))
print('')
print('        z = y = x - FIXED_1;')
print('        w = y * y / FIXED_1;')
for term in loTerms[:-1]:
    print('        res += z * ({0:#0{1}x} - y) / {2:#0{3}x}; z = z * w / FIXED_1;'.format(term.num,loTermNumMaxLen,term.den,loTermDenMaxLen))
print('        res += z * ({0:#0{1}x} - y) / {2:#0{3}x};'.format(loTerms[-1].num,loTermNumMaxLen,loTerms[-1].den,loTermDenMaxLen))
print('')
print('        return res;')
print('    }')
