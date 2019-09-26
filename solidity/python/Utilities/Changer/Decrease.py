from sys     import argv
from os.path import basename
from decimal import Decimal
from decimal import getcontext


MAX_RATIO = 1000000


def calculate(supply, balance, ratio, change):
    assert 0 < supply and 0 < balance and 0 < ratio <= MAX_RATIO and 0 <= change < 100
    ratio /= MAX_RATIO
    change /= 100
    cur_amount = supply * (1 - (1 - change) ** (ratio / (1 - ratio)))
    new_amount = balance * (1 - (1 - cur_amount / supply) ** (1 / ratio))
    cur_price = balance / (supply * ratio)
    new_price = (balance - new_amount) / ((supply - cur_amount) * ratio)
    print('At present:')
    print('- supply  = {:.10f}'.format(supply))
    print('- balance = {:.10f}'.format(balance))
    print('- price   = {:.10f}'.format(cur_price))
    print('If you sell an amount of {:.10f}, then:'.format(cur_amount))
    print('- supply  = {:.10f}'.format(supply - cur_amount))
    print('- balance = {:.10f}'.format(balance - new_amount))
    print('- price   = {:.10f}'.format(new_price))
    print('Which reflects a price decrease of {:.10f} percent'.format((cur_price - new_price) / cur_price * 100))


if len(argv) == 5:
    getcontext().prec = 80
    supply, balance, ratio, change = [Decimal(arg) for arg in argv[1:]]
    calculate(supply, balance, ratio, change)
else:
    print('{} <supply> <balance> <ratio> <desired price change>'.format(basename(__file__)))
