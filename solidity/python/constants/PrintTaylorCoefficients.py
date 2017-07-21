from math import factorial


NUM_OF_COEFS = 34


maxFactorial = factorial(NUM_OF_COEFS)


for i in range(NUM_OF_COEFS):
    print '0x{:x}'.format(maxFactorial/factorial(i))
