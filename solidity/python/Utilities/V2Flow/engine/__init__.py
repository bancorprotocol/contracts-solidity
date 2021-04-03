import sys, os
sys.path.append(os.path.dirname(__file__)+'/../../../')

import FormulaSolidityPort
import FormulaNativePython

MIN = 0
MAX = 2 ** 256 - 1

PPM_RESOLUTION = 1000000

def add(a, b):
    assert a + b <= MAX, 'error {} + {}'.format(a, b)
    return a + b

def sub(a, b):
    assert a - b >= MIN, 'error {} - {}'.format(a, b)
    return a - b

def mul(a, b):
    assert a * b <= MAX, 'error {} * {}'.format(a, b)
    return a * b

def div(a, b):
    assert b != 0, 'error {} / {}'.format(a, b)
    return a // b

def ratio(x, n, d):
    return x if n == d else div(mul(x, n), d)

class Token():
    def __init__(self, symbol):
        self.symbol = symbol
        self.totalSupply = 0
        self.balanceOf = {}
    def register(self, user):
        self.balanceOf[user] = 0
    def mint(self, user, amount):
        self.totalSupply = add(self.totalSupply, amount)
        self.balanceOf[user] = add(self.balanceOf[user], amount)
    def burn(self, user, amount):
        self.totalSupply = sub(self.totalSupply, amount)
        self.balanceOf[user] = sub(self.balanceOf[user], amount)
    def transfer(self, source, target, amount):
        self.balanceOf[source] = sub(self.balanceOf[source], amount)
        self.balanceOf[target] = add(self.balanceOf[target], amount)
    def serialize(self):
        return {
            'totalSupply': self.totalSupply,
            'balanceOf': self.balanceOf,
        }

class Branch():
    def __init__(self, token):
        self.reserveRate = 0
        self.reserveWeight = 0
        self.reserveStaked = 0
        self.reserveToken = token
        self.poolToken = Token('pool' + token.symbol)
    def addLiquidity(self, pool, user, amount):
        reserveAmount = amount if amount != 'all' else self.reserveToken.balanceOf[user]
        supplyAmount = ratio(reserveAmount, self.poolToken.totalSupply, self.reserveStaked)
        self.reserveToken.transfer(user, pool, reserveAmount)
        self.poolToken.mint(user, supplyAmount)
        self.reserveStaked = add(self.reserveStaked, reserveAmount)
    def remLiquidity(self, pool, user, amount, lo, hi):
        supplyAmount = amount if amount != 'all' else self.poolToken.balanceOf[user]
        reserveAmount = ratio(ratio(supplyAmount, self.reserveStaked, self.poolToken.totalSupply), lo, hi)
        self.poolToken.burn(user, supplyAmount)
        self.reserveToken.transfer(pool, user, reserveAmount)
        self.reserveStaked = sub(self.reserveStaked, reserveAmount)
    def virtualStaked(self, amp):
        return mul(self.reserveStaked, amp)
    def virtualBalance(self, amp, id):
        return add(mul(self.reserveStaked, sub(amp, 1)), self.reserveToken.balanceOf[id])
    def serialize(self):
        return {
            'reserveRate': self.reserveRate,
            'reserveWeight': self.reserveWeight,
            'reserveStaked': self.reserveStaked,
            'reserveToken': self.reserveToken.serialize(),
            'poolToken': self.poolToken.serialize(),
        }

class Pool():
    def __init__(self, id, amp, mainToken, sideToken):
        self.id = id
        self.amp = amp
        self.cFee = 0
        self.dFee = 0
        self.mainSymbol = mainToken.symbol
        self.sideSymbol = sideToken.symbol
        self.branches = {token.symbol: Branch(token) for token in [mainToken, sideToken]} 
    def setFees(self, cFee, dFee):
        self.cFee = cFee
        self.dFee = dFee
    def setRates(self, mainRate, sideRate):
        self.branches[self.mainSymbol].reserveRate = mainRate
        self.branches[self.sideSymbol].reserveRate = sideRate
    def addLiquidity(self, symbol, user, amount):
        self.branches[symbol].addLiquidity(self.id, user, amount)
        self._updateWeights()
    def remLiquidity(self, symbol, user, amount):
        x = self.branches[self.mainSymbol].virtualStaked(self.amp)
        y = self.branches[self.mainSymbol].virtualBalance(self.amp, self.id)
        self.branches[symbol].remLiquidity(self.id, user, amount, *sorted([x, y]))
        self._updateWeights()
    def convert(self, updateWeights, sourceSymbol, targetSymbol, user, amount):
        if updateWeights: self._updateWeights()
        sourceBranch = self.branches[sourceSymbol]
        targetBranch = self.branches[targetSymbol]
        targetAmount = FormulaSolidityPort.crossReserveTargetAmount(
            sourceBranch.virtualBalance(self.amp, self.id),
            sourceBranch.reserveWeight,
            targetBranch.virtualBalance(self.amp, self.id),
            targetBranch.reserveWeight,
            amount
        )
        cAmount = div(mul(targetAmount, self.cFee), PPM_RESOLUTION)
        dAmount = div(mul(targetAmount, self.dFee), PPM_RESOLUTION)
        sourceBranch.reserveToken.transfer(user, self.id, amount)
        targetBranch.reserveToken.transfer(self.id, user, sub(targetAmount, dAmount))
        targetBranch.reserveStaked = add(targetBranch.reserveStaked, cAmount)
    def closeArbitrage(self, user):
        self._updateWeights()
        mainBranch = self.branches[self.mainSymbol]
        sideBranch = self.branches[self.sideSymbol]
        amount = mainBranch.reserveStaked - mainBranch.reserveToken.balanceOf[self.id]
        if amount > 0:
            self.convert(False, self.mainSymbol, self.sideSymbol, user, amount)
        if amount < 0:
            self.convert(False, self.sideSymbol, self.mainSymbol, user, int(-FormulaNativePython.crossReserveTargetAmount(
                mainBranch.virtualBalance(self.amp, self.id),
                mainBranch.reserveWeight,
                sideBranch.virtualBalance(self.amp, self.id),
                sideBranch.reserveWeight,
                amount
            )))
    def _updateWeights(self):
        mainBranch = self.branches[self.mainSymbol]
        sideBranch = self.branches[self.sideSymbol]
        if mainBranch.reserveStaked > 0 or sideBranch.reserveStaked > 0:
            mainWeight, sideWeight = FormulaSolidityPort.balancedWeights(
                mainBranch.virtualStaked(self.amp),
                mainBranch.virtualBalance(self.amp, self.id),
                sideBranch.virtualBalance(self.amp, self.id),
                mainBranch.reserveRate,
                sideBranch.reserveRate
            )
            mainBranch.reserveWeight = mainWeight
            sideBranch.reserveWeight = sideWeight
    def serialize(self):
        return {
            'amp': self.amp,
            'cFee': self.cFee,
            'dFee': self.dFee,
            self.mainSymbol: self.branches[self.mainSymbol].serialize(),
            self.sideSymbol: self.branches[self.sideSymbol].serialize(),
        }

def newPool(amp, mainSymbol, sideSymbol, numOfUsers, initialAmount):
    pool = Pool('pool', amp, Token(mainSymbol), Token(sideSymbol))
    for symbol in [mainSymbol, sideSymbol]:
        pool.branches[symbol].reserveToken.register(pool.id)
        for i in range(numOfUsers):
            userId = 'user{}'.format(i + 1)
            pool.branches[symbol].poolToken.register(userId)
            pool.branches[symbol].reserveToken.register(userId)
            pool.branches[symbol].reserveToken.mint(userId, initialAmount)
    return pool
