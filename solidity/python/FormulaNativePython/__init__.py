from decimal import Decimal
from decimal import getcontext


getcontext().prec = 80 # 78 digits for a maximum of 2^256-1, and 2 more digits for after the decimal point


def calculatePurchaseReturn(supply, balance, weight, amount):
    return Decimal(supply)*((1+Decimal(amount)/Decimal(balance))**(Decimal(weight)/1000000)-1)


def calculateSaleReturn(supply, balance, weight, amount):
    return Decimal(balance)*(1-(1-Decimal(amount)/Decimal(supply))**(1000000/Decimal(weight)))


def calculateCrossConnectorReturn(balance1, weight1, balance2, weight2, amount):
    return Decimal(balance2)*(1-(Decimal(balance1)/Decimal(balance1+amount))**(Decimal(weight1)/Decimal(weight2)))


def calculateFundReturn(supply, balance, weights, amount):
    return Decimal(balance)*((Decimal(supply+amount)/Decimal(supply))**(1000000/Decimal(weights))-1)


def calculateLiquidateReturn(supply, balance, weights, amount):
    return Decimal(balance)*((Decimal(supply)/Decimal(supply-amount))**(1000000/Decimal(weights))-1)


def power(baseN, baseD, expN, expD, precision):
    return (Decimal(baseN)/Decimal(baseD))**(Decimal(expN)/Decimal(expD))*2**precision
