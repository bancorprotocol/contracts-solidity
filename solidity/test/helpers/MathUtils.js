module.exports = {
    floorSqrt,
    ceilSqrt,
    reducedRatio,
    normalizedRatio,
    accurateRatio,
    roundDiv,
    compareRatios,
    weightedAverageForIntegers,
    weightedAverageForFractions
};

const Decimal = require('decimal.js');

const MAX_UINT256 = Decimal(2).pow(256).sub(1);

function floorSqrt(n) {
    return Decimal(n.toString()).sqrt().floor().toFixed();
}

function ceilSqrt(n) {
    return Decimal(n.toString()).sqrt().ceil().toFixed();
}

function reducedRatio(a, b, max) {
    [a, b, max] = [...arguments].map((x) => Decimal(x));
    if (a.gt(max) || b.gt(max)) {
        [a, b] = normalizedRatio(a, b, max).map((x) => Decimal(x));
    }
    return !a.eq(b) ? [a, b].map((x) => x.toFixed()) : ['1', '1'];
}

function normalizedRatio(a, b, scale) {
    [a, b, scale] = [...arguments].map((x) => Decimal(x));
    if (a.lte(b)) {
        return accurateRatio(a, b, scale);
    }
    return accurateRatio(b, a, scale).slice().reverse();
}

function accurateRatio(a, b, scale) {
    [a, b, scale] = [...arguments].map((x) => Decimal(x));
    const maxVal = MAX_UINT256.divToInt(scale);
    if (a.gt(maxVal)) {
        const c = a.divToInt(maxVal.add(1)).add(1);
        a = a.divToInt(c);
        b = b.divToInt(c);
    }
    if (!a.eq(b)) {
        const x = roundDiv(a.mul(scale), a.add(b));
        const y = scale.sub(x).toFixed();
        return [x, y];
    }
    return [scale.divToInt(2).toFixed(), scale.divToInt(2).toFixed()];
}

function roundDiv(a, b) {
    [a, b] = [...arguments].map((x) => Decimal(x));
    return a.div(b).toFixed(0, Decimal.ROUND_HALF_UP);
}

function compareRatios(a, b, c, d) {
    [a, b, c, d] = [...arguments].map((x) => Decimal(x));
    return a.div(b).cmp(c.div(d));
}

function weightedAverageForIntegers(a, b, p, q) {
    [a, b, p, q] = [...arguments].map((x) => Decimal(x));
    return a.add(b.sub(a).mul(p).div(q)).toFixed();
}

function weightedAverageForFractions(a, b, c, d, p, q) {
    [a, b, c, d, p, q] = [...arguments].map((x) => Decimal(x));
    return a.div(b).add(c.div(d).sub(a.div(b)).mul(p).div(q)).toFixed();
}
