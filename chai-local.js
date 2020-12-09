/* eslint-disable import/no-extraneous-dependencies */
const chai = require('chai');
chai.use(require('chai-as-promised'))
    .use(require('chai-bn')(require('bn.js')))
    .use(require('chai-string'))
    .use(require('chai-arrays'))
    .use(require('dirty-chai'))
    .expect();

const Decimal = require('decimal.js');
Decimal.set({ precision: 100, rounding: Decimal.ROUND_DOWN, toExpPos: 40 });

/* eslint-enable import/no-extraneous-dependencies */

module.exports = chai;
