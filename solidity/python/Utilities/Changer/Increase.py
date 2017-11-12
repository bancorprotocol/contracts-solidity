from sys     import argv
from os.path import basename
from decimal import Decimal
from decimal import getcontext


MAX_WEIGHT = 1000000


def calculate(supply, balance, weight, change):
    assert(0 < supply and 0 < balance and 0 < weight <= MAX_WEIGHT and 0 <= change)
    weight /= MAX_WEIGHT
    change /= 100
    cur_amount = balance * ((1 + change) ** (1 / (1 - weight)) - 1)
    new_amount = supply * ((1 + cur_amount / balance) ** weight - 1)
    cur_price = balance / (supply * weight)
    new_price = (balance + cur_amount) / ((supply + new_amount) * weight)
    print 'At present:'
    print '- supply  = {:.10f}'.format(supply)
    print '- balance = {:.10f}'.format(balance)
    print '- price   = {:.10f}'.format(cur_price)
    print 'If you buy an amount of {:.10f}, then:'.format(cur_amount)
    print '- supply  = {:.10f}'.format(supply + new_amount)
    print '- balance = {:.10f}'.format(balance + cur_amount)
    print '- price   = {:.10f}'.format(new_price)
    print 'Which reflects a price increase of {:.10f} percent'.format((new_price - cur_price) / cur_price * 100)


if len(argv) == 5:
    getcontext().prec = 80
    supply, balance, weight, change = [Decimal(arg) for arg in argv[1:]]
    calculate(supply, balance, weight, change)
else:
    print '{} <supply> <balance> <weight> <desired price change>'.format(basename(__file__))
