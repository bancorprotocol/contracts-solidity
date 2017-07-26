from decimal import Decimal
from decimal import getcontext


getcontext().prec = 80 # 78 digits for a maximum of 2^256-1, and 2 more digits for after the decimal point


def calculatePurchaseReturn(_supply, _reserveBalance, _reserveRatio, _depositAmount):
    return Decimal(_supply)*((1+Decimal(_depositAmount)/Decimal(_reserveBalance))**(Decimal(_reserveRatio)/100)-1)


def calculateSaleReturn(_supply, _reserveBalance, _reserveRatio, _sellAmount):
    return Decimal(_reserveBalance)*(1-(1-Decimal(_sellAmount)/Decimal(_supply))**(100/Decimal(_reserveRatio)))


def power(_baseN, _baseD, _expN, _expD, _precision):
    return (Decimal(_baseN)/Decimal(_baseD))**(Decimal(_expN)/Decimal(_expD))*2**_precision


def ln(_numerator, _denominator, _precision):
    return (Decimal(_numerator)/Decimal(_denominator)).ln()*2**_precision
