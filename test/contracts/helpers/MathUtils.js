const Decimal = require('decimal.js');

Decimal.set({ precision: 155, rounding: Decimal.ROUND_DOWN, toExpPos: 40 });

const floorSqrt = (n) => n.sqrt().floor();

const ceilSqrt = (n) => n.sqrt().ceil();

const productRatio = (an, bn, ad, bd) => [an.mul(bn), ad.mul(bd)];

const reducedRatio = (a, b, max) => {
    if (a.gt(max) || b.gt(max)) {
        return normalizedRatio(a, b, max);
    }

    return [a, b];
};

const normalizedRatio = (a, b, scale) => {
    if (a.lte(b)) {
        return accurateRatio(a, b, scale);
    }

    return accurateRatio(b, a, scale).slice().reverse();
};

const accurateRatio = (a, b, scale) => [a, b].map((x) => x.div(a.add(b)).mul(scale));

const roundDiv = (a, b) => Decimal(a.div(b).toFixed(0, Decimal.ROUND_HALF_UP));

const mulDivF = (a, b, c) => a.mul(b).div(c).floor();

const mulDivC = (a, b, c) => a.mul(b).div(c).ceil();

const decimalize = (func) => {
    return (...args) => {
        const res = func(...args.map((x) => Decimal(x.toString())));
        if (Array.isArray(res)) {
            return res.map((x) => Decimal(x.toString()));
        }

        return Decimal(res.toString());
    };
};

module.exports = {
    Decimal,

    floorSqrt: decimalize(floorSqrt),
    ceilSqrt: decimalize(ceilSqrt),
    productRatio: decimalize(productRatio),
    reducedRatio: decimalize(reducedRatio),
    normalizedRatio: decimalize(normalizedRatio),
    accurateRatio: decimalize(accurateRatio),
    roundDiv: decimalize(roundDiv),
    mulDivF: decimalize(mulDivF),
    mulDivC: decimalize(mulDivC)
};
