import { ethers } from 'hardhat';
import fs from 'fs';
import path from 'path';

import { ContractFactory } from 'ethers';
import Constants from './Constants';

import Contracts, { ContractsType } from './Contracts';

export type ConverterType = 1 | 3 | 4;

const deploy = async (
    type: ConverterType,
    tokenAddress: any,
    registryAddress: any,
    maxConversionFee: any,
    reserveTokenAddress: any,
    weight: any,
    version?: any
) => {
    let accounts = await ethers.getSigners();

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

    const converterType: ContractsType = {
        1: 'LiquidityPoolV1Converter' as ContractsType,
        3: 'StandardPoolConverter' as ContractsType,
        4: 'FixedRatePoolConverter' as ContractsType
    }[type];
    const converter = await Contracts[converterType].deploy(tokenAddress, registryAddress, maxConversionFee);
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

    return await ethers.getContractAt('ConverterBase', address);
};

export default {
    deploy,
    at
};
