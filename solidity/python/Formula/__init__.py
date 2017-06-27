from Power import power
from Power import PRECISION
from Power import FIXED_ONE
from Power import FIXED_TWO


'''*
    @dev given a token supply, reserve, CRR and a deposit amount (in the reserve token), calculates the return for a given change (in the main token)
    Formula:
    Return = _supply * ((1 + _depositAmount / _reserveBalance) ^ (_reserveRatio / 100) - 1)
    @param _supply             token total supply
    @param _reserveBalance     total reserve
    @param _reserveRatio       constant reserve ratio, 1-100
    @param _depositAmount      deposit amount, in reserve token
    @return purchase return amount
'''
def calculatePurchaseReturn(_supply, _reserveBalance, _reserveRatio, _depositAmount):
    # validate input
    assert(_supply != 0 and _reserveBalance != 0 and _reserveRatio > 0 and _reserveRatio <= 100)

    # special case for 0 deposit amount
    if (_depositAmount == 0):
        return 0

    baseN = safeAdd(_depositAmount, _reserveBalance)

    # special case if the CRR = 100
    if (_reserveRatio == 100):
        temp = safeMul(_supply, baseN) / _reserveBalance
        return safeSub(temp, _supply) 

    resN = power(baseN, _reserveBalance, _reserveRatio, 100)

    temp = safeMul(_supply, resN) / FIXED_ONE

    return safeSub(temp, _supply)


'''*
    @dev given a token supply, reserve, CRR and a sell amount (in the main token), calculates the return for a given change (in the reserve token)
    Formula:
    Return = _reserveBalance * (1 - (1 - _sellAmount / _supply) ^ (1 / (_reserveRatio / 100)))
    @param _supply             token total supply
    @param _reserveBalance     total reserve
    @param _reserveRatio       constant reserve ratio, 1-100
    @param _sellAmount         sell amount, in the token itself
    @return sale return amount
'''
def calculateSaleReturn(_supply, _reserveBalance, _reserveRatio, _sellAmount):
    # validate input
    assert(_supply != 0 and _reserveBalance != 0 and _reserveRatio > 0 and _reserveRatio <= 100 and _sellAmount <= _supply)

    # special case for 0 sell amount
    if (_sellAmount == 0):
        return 0

    baseN = safeSub(_supply, _sellAmount)

    # special case if the CRR = 100
    if (_reserveRatio == 100):
        temp1 = safeMul(_reserveBalance, _supply)
        temp2 = safeMul(_reserveBalance, baseN)
        return safeSub(temp1, temp2) / _supply

    # special case for selling the entire supply
    if (_sellAmount == _supply):
        return _reserveBalance

    resN = power(_supply, baseN, 100, _reserveRatio)

    temp1 = safeMul(_reserveBalance, resN)
    temp2 = safeMul(_reserveBalance, FIXED_ONE)

    return safeSub(temp1, temp2) / resN


def safeMul(x,y):
    assert(x * y < (1 << 256))
    return x * y


def safeAdd(x,y):
    assert(x + y < (1 << 256))
    return x + y


def safeSub(x,y):
    assert(x - y >= 0)
    return x - y
