const Decimal = require('decimal.js');

Decimal.set({ precision: 100, rounding: Decimal.ROUND_DOWN, toExpPos: 40 });

const floorSqrt = (n) => n.sqrt().floor().toFixed();
const ceilSqrt = (n) => n.sqrt().ceil().toFixed();

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

const accurateRatio = (a, b, scale) => {
    return [a, b].map((x) => x.div(a.add(b)).mul(scale));
};

const roundDiv = (a, b) => a.div(b).toFixed(0, Decimal.ROUND_HALF_UP);

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
    reducedRatio: decimalize(reducedRatio),
    normalizedRatio: decimalize(normalizedRatio),
    accurateRatio: decimalize(accurateRatio),
    roundDiv: decimalize(roundDiv)
};
