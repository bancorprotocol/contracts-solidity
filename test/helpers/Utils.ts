import { BigNumber, ContractTransaction } from 'ethers';
import { ethers } from 'hardhat';
import { TestStandardToken } from '../../typechain';
import Constants from './Constants';

const advanceBlock = async () => {
    return await ethers.provider.send('evm_mine', [new Date().getTime()]);
};

const latest = async () => {
    const block = await ethers.provider.getBlock('latest');
    return BigNumber.from(block.timestamp);
};

const getBalance = async (token: TestStandardToken, address: string, account: string) => {
    if (address === Constants.NATIVE_TOKEN_ADDRESS) {
        return ethers.provider.getBalance(account);
    }

    return token.balanceOf(account);
};

const getTransactionCost = async (txResult: ContractTransaction) => {
    const cumulativeGasUsed = (await txResult.wait()).cumulativeGasUsed;
    return BigNumber.from(txResult.gasPrice).mul(BigNumber.from(cumulativeGasUsed));
};

export default {
    // General
    getBalance,
    getTransactionCost,
    // Time
    advanceBlock,
    latest,
    duration: {
        seconds: function (val: any) {
            return BigNumber.from(val);
        },
        minutes: function (val: any) {
            return BigNumber.from(val).mul(this.seconds('60'));
        },
        hours: function (val: any) {
            return BigNumber.from(val).mul(this.minutes('60'));
        },
        days: function (val: any) {
            return BigNumber.from(val).mul(this.hours('24'));
        },
        weeks: function (val: any) {
            return BigNumber.from(val).mul(this.days('7'));
        },
        years: function (val: any) {
            return BigNumber.from(val).mul(this.days('365'));
        }
    }
};
