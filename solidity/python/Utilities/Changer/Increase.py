from sys     import argv
from os.path import basename
from decimal import Decimal
from decimal import getcontext


def calculate(supply,balance,ratio,change):
    ratio  /= 100
    change /= 100
    cur_amount = balance*((1+change)**(1/(1-ratio))-1)
    new_amount = supply*((1+cur_amount/balance)**ratio-1)
    cur_price = balance/(supply*ratio)
    new_price = (balance+cur_amount)/((supply+new_amount)*ratio)
    print 'At present:'
    print '- The supply  = {:.10f}'.format(supply)
    print '- The balance = {:.10f}'.format(balance)
    print '- The price   = {:.10f}'.format(cur_price)
    print 'If you buy an amount of {:.10f}, then:'.format(cur_amount)
    print '- The supply  = {:.10f}'.format(supply+new_amount)
    print '- The balance = {:.10f}'.format(balance+cur_amount)
    print '- The price   = {:.10f}'.format(new_price)
    print 'Which reflects a price increase of {:.10f} percent'.format((new_price-cur_price)/cur_price*100)


if len(argv) == 5:
    getcontext().prec = 80
    supply,balance,ratio,change = [Decimal(arg) for arg in argv[1:]]
    assert(0 < supply and 0 < balance and 0 < ratio <= 100 and 0 <= change)
    calculate(supply,balance,ratio,change)
else:
    print '{} <supply> <balance> <ratio> <desired price change>'.format(basename(__file__))
