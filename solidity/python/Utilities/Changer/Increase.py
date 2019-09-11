from sys     import argv
from os.path import basename
from decimal import Decimal
from decimal import getcontext


MAX_RATIO = 1000000


def calculate(supply, balance, ratio, change):
    assert 0 < supply and 0 < balance and 0 < ratio <= MAX_RATIO and 0 <= change
    ratio /= MAX_RATIO
    change /= 100
    cur_amount = balance * ((1 + change) ** (1 / (1 - ratio)) - 1)
    new_amount = supply * ((1 + cur_amount / balance) ** ratio - 1)
    cur_price = balance / (supply * ratio)
    new_price = (balance + cur_amount) / ((supply + new_amount) * ratio)
    print('At present:')
    print('- supply  = {:.10f}'.format(supply))
    print('- balance = {:.10f}'.format(balance))
    print('- price   = {:.10f}'.format(cur_price))
    print('If you buy an amount of {:.10f}, then:'.format(cur_amount))
    print('- supply  = {:.10f}'.format(supply + new_amount))
    print('- balance = {:.10f}'.format(balance + cur_amount))
    print('- price   = {:.10f}'.format(new_price))
    print('Which reflects a price increase of {:.10f} percent'.format((new_price - cur_price) / cur_price * 100))


if len(argv) == 5:
    getcontext().prec = 80
    supply, balance, ratio, change = [Decimal(arg) for arg in argv[1:]]
    calculate(supply, balance, ratio, change)
else:
    print('{} <supply> <balance> <ratio> <desired price change>'.format(basename(__file__)))
