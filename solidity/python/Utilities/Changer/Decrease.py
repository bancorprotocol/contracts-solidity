from sys     import argv
from os.path import basename
from decimal import Decimal
from decimal import getcontext


MAX_WEIGHT = 1000000


def calculate(supply, balance, weight, change):
    assert(0 < supply and 0 < balance and 0 < weight <= MAX_WEIGHT and 0 <= change < 100)
    weight /= MAX_WEIGHT
    change /= 100
    cur_amount = supply * (1 - (1 - change) ** (weight / (1 - weight)))
    new_amount = balance * (1 - (1 - cur_amount / supply) ** (1 / weight))
    cur_price = balance / (supply * weight)
    new_price = (balance - new_amount) / ((supply - cur_amount) * weight)
    print 'At present:'
    print '- supply  = {:.10f}'.format(supply)
    print '- balance = {:.10f}'.format(balance)
    print '- price   = {:.10f}'.format(cur_price)
    print 'If you sell an amount of {:.10f}, then:'.format(cur_amount)
    print '- supply  = {:.10f}'.format(supply - cur_amount)
    print '- balance = {:.10f}'.format(balance - new_amount)
    print '- price   = {:.10f}'.format(new_price)
    print 'Which reflects a price decrease of {:.10f} percent'.format((cur_price - new_price) / cur_price * 100)


if len(argv) == 5:
    getcontext().prec = 80
    supply, balance, weight, change = [Decimal(arg) for arg in argv[1:]]
    calculate(supply, balance, weight, change)
else:
    print '{} <supply> <balance> <weight> <desired price change>'.format(basename(__file__))
