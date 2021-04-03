import sys,os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__))).replace('\\','/')+'/..')


from decimal import Decimal
from decimal import getcontext
from common.constants import MAX_PRECISION
from common.constants import LAMBERT_POS2_EXTENT
from common.constants import LAMBERT_POS2_SAMPLES


from common.functions import lambertPos3
from common.functions import binarySearch
from FormulaSolidityPort import optimalLog
from FormulaSolidityPort import generalLog
from FormulaSolidityPort import OPT_LOG_MAX_VAL


getcontext().prec = 100


LAMBERT_CONV_RADIUS = int(Decimal(-1).exp()*2**MAX_PRECISION)
LAMBERT_POS2_SAMPLE = LAMBERT_POS2_EXTENT*2**MAX_PRECISION//(LAMBERT_POS2_SAMPLES-1)
LAMBERT_POS2_MAXVAL = LAMBERT_CONV_RADIUS+LAMBERT_POS2_SAMPLE*(LAMBERT_POS2_SAMPLES-1)
LAMBERT_POS3_MAXVAL = binarySearch(lambertPos3,[optimalLog,generalLog,OPT_LOG_MAX_VAL,2**MAX_PRECISION])


maxLen = len(hex(max([LAMBERT_CONV_RADIUS,LAMBERT_POS2_SAMPLE,LAMBERT_POS2_MAXVAL,LAMBERT_POS3_MAXVAL])))


print('    uint256 private constant LAMBERT_CONV_RADIUS = {0:#0{1}x};'.format(LAMBERT_CONV_RADIUS,maxLen))
print('    uint256 private constant LAMBERT_POS2_SAMPLE = {0:#0{1}x};'.format(LAMBERT_POS2_SAMPLE,maxLen))
print('    uint256 private constant LAMBERT_POS2_MAXVAL = {0:#0{1}x};'.format(LAMBERT_POS2_MAXVAL,maxLen))
print('    uint256 private constant LAMBERT_POS3_MAXVAL = {0:#0{1}x};'.format(LAMBERT_POS3_MAXVAL,maxLen))
