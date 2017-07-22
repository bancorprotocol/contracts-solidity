from math import factorial


NUM_OF_COEFS = 34


maxFactorial = factorial(NUM_OF_COEFS)
coefficients = [maxFactorial/factorial(i) for i in range(NUM_OF_COEFS)]


for coefficient in coefficients:
    print '0x{:x}'.format(coefficient)
