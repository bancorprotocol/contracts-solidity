from json import loads
from json import dumps
from copy import deepcopy


from decimal import Decimal
from decimal import getcontext
getcontext().prec = 100


def buy (supply,balance,ratio,amount): return int(Decimal(supply)*((1+Decimal(amount)/Decimal(balance))**(Decimal(ratio)/1000000)-1))
def sell(supply,balance,ratio,amount): return int(Decimal(balance)*(1-(1-Decimal(amount)/Decimal(supply))**(1000000/Decimal(ratio))))


class Engine():
    def __init__(self,model):
        self.model = deepcopy(model)
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
    def convert(self,explicit,source,target,amount,update):
        amounts = [amount]
        sign = [-1,+1][explicit]
        model = deepcopy(self.model)
        trade = [source,target][::sign]
        path = self.paths[tuple(trade)]
        for first,second in zip(path,path[1:]):
            func,outer,inner = (sell,model[first],model[first][second]) if first in model and second in model[first] else (buy,model[second],model[second][first])
            amounts += [func(outer['supply'],inner['balance'],inner['ratio'],amounts[-1]*sign)*sign]
            outer['supply' ] += {buy:+amounts[-1]*sign,sell:-amounts[-2]*sign}[func]
            inner['balance'] += {buy:+amounts[-2]*sign,sell:-amounts[-1]*sign}[func]
        if update:
            self.model = model
        print ' = '.join(['{} {}'.format(amount,currency) for amount,currency in zip(amounts[::sign],path[::sign])])
    def save_db(self,fileName):
        fileDesc = open(fileName,'w')
        fileDesc.write(dumps(self.model,indent=4,sort_keys=True))
        fileDesc.close()
        print 'Saved '+fileName
    @classmethod
    def run(cls,databaseFileName,commandsFileName):
        databaseFileDesc = open(databaseFileName)
        commandsFileDesc = open(commandsFileName)
        database = loads(databaseFileDesc.read())
        commands = loads(commandsFileDesc.read())
        databaseFileDesc.close()
        commandsFileDesc.close()
        engine = cls(database)
        for command in commands:
            if command['operation'] == 'convert': engine.convert(command['explicit'],command['source'],command['target'],command['amount'],command['update'])
            if command['operation'] == 'save_db': engine.save_db(command['fileName'])
