const { expect } = require('chai');
const constants = require('./FormulaConstants');
const Decimal = require('decimal.js');

const ONE = Decimal(1);
const MAX_WEIGHT = Decimal(constants.MAX_WEIGHT);
const W_MIN_SOLVABLE = Decimal(-1).exp().neg();
const W_DEF_SOLUTION = Decimal(-1);

const purchaseTargetAmount = (supply, reserveBalance, reserveWeight, amount) => {
    supply = Decimal(supply.toString());
    reserveBalance = Decimal(reserveBalance.toString());
    reserveWeight = Decimal(reserveWeight.toString());
    amount = Decimal(amount.toString());

    // special case for 0 deposit amount
    if (amount.isZero()) {
        return amount;
    }

    // special case if the weight = 100%
    if (reserveWeight.eq(MAX_WEIGHT)) {
        return supply.mul(amount).div(reserveBalance);
    }

    // return supply * ((1 + amount / reserveBalance) ^ (reserveWeight / MAX_WEIGHT) - 1)
    return supply.mul((ONE.add(amount.div(reserveBalance))).pow(reserveWeight.div(MAX_WEIGHT)).sub(ONE));
};

const saleTargetAmount = (supply, reserveBalance, reserveWeight, amount) => {
    supply = Decimal(supply.toString());
    reserveBalance = Decimal(reserveBalance.toString());
    reserveWeight = Decimal(reserveWeight.toString());
    amount = Decimal(amount.toString());

    // special case for 0 sell amount
    if (amount.isZero()) {
        return amount;
    }

    // special case for selling the entire supply
    if (amount.eq(supply)) {
        return reserveBalance;
    }

    // special case if the weight = 100%
    if (reserveWeight.eq(MAX_WEIGHT)) {
        return reserveBalance.mul(amount).div(supply);
    }

    // return reserveBalance * (1 - (1 - amount / supply) ^ (MAX_WEIGHT / reserveWeight))
    return reserveBalance.mul(ONE.sub(ONE.sub(amount.div(supply)).pow((MAX_WEIGHT.div(reserveWeight)))));
};

const crossReserveTargetAmount = (sourceReserveBalance, sourceReserveWeight, targetReserveBalance, targetReserveWeight, amount) => {
    sourceReserveBalance = Decimal(sourceReserveBalance.toString());
    sourceReserveWeight = Decimal(sourceReserveWeight.toString());
    targetReserveBalance = Decimal(targetReserveBalance.toString());
    targetReserveWeight = Decimal(targetReserveWeight.toString());
    amount = Decimal(amount.toString());

    // special case for equal weights
    if (sourceReserveWeight.eq(targetReserveWeight)) {
        return targetReserveBalance.mul(amount).div(sourceReserveBalance.add(amount));
    }

    // return targetReserveBalance * (1 - (sourceReserveBalance / (sourceReserveBalance + amount)) ^ (sourceReserveWeight / targetReserveWeight))
    return targetReserveBalance.mul(ONE.sub(sourceReserveBalance.div(sourceReserveBalance.add(amount))
        .pow(sourceReserveWeight.div(targetReserveWeight))));
};

const fundCost = (supply, reserveBalance, reserveRatio, amount) => {
    supply = Decimal(supply.toString());
    reserveBalance = Decimal(reserveBalance.toString());
    reserveRatio = Decimal(reserveRatio.toString());
    amount = Decimal(amount.toString());

    // special case for 0 amount
    if (amount.isZero()) {
        return amount;
    }

    // special case if the reserve ratio = 100%
    if (reserveRatio.eq(MAX_WEIGHT)) {
        return (amount.mul(reserveBalance).sub(ONE)).div(supply.add(ONE));
    }

    // return reserveBalance * (((supply + amount) / supply) ^ (MAX_WEIGHT / reserveRatio) - 1)
    return reserveBalance.mul(supply.add(amount).div(supply).pow(MAX_WEIGHT.div(reserveRatio)).sub(ONE));
};

function liquidateReserveAmount (supply, reserveBalance, reserveRatio, amount) {
    supply = Decimal(supply.toString());
    reserveBalance = Decimal(reserveBalance.toString());
    reserveRatio = Decimal(reserveRatio.toString());
    amount = Decimal(amount.toString());

    // special case for 0 amount
    if (amount.isZero()) {
        return amount;
    }

    // special case for liquidating the entire supply
    if (amount.eq(supply)) {
        return reserveBalance;
    }

    // special case if the reserve ratio = 100%
    if (reserveRatio.eq(MAX_WEIGHT)) {
        return amount.mul(reserveBalance).div(supply);
    }

    // return reserveBalance * (1 - ((supply - amount) / supply) ^ (MAX_WEIGHT / reserveRatio))
    return reserveBalance.mul(ONE.sub(supply.sub(amount).div(supply).pow(MAX_WEIGHT.div(reserveRatio))));
}

const balancedWeights = (primaryReserveStakedBalance, primaryReserveBalance, secondaryReserveBalance,
    reserveRateNumerator, reserveRateDenominator) => {
    const t = Decimal(primaryReserveStakedBalance.toString());
    const s = Decimal(primaryReserveBalance.toString());
    const r = Decimal(secondaryReserveBalance.toString());
    const q = Decimal(reserveRateNumerator.toString());
    const p = Decimal(reserveRateDenominator.toString());

    if (t.eq(s)) {
        expect(t.gt(0) || r.gt(0)).to.be.true('ERR_INVALID_RESERVE_BALANCE');
    } else {
        expect(t.gt(0) && s.gt(0) && r.gt(0)).to.be.true('ERR_INVALID_RESERVE_BALANCE');
    }
    expect(q.gt(0) && p.gt(0)).to.be.true('ERR_INVALID_RESERVE_RATE');

    const tq = t.mul(q);
    const rp = r.mul(p);

    if (t.eq(s)) {
        return normalizedWeights(tq, rp);
    }

    const x = s.div(t).ln();
    const y = W(x.mul(tq).div(rp));
    return normalizedWeights(y, x);
};

const normalizedWeights = (a, b) => {
    const prevW1 = Decimal(a.toString());
    const prevW2 = Decimal(b.toString());
    const w1 = prevW1.mul(MAX_WEIGHT).div(prevW1.add(prevW2)).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
    const w2 = MAX_WEIGHT.sub(w1);

    return [w1, w2];
};

const W = (x) => {
    if (x.gte(W_MIN_SOLVABLE)) {
        let a = x;
        for (let n = 0; n < 10; n++) {
            const e = a.exp();
            a = a.mul(a).mul(e).add(x).div(a.mul(e).add(e));
        }
        return a;
    }
    return W_DEF_SOLUTION;
};

module.exports = {
    purchaseTargetAmount,
    saleTargetAmount,
    crossReserveTargetAmount,
    fundCost,
    liquidateReserveAmount,
    normalizedWeights,
    balancedWeights
};
