from sys     import argv
from os.path import basename
from decimal import Decimal
from decimal import getcontext


def calculate(supply,balance,ratio,change):
    ratio  /= 100
    change /= 100
    cur_amount = supply*(1-(1-change)**(ratio/(1-ratio)))
    new_amount = balance*(1-(1-cur_amount/supply)**(1/ratio))
    cur_price = balance/(supply*ratio)
    new_price = (balance-new_amount)/((supply-cur_amount)*ratio)
    print 'At present:'
    print '- The supply  = {:.20f}'.format(supply)
    print '- The balance = {:.20f}'.format(balance)
    print '- The price   = {:.20f}'.format(cur_price)
    print 'If you sell an amount of {:.20f}, then:'.format(cur_amount)
    print '- The supply  = {:.20f}'.format(supply-cur_amount)
    print '- The balance = {:.20f}'.format(balance-new_amount)
    print '- The price   = {:.20f}'.format(new_price)
    print 'Which reflects a price decrease of {:.20f} percent'.format((cur_price-new_price)/cur_price*100)


if len(argv) == 5:
    getcontext().prec = 30
    supply,balance,ratio,change = [Decimal(arg) for arg in argv[1:]]
    assert(0 < supply and 0 < balance and 0 < ratio <= 100 and 0 <= change < 100)
    calculate(supply,balance,ratio,change)
else:
    print '{} <supply> <balance> <ratio> <desired price change>'.format(basename(__file__))
