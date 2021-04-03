import { expect } from 'chai';
import constants from './FormulaConstants';
import Maths from './MathUtils';

const ONE = new Maths.Decimal(1);
const MAX_WEIGHT = new Maths.Decimal(constants.MAX_WEIGHT);
const W_MIN_SOLVABLE = new Maths.Decimal(-1).exp().neg();
const W_DEF_SOLUTION = new Maths.Decimal(-1);

const purchaseTargetAmount = (supply: any, reserveBalance: any, reserveWeight: any, amount: any) => {
    supply = new Maths.Decimal(supply.toString());
    reserveBalance = new Maths.Decimal(reserveBalance.toString());
    reserveWeight = new Maths.Decimal(reserveWeight.toString());
    amount = new Maths.Decimal(amount.toString());

    // special case for 0 deposit amount
    if (amount.isZero()) {
        return amount;
    }

    // special case if the weight = 100%
    if (reserveWeight.eq(MAX_WEIGHT)) {
        return supply.mul(amount).div(reserveBalance);
    }

    // return supply * ((1 + amount / reserveBalance) ^ (reserveWeight / MAX_WEIGHT) - 1)
    return supply.mul(ONE.add(amount.div(reserveBalance)).pow(reserveWeight.div(MAX_WEIGHT)).sub(ONE));
};

const saleTargetAmount = (supply: any, reserveBalance: any, reserveWeight: any, amount: any) => {
    supply = new Maths.Decimal(supply.toString());
    reserveBalance = new Maths.Decimal(reserveBalance.toString());
    reserveWeight = new Maths.Decimal(reserveWeight.toString());
    amount = new Maths.Decimal(amount.toString());

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
    return reserveBalance.mul(ONE.sub(ONE.sub(amount.div(supply)).pow(MAX_WEIGHT.div(reserveWeight))));
};

const crossReserveTargetAmount = (
    sourceReserveBalance: any,
    sourceReserveWeight: any,
    targetReserveBalance: any,
    targetReserveWeight: any,
    amount: any
) => {
    sourceReserveBalance = new Maths.Decimal(sourceReserveBalance.toString());
    sourceReserveWeight = new Maths.Decimal(sourceReserveWeight.toString());
    targetReserveBalance = new Maths.Decimal(targetReserveBalance.toString());
    targetReserveWeight = new Maths.Decimal(targetReserveWeight.toString());
    amount = new Maths.Decimal(amount.toString());

    // special case for equal weights
    if (sourceReserveWeight.eq(targetReserveWeight)) {
        return targetReserveBalance.mul(amount).div(sourceReserveBalance.add(amount));
    }

    // return targetReserveBalance * (1 - (sourceReserveBalance / (sourceReserveBalance + amount)) ^ (sourceReserveWeight / targetReserveWeight))
    return targetReserveBalance.mul(
        ONE.sub(
            sourceReserveBalance.div(sourceReserveBalance.add(amount)).pow(sourceReserveWeight.div(targetReserveWeight))
        )
    );
};

const fundCost = (supply: any, reserveBalance: any, reserveRatio: any, amount: any) => {
    supply = new Maths.Decimal(supply.toString());
    reserveBalance = new Maths.Decimal(reserveBalance.toString());
    reserveRatio = new Maths.Decimal(reserveRatio.toString());
    amount = new Maths.Decimal(amount.toString());

    // special case for 0 amount
    if (amount.isZero()) {
        return amount;
    }

    // special case if the reserve ratio = 100%
    if (reserveRatio.eq(MAX_WEIGHT)) {
        return amount.mul(reserveBalance).sub(ONE).div(supply.add(ONE));
    }

    // return reserveBalance * (((supply + amount) / supply) ^ (MAX_WEIGHT / reserveRatio) - 1)
    return reserveBalance.mul(supply.add(amount).div(supply).pow(MAX_WEIGHT.div(reserveRatio)).sub(ONE));
};

function liquidateReserveAmount(supply: any, reserveBalance: any, reserveRatio: any, amount: any) {
    supply = new Maths.Decimal(supply.toString());
    reserveBalance = new Maths.Decimal(reserveBalance.toString());
    reserveRatio = new Maths.Decimal(reserveRatio.toString());
    amount = new Maths.Decimal(amount.toString());

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

const balancedWeights = (
    primaryReserveStakedBalance: any,
    primaryReserveBalance: any,
    secondaryReserveBalance: any,
    reserveRateNumerator: any,
    reserveRateDenominator: any
) => {
    const t = new Maths.Decimal(primaryReserveStakedBalance.toString());
    const s = new Maths.Decimal(primaryReserveBalance.toString());
    const r = new Maths.Decimal(secondaryReserveBalance.toString());
    const q = new Maths.Decimal(reserveRateNumerator.toString());
    const p = new Maths.Decimal(reserveRateDenominator.toString());

    if (t.eq(s)) {
        expect(t.gt(0) || r.gt(0)).to.be.equal(true, 'ERR_INVALID_RESERVE_BALANCE');
    } else {
        expect(t.gt(0) && s.gt(0) && r.gt(0)).to.be.equal(true, 'ERR_INVALID_RESERVE_BALANCE');
    }
    expect(q.gt(0) && p.gt(0)).to.be.equal(true, 'ERR_INVALID_RESERVE_RATE');

    const tq = t.mul(q);
    const rp = r.mul(p);

    if (t.eq(s)) {
        return normalizedWeights(tq, rp);
    }

    const x = s.div(t).ln();
    const y = W(x.mul(tq).div(rp));
    return normalizedWeights(y, x);
};

const normalizedWeights = (a: any, b: any) => {
    const prevW1 = new Maths.Decimal(a.toString());
    const prevW2 = new Maths.Decimal(b.toString());
    const w1 = prevW1.mul(MAX_WEIGHT).div(prevW1.add(prevW2)).toDecimalPlaces(0, Maths.Decimal.ROUND_HALF_UP);
    const w2 = MAX_WEIGHT.sub(w1);

    return [w1, w2];
};

const W = (x: any) => {
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

export default {
    purchaseTargetAmount,
    saleTargetAmount,
    crossReserveTargetAmount,
    fundCost,
    liquidateReserveAmount,
    normalizedWeights,
    balancedWeights
};
