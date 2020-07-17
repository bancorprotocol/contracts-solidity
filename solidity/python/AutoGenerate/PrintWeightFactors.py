from common.constants import MAX_WEIGHT


MAX_UNF_WEIGHT = (2**256-1)//MAX_WEIGHT


print('    uint256 private constant MAX_UNF_WEIGHT = 0x{:x};'.format(MAX_UNF_WEIGHT))
