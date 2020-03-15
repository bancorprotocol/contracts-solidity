from decimal import Decimal
from decimal import getcontext


getcontext().prec = 80 # 78 digits for a maximum of 2^256-1, and 2 more digits for after the decimal point


def calculatePurchaseReturn(supply, balance, ratio, amount):
    supply, balance, ratio, amount = [Decimal(value) for value in vars().values()]
    return supply*((1+amount/balance)**(ratio/1000000)-1)


def calculateSaleReturn(supply, balance, ratio, amount):
    supply, balance, ratio, amount = [Decimal(value) for value in vars().values()]
    return balance*(1-(1-amount/supply)**(1000000/ratio))


def calculateCrossReserveReturn(balance1, ratio1, balance2, ratio2, amount):
    balance1, ratio1, balance2, ratio2, amount = [Decimal(value) for value in vars().values()]
    return balance2*(1-(balance1/(balance1+amount))**(ratio1/ratio2))


def calculateFundCost(supply, balance, ratios, amount):
    supply, balance, ratios, amount = [Decimal(value) for value in vars().values()]
    return balance*(((supply+amount)/supply)**(1000000/ratios)-1)


def calculateLiquidateReturn(supply, balance, ratios, amount):
    supply, balance, ratios, amount = [Decimal(value) for value in vars().values()]
    return balance*(1-((supply-amount)/supply)**(1000000/ratios))


def power(baseN, baseD, expN, expD, precision):
    baseN, baseD, expN, expD, precision = [Decimal(value) for value in vars().values()]
    return (baseN/baseD)**(expN/expD)*2**precision
