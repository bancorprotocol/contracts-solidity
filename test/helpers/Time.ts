import { ethers } from 'hardhat';
import { BigNumber } from 'ethers';

export const advanceBlock = async () => {
    return await ethers.provider.send('evm_mine', []);
};

export const latest = async () => {
    const block = await ethers.provider.getBlock('latest');
    return BigNumber.from(block.timestamp);
};

export const duration = {
    seconds: function (val: string) {
        return BigNumber.from(val);
    },
    minutes: function (val: string) {
        return BigNumber.from(val).mul(this.seconds('60'));
    },
    hours: function (val: string) {
        return BigNumber.from(val).mul(this.minutes('60'));
    },
    days: function (val: string) {
        return BigNumber.from(val).mul(this.hours('24'));
    },
    weeks: function (val: string) {
        return BigNumber.from(val).mul(this.days('7'));
    },
    years: function (val: string) {
        return BigNumber.from(val).mul(this.days('365'));
    }
};
