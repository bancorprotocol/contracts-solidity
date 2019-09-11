from decimal import Decimal
from decimal import getcontext


getcontext().prec = 80 # 78 digits for a maximum of 2^256-1, and 2 more digits for after the decimal point


def calculatePurchaseReturn(supply, balance, ratio, amount):
    return Decimal(supply)*((1+Decimal(amount)/Decimal(balance))**(Decimal(ratio)/1000000)-1)


def calculateSaleReturn(supply, balance, ratio, amount):
    return Decimal(balance)*(1-(1-Decimal(amount)/Decimal(supply))**(1000000/Decimal(ratio)))


def calculateCrossReserveReturn(balance1, ratio1, balance2, ratio2, amount):
    return Decimal(balance2)*(1-(Decimal(balance1)/Decimal(balance1+amount))**(Decimal(ratio1)/Decimal(ratio2)))


def power(baseN, baseD, expN, expD, precision):
    return (Decimal(baseN)/Decimal(baseD))**(Decimal(expN)/Decimal(expD))*2**precision
