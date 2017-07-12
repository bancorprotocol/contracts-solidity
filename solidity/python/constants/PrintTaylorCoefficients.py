NUM_OF_COEFS = 34


coefs = [NUM_OF_COEFS]
for i in range(NUM_OF_COEFS-1,0,-1):
    coefs.append(coefs[-1]*i)


for i in range(NUM_OF_COEFS-1,-1,-1):
    print '0x{:x}'.format(coefs[i])
