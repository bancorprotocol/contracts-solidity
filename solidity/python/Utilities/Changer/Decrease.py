from sys     import argv
from os.path import basename
from decimal import Decimal
from decimal import getcontext

MAX_WEIGHT = 1000000

def calculate(supply, connectorBalance, weight, change):
    assert(0 < supply and 0 < connectorBalance and 0 < weight <= MAX_WEIGHT and 0 <= change < 100)
    weight /= MAX_WEIGHT
    change /= 100
    cur_amount = supply * (1 - (1 - change) ** (weight / (1 - weight)))
    new_amount = connectorBalance * (1 - (1 - cur_amount / supply) ** (1 / weight))
    cur_price = connectorBalance / (supply * weight)
    new_price = (connectorBalance - new_amount) / ((supply - cur_amount) * weight)
    print 'At present:'
    print '- supply            = {:.10f}'.format(supply)
    print '- connector balance = {:.10f}'.format(connectorBalance)
    print '- price             = {:.10f}'.format(cur_price)
    print 'If you sell an amount of {:.10f}, then:'.format(cur_amount)
    print '- supply            = {:.10f}'.format(supply-cur_amount)
    print '- connector balance = {:.10f}'.format(connectorBalance-new_amount)
    print '- price             = {:.10f}'.format(new_price)
    print 'Which reflects a price decrease of {:.10f} percent'.format((cur_price - new_price) / cur_price * 100)


if len(argv) == 5:
    getcontext().prec = 80
    supply, connectorBalance, weight, change = [Decimal(arg) for arg in argv[1:]]
    calculate(supply, connectorBalance, weight, change)
else:
    print '{} <supply> <connectorBalance> <weight> <desired price change>'.format(basename(__file__))
