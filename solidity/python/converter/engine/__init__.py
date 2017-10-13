from json import loads
from json import dumps
from copy import deepcopy


from decimal import Decimal
from decimal import getcontext
getcontext().prec = 100


def buy (supply, reserve, ratio, amount): return int(Decimal(supply)*((1+Decimal(amount)/Decimal(reserve))**(Decimal(ratio)/1000000)-1))
def sell(supply, reserve, ratio, amount): return int(Decimal(reserve)*(1-(1-Decimal(amount)/Decimal(supply))**(1000000/Decimal(ratio))))


class Engine():
    def __init__(self,model={}):
        self.model = deepcopy(model)
    def run(self,fileName):
        fileDesc = open(fileName,'r')
        commands = loads(fileDesc.read())
        fileDesc.close()
        for command in commands:
            operation = command['operation']
            if operation == 'load':
                self.load(command['fileName'])
            if operation == 'save':
                self.save(command['fileName'])
            if operation == 'execute':
                self.execute(command['explicit'],command['update'],command['path'],command['amount'])
    def load(self,fileName):
        fileDesc = open(fileName,'r')
        self.model = loads(fileDesc.read())
        fileDesc.close()
        print 'Load '+fileName
    def save(self,fileName):
        fileDesc = open(fileName,'w')
        fileDesc.write(dumps(self.model,indent=4,sort_keys=True))
        fileDesc.close()
        print 'Save '+fileName
    def execute(self,explicit,update,path,amount):
        old_amount = amount
        sign = [-1,+1][explicit]
        model = deepcopy(self.model)
        for first,second in zip(path[::sign],path[::sign][1:]):
            func,outer,inner = (sell,model[first],model[first][second]) if first in model and second in model[first] else (buy,model[second],model[second][first])
            new_amount = func(outer['supply'],inner['reserve'],inner['ratio'],amount*sign)*sign
            outer['supply' ] += {buy:+new_amount*sign,sell:-amount*sign}[func]
            inner['reserve'] += {buy:+amount*sign,sell:-new_amount*sign}[func]
            amount = new_amount
        if update:
            self.model = model
        print 'Explicit = {:5s}, Update = {:5s}: {} {} = {} {}'.format(str(explicit),str(update),old_amount,path[explicit-1],new_amount,path[0-explicit])
