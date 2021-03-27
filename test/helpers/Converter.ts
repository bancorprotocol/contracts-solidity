import fs from 'fs';
import path from 'path';

import { ContractFactory } from 'ethers';
import Constants from './Constants';

import Contracts from './Contracts';

module.exports.new = async (
    type: any,
    tokenAddress: any,
    registryAddress: any,
    maxConversionFee: any,
    reserveTokenAddress: any,
    weight: any,
    version: any
) => {
    accounts = await ethers.getSigners();

    if (version) {
        let contractName = `../bin/converter_v${version}`;
        if (version >= 43) {
            contractName += `_t${type}`;
        }

        const abi = fs.readFileSync(path.resolve(__dirname, `${contractName}.abi`));
        const bin = fs.readFileSync(path.resolve(__dirname, `${contractName}.bin`));

        const Converter = new ContractFactory(JSON.parse(abi), `0x${bin}`, accounts[0]);
        if (version > 28) {
            const converter = await Converter.deploy(tokenAddress, registryAddress, maxConversionFee);
            if (reserveTokenAddress !== Constants.ZERO_ADDRESS) {
                await converter.addReserve(reserveTokenAddress, weight);
            }

            return converter;
        }

        return Converter.deploy(tokenAddress, registryAddress, maxConversionFee, reserveTokenAddress, weight);
    }

    const converterType = {
        1: 'LiquidityPoolV1Converter',
        3: 'StandardPoolConverter',
        4: 'FixedRatePoolConverter'
    }[type];
    const converter = await Contracts[converterType].deploy(tokenAddress, registryAddress, maxConversionFee);
    if (reserveTokenAddress !== ZERO_ADDRESS) {
        await converter.addReserve(reserveTokenAddress, weight);
    }

    return converter;
};

module.exports.at = async (address, version) => {
    if (version) {
        const abi = fs.readFileSync(path.resolve(__dirname, `../bin/converter_v${version}.abi`));
        return await ethers.getContractAt(JSON.parse(abi), address);
    }

    return await ethers.getContractAt('ConverterBase', address);
};
