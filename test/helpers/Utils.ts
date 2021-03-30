import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { BigNumber, ContractTransaction } from 'ethers';
import { ethers } from 'hardhat';
import { TestStandardToken } from '../../typechain';
import Constants from './Constants';
import Contracts from './Contracts';
import { Contract } from '@ethersproject/contracts';

// Force the next block to be mine
const advanceBlock = async (): Promise<void> => {
    return await ethers.provider.send('evm_mine', [new Date().getTime()]);
};

// Get the timestamp of the latest block
const latest = async (): Promise<BigNumber> => {
    const block = await ethers.provider.getBlock('latest');
    return BigNumber.from(block.timestamp);
};

// Get balance of a token or eth for an account
const getBalance = async (
    token: TestStandardToken | string,
    account: SignerWithAddress | Contract | string
): Promise<BigNumber> => {
    const accountAddress = typeof account === 'string' ? account : account.address;

    return typeof token === 'string'
        ? token === Constants.NATIVE_TOKEN_ADDRESS
            ? ethers.provider.getBalance(accountAddress)
            : (await Contracts.TestStandardToken.attach(token)).balanceOf(accountAddress)
        : token.balanceOf(accountAddress);
};

const getTransactionCost = async (txResult: ContractTransaction): Promise<BigNumber> => {
    const cumulativeGasUsed = (await txResult.wait()).cumulativeGasUsed;
    return txResult.gasPrice.mul(cumulativeGasUsed);
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
