from copy import deepcopy
from decimal import Decimal
from decimal import getcontext
getcontext().prec = 100


def factor(fee, sign, direction, times):
    return ((1000000 - Decimal(fee)) ** times / 1000000 ** times) ** ((sign + direction) // 2) * sign


def buy(supply, balance, ratio, amount):
    return Decimal(supply) * ((1 + Decimal(amount) / Decimal(balance)) ** (Decimal(ratio) / 1000000) - 1)


def sell(supply, balance, ratio, amount):
    return Decimal(balance) * (1 - (1 - Decimal(amount) / Decimal(supply)) ** (1000000 / Decimal(ratio)))


def both(balance1, ratio1, balance2, ratio2, amount):
    return Decimal(balance2) * (1 - (Decimal(balance1) / (Decimal(balance1) + Decimal(amount))) ** (Decimal(ratio1) / Decimal(ratio2)))


class Engine():
    def __init__(self):
        self.model = {}
        self.paths = {}

    def set(self, model):
        self.model = cast(deepcopy(model), Decimal)
        self.paths = {}
        for outer_key, outer_val in self.model.items():
            for inner_key, inner_val in outer_val.items():
                if type(inner_val) is dict:
                    self.paths[(outer_key, inner_key)] = [outer_key, inner_key]
                    self.paths[(inner_key, outer_key)] = [inner_key, outer_key]
        while True:
            paths = {}
            for a in self.paths.values():
                for b in self.paths.values():
                    if a[0] != b[-1] and a[-1] == b[0] and (a[0], b[-1]) not in self.paths:
                        paths[(a[0], b[-1])] = a + b[1:]
            if paths:
                self.paths = {**self.paths, **paths}
            else:
                break

    def get(self):
        return cast(deepcopy(self.model), str)

    def convert(self, sign, source, target, amount, update):
        entries = []
        amounts = [Decimal(amount)]
        model = deepcopy(self.model)
        trade = [source, target][::sign]
        path = self.paths[tuple(trade)]
        n = 0
        while n < len(path) - 1:
            if n < len(path) - 2 and path[n + 0] in model[path[n + 1]] and path[n + 2] in model[path[n + 1]]:
                first = path[n + 0]
                second = path[n + 2]
                reserve = model[path[n + 1]]
                outer, inner = (reserve, reserve[second])
                side1, side2 = (reserve[first], reserve[second])
                entries += [{'currency': first, 'fee': outer['fee'], 'supply': outer['supply'], 'balance': side1['balance'], 'ratio': side1['ratio'], 'amount': amounts[-1]}]
                amounts += [both(side1['balance'], side1['ratio'], side2['balance'], side2['ratio'], amounts[-1] * factor(outer['fee'], sign, -1, 2)) * factor(outer['fee'], sign, +1, 2)]
                side1['balance'] += amounts[-2] * sign
                side2['balance'] -= amounts[-1] * sign
                n += 2
            else:
                first = path[n + 0]
                second = path[n + 1]
                func, outer, inner = (sell, model[first], model[first][second]) if first in model and second in model[first] else (buy, model[second], model[second][first])
                entries += [{'currency': first, 'fee': outer['fee'], 'supply': outer['supply'], 'balance': inner['balance'], 'ratio': inner['ratio'], 'amount': amounts[-1]}]
                amounts += [func(outer['supply'], inner['balance'], inner['ratio'], amounts[-1] * factor(outer['fee'], sign, -1, 1)) * factor(outer['fee'], sign, +1, 1)]
                outer['supply'] += {buy: +amounts[-1] * sign, sell: -amounts[-2] * sign}[func]
                inner['balance'] += {buy: +amounts[-2] * sign, sell: -amounts[-1] * sign}[func]
                n += 1
        entries += [{'currency': second, 'supply': outer['supply'], 'balance': inner['balance'], 'ratio': inner['ratio'], 'amount': amounts[-1]}]
        if update:
            self.model = model
        return entries[::sign]


def cast(model, cls):
    for key, val in model.items():
        if type(val) is dict:
            model[key] = cast(val, cls)
        elif key in ['supply', 'balance']:
            model[key] = cls(val)
    return model
