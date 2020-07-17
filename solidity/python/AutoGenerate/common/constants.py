MAX_WEIGHT = 1000000 # The resolution of every weight parameter


MIN_PRECISION =  32 # The minimum scaling factor is 2 ^ MIN_PRECISION
MAX_PRECISION = 127 # The maximum scaling factor is 2 ^ MAX_PRECISION


NUM_OF_TAYLOR_COEFS  = 34 # The number of binomial coefficients in function 'generalExp'
NUM_OF_LAMBERT_COEFS = 35 # The number of binomial coefficients in function 'lambertPos' / 'lambertNeg'


LOG_MAX_HI_TERM_VAL = 1 # The input to function 'optimalLog' must be smaller than e ^ LOG_MAX_HI_TERM_VAL
LOG_NUM_OF_HI_TERMS = 8 # Compute e ^ (LOG_MAX_HI_TERM_VAL / 2 ^ n) for n = 0 to LOG_NUM_OF_HI_TERMS


EXP_MAX_HI_TERM_VAL = 4 # The input to function 'optimalExp' must be smaller than 2 ^ EXP_MAX_HI_TERM_VAL
EXP_NUM_OF_HI_TERMS = 7 # Compute e ^ 2 ^ n for n = EXP_MAX_HI_TERM_VAL - EXP_NUM_OF_HI_TERMS to EXP_MAX_HI_TERM_VAL


LAMBERT_POS2_EXTENT  =   3 # The size of the extended range calculated by the Lambert W Function outside the convergence radius
LAMBERT_POS2_SAMPLES = 128 # The size of the lookup table for approximating the Lambert W Function outside the convergence radius
