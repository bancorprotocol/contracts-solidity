import { ethers } from 'hardhat';
import fs from 'fs';
import path from 'path';

import { BigNumber, ContractFactory } from 'ethers';
import Constants from './Constants';

import Contracts from './Contracts';
import { StandardPoolConverter } from '../../../typechain';

export type ConverterType = 1 | 3 | 4;

const deploy = async (
    type: any,
    version: any,
    tokenAddress: any,
    registryAddress: any,
    maxConversionFee: any,
    reserveTokenAddress = Constants.ZERO_ADDRESS,
    weight = BigNumber.from(0)
) => {
    const accounts = await ethers.getSigners();

    if (version) {
        let contractName = `../bin/converter_v${version}`;
        if (version >= 43) {
            contractName += `_t${type}`;
        }

        const abi = fs.readFileSync(path.resolve(__dirname, `${contractName}.abi`));
        const bin = fs.readFileSync(path.resolve(__dirname, `${contractName}.bin`));

        const Converter = new ContractFactory(JSON.parse(abi.toString()), `0x${bin}`, accounts[0]);
        if (version > 28) {
            const converter = await Converter.deploy(tokenAddress, registryAddress, maxConversionFee);
            if (reserveTokenAddress !== Constants.ZERO_ADDRESS) {
                await converter.addReserve(reserveTokenAddress, weight);
            }

            return converter;
        }

        return Converter.deploy(tokenAddress, registryAddress, maxConversionFee, reserveTokenAddress, weight);
    }

    let converter: StandardPoolConverter;
    switch (type) {
        case 3:
            converter = await Contracts.StandardPoolConverter.deploy(tokenAddress, registryAddress, maxConversionFee);
            break;

        default:
            throw new Error(`Unsupported converter type ${type}`);
    }

    if (reserveTokenAddress !== Constants.ZERO_ADDRESS) {
        await converter.addReserve(reserveTokenAddress, weight);
    }

    return converter;
};

const at = async (address: any, version?: any) => {
    if (version) {
        const abi = fs.readFileSync(path.resolve(__dirname, `../bin/converter_v${version}.abi`));
        return await ethers.getContractAt(JSON.parse(abi.toString()), address);
    }

    return await Contracts.StandardPoolConverter.attach(address);
};

export default {
    deploy,
    at
};
