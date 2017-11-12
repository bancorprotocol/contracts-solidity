from decimal import Decimal
from decimal import getcontext


getcontext().prec = 80 # 78 digits for a maximum of 2^256-1, and 2 more digits for after the decimal point


def calculatePurchaseReturn(supply, balance, weight, amount):
    return Decimal(supply)*((1+Decimal(amount)/Decimal(balance))**(Decimal(weight)/1000000)-1)


def calculateSaleReturn(supply, balance, weight, amount):
    return Decimal(balance)*(1-(1-Decimal(amount)/Decimal(supply))**(1000000/Decimal(weight)))


def power(baseN, baseD, expN, expD, precision):
    return (Decimal(baseN)/Decimal(baseD))**(Decimal(expN)/Decimal(expD))*2**precision


def ln(numerator, denominator, precision):
    return (Decimal(numerator)/Decimal(denominator)).ln()*2**precision
