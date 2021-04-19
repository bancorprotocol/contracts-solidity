import { BigNumber } from 'ethers';
import BN from 'bn.js';
import { Decimal } from 'decimal.js';
Decimal.set({ precision: 100, rounding: Decimal.ROUND_DOWN, toExpPos: 40 });

function floorSqrt(n: any) {
    return new Decimal(n).sqrt().floor().toFixed();
}

function ceilSqrt(n: any) {
    return new Decimal(n).sqrt().ceil().toFixed();
}

function poweredRatio(a: any, b: any, exp: any) {
    [a, b, exp] = [...arguments].map((x) => new Decimal(x));
    return [a, b].map((x) => x.pow(exp).toFixed());
}

function reducedRatio(a: any, b: any, max: any) {
    [a, b, max] = [...arguments].map((x) => new Decimal(x));
    if (a.gt(max) || b.gt(max)) {
        return normalizedRatio(a, b, max);
    }
    return [a, b].map((x) => x.toFixed());
}

function normalizedRatio(a: any, b: any, scale: any) {
    [a, b, scale] = [...arguments].map((x) => new Decimal(x));
    if (a.lte(b)) {
        return accurateRatio(a, b, scale);
    }
    return accurateRatio(b, a, scale).slice().reverse();
}

function accurateRatio(a: any, b: any, scale: any) {
    [a, b, scale] = [...arguments].map((x) => new Decimal(x));
    return [a, b].map((x) => x.div(a.add(b)).mul(scale).toFixed());
}

function roundDiv(a: any, b: any) {
    [a, b] = [...arguments].map((x) => new Decimal(x));
    return a.div(b).toFixed(0, Decimal.ROUND_HALF_UP);
}

function compareRatios(a: any, b: any, c: any, d: any) {
    [a, b, c, d] = [...arguments].map((x) => new Decimal(x));
    return a.div(b).cmp(c.div(d));
}

function weightedAverageForIntegers(a: any, b: any, p: any, q: any) {
    [a, b, p, q] = [...arguments].map((x) => new Decimal(x));
    return a.add(b.sub(a).mul(p).div(q)).toFixed();
}

function weightedAverageForFractions(a: any, b: any, c: any, d: any, p: any, q: any) {
    [a, b, c, d, p, q] = [...arguments].map((x) => new Decimal(x));
    return a
        .div(b)
        .add(c.div(d).sub(a.div(b)).mul(p).div(q))
        .toFixed();
}

function divCeil(a: any, b: any) {
    const ans = a.div(b);

    if (ans === 0) {
        return 0;
    }

    return ans < 0 ? ans.sub(1) : ans.add(1);
}

function min(a: any, b: any) {
    a = toBN(a);
    b = toBN(b);
    return toBigNumber(BN.min(a, b));
}

function divRound(a: any, num: any) {
    a = toBN(a);
    num = toBN(num);

    const dm = a.divmod(num);

    // Fast case - exact division
    if (dm.mod.isZero()) return toBigNumber(dm.div);

    const mod = dm.div.negative !== 0 ? dm.mod.isub(num) : dm.mod;

    const half = num.ushrn(1);
    const r2 = num.andln(1);
    const cmp = mod.cmp(half);

    // Round down
    if (cmp < 0 || (r2 === 1 && cmp === 0)) return toBigNumber(dm.div);

    // Round up
    return toBigNumber(dm.div.negative !== 0 ? dm.div.isubn(1) : dm.div.iaddn(1));
}

function toBN(value: any) {
    const hex = BigNumber.from(value).toHexString();
    if (hex[0] === '-') {
        return new BN('-' + hex.substring(3), 16);
    }
    return new BN(hex.substring(2), 16);
}

// Normalize the hex string
function toHex(value: any): any {
    // For BN, call on the hex string
    if (typeof value !== 'string') {
        return toHex(value.toString(16));
    }

    // If negative, prepend the negative sign to the normalized positive value
    if (value[0] === '-') {
        // Strip off the negative sign
        value = value.substring(1);

        // Cannot have mulitple negative signs (e.g. "--0x04")
        if (value[0] === '-') {
            throw 'invalid hex value' + value;
        }

        // Call toHex on the positive component
        value = toHex(value);

        // Do not allow "-0x00"
        if (value === '0x00') {
            return value;
        }

        // Negate the value
        return '-' + value;
    }

    // Add a "0x" prefix if missing
    if (value.substring(0, 2) !== '0x') {
        value = '0x' + value;
    }

    // Normalize zero
    if (value === '0x') {
        return '0x00';
    }

    // Make the string even length
    if (value.length % 2) {
        value = '0x0' + value.substring(2);
    }

    // Trim to smallest even-length string
    while (value.length > 4 && value.substring(0, 4) === '0x00') {
        value = '0x' + value.substring(4);
    }

    return value;
}

function toBigNumber(value: any) {
    return BigNumber.from(toHex(value));
}

export default {
    floorSqrt,
    ceilSqrt,
    poweredRatio,
    reducedRatio,
    normalizedRatio,
    accurateRatio,
    roundDiv,
    compareRatios,
    weightedAverageForIntegers,
    weightedAverageForFractions,
    divCeil,
    divRound,
    min,
    Decimal
};
