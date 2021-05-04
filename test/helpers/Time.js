const { ethers } = require('hardhat');
const { BigNumber } = require('ethers');

const advanceBlock = async () => {
    return await ethers.provider.send('evm_mine');
};

const latest = async () => {
    const block = await ethers.provider.getBlock('latest');
    return BigNumber.from(block.timestamp);
};

module.exports = {
    advanceBlock,
    latest,
    duration: {
        seconds: function (val) {
            return BigNumber.from(val);
        },
        minutes: function (val) {
            return BigNumber.from(val).mul(this.seconds('60'));
        },
        hours: function (val) {
            return BigNumber.from(val).mul(this.minutes('60'));
        },
        days: function (val) {
            return BigNumber.from(val).mul(this.hours('24'));
        },
        weeks: function (val) {
            return BigNumber.from(val).mul(this.days('7'));
        },
        years: function (val) {
            return BigNumber.from(val).mul(this.days('365'));
        }
    }
};
