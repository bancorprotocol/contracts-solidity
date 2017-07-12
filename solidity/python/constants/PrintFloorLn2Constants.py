from math import log


NUM_OF_CONSTANTS = 64


constants = [int(log(2)*(2**n)) for n in range(NUM_OF_CONSTANTS)]


maxLen = len('0x{:x}'.format(constants[-1]))
formatString = '{:s}{:d}{:s}'.format('{:',maxLen,'s} / 2^{:2d} = {:54.53f}')


for n in range(NUM_OF_CONSTANTS):
    print formatString.format('0x{:x}'.format(constants[n]),n,float(constants[n])/(2**n))
