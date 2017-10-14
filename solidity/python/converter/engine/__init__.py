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
        self.__find_paths__()
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
            if operation == 'convert':
                self.convert(command['explicit'],command['source'],command['target'],command['amount'],command['update'])
    def load(self,fileName):
        fileDesc = open(fileName,'r')
        self.model = loads(fileDesc.read())
        fileDesc.close()
        self.__find_paths__()
        print 'Load '+fileName
    def save(self,fileName):
        fileDesc = open(fileName,'w')
        fileDesc.write(dumps(self.model,indent=4,sort_keys=True))
        fileDesc.close()
        print 'Save '+fileName
    def convert(self,explicit,source,target,amount,update):
        old_amount = amount
        sign = [-1,+1][explicit]
        model = deepcopy(self.model)
        trade = [source,target][::sign]
        path = self.paths[tuple(trade)]
        for first,second in zip(path,path[1:]):
            func,outer,inner = (sell,model[first],model[first][second]) if first in model and second in model[first] else (buy,model[second],model[second][first])
            new_amount = func(outer['supply'],inner['reserve'],inner['ratio'],amount*sign)*sign
            outer['supply' ] += {buy:+new_amount*sign,sell:-amount*sign}[func]
            inner['reserve'] += {buy:+amount*sign,sell:-new_amount*sign}[func]
            amount = new_amount
        if update:
            self.model = model
        print 'Explicit = {:5s}, Update = {:5s}: {} {} = {} {}'.format(str(explicit),str(update),old_amount,trade[0],new_amount,trade[1])
    def __find_paths__(self):
        self.paths = {}
        for outer_key,outer_val in self.model.iteritems():
            for inner_key,inner_val in outer_val.iteritems():
                if type(inner_val) is dict:
                    self.paths[(outer_key,inner_key)] = [outer_key,inner_key]
                    self.paths[(inner_key,outer_key)] = [inner_key,outer_key]
        while True:
            added = False
            for a in self.paths.values():
                for b in self.paths.values():
                    if a[0] != b[-1] and a[-1] == b[0] and (a[0],b[-1]) not in self.paths:
                        self.paths[(a[0],b[-1])] = a+b[1:]
                        added = True
            if not added:
                break
