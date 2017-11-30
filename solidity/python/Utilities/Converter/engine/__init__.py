from copy import deepcopy
from decimal import Decimal
from decimal import getcontext
getcontext().prec = 100


def factor(fee, sign, direction):
    return ((1000000 - Decimal(fee)) / 1000000) ** ((sign + direction) / 2) * sign


def buy(supply, balance, weight, amount):
    return Decimal(supply) * ((1 + Decimal(amount) / Decimal(balance)) ** (Decimal(weight) / 1000000) - 1)


def sell(supply, balance, weight, amount):
    return Decimal(balance) * (1 - (1 - Decimal(amount) / Decimal(supply)) ** (1000000 / Decimal(weight)))


class Engine():
    def __init__(self):
        self.model = {}
        self.paths = {}

    def set(self, model):
        self.model = cast(deepcopy(model), Decimal)
        self.paths = {}
        for outer_key, outer_val in self.model.iteritems():
            for inner_key, inner_val in outer_val.iteritems():
                if type(inner_val) is dict:
                    self.paths[(outer_key, inner_key)] = [outer_key, inner_key]
                    self.paths[(inner_key, outer_key)] = [inner_key, outer_key]
        while True:
            added = False
            for a in self.paths.values():
                for b in self.paths.values():
                    if a[0] != b[-1] and a[-1] == b[0] and (a[0], b[-1]) not in self.paths:
                        self.paths[(a[0], b[-1])] = a + b[1:]
                        added = True
            if not added:
                break

    def get(self):
        return cast(deepcopy(self.model), str)

    def convert(self, sign, source, target, amount, update):
        entries = []
        amounts = [Decimal(amount)]
        model = deepcopy(self.model)
        trade = [source, target][::sign]
        path = self.paths[tuple(trade)]
        for first, second in zip(path, path[1:]):
            func, outer, inner = (sell, model[first], model[first][second]) if first in model and second in model[first] else (buy, model[second], model[second][first])
            entries += [{'currency': first, 'fee': outer['fee'], 'supply': outer['supply'], 'balance': inner['balance'], 'weight': inner['weight'], 'amount': amounts[-1]}]
            amounts += [func(outer['supply'], inner['balance'], inner['weight'], amounts[-1] * factor(outer['fee'], sign, -1)) * factor(outer['fee'], sign, +1)]
            outer['supply'] += {buy: +amounts[-1] * sign, sell: -amounts[-2] * sign}[func]
            inner['balance'] += {buy: +amounts[-2] * sign, sell: -amounts[-1] * sign}[func]
        entries += [{'currency': second, 'supply': outer['supply'], 'balance': inner['balance'], 'weight': inner['weight'], 'amount': amounts[-1]}]
        if update:
            self.model = model
        return entries[::sign]


def cast(model, cls):
    for key, val in model.iteritems():
        if type(val) is dict:
            model[key] = cast(val, cls)
        elif key in ['supply', 'balance']:
            model[key] = cls(val)
    return model
