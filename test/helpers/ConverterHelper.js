const fs = require('fs');
const path = require('path');
const { ethers } = require('hardhat');

const { ContractFactory } = require('ethers');
const { ZERO_ADDRESS } = require('./Constants');

const Contracts = require('./../../components/Contracts').default;

module.exports.new = async (
    type,
    version,
    tokenAddress,
    registryAddress,
    maxConversionFee,
    reserveTokenAddress = ZERO_ADDRESS,
    weight
) => {
    const accounts = await ethers.getSigners();

    if (version) {
        let contractName = `./bin/converter_v${version}`;
        if (version >= 43) {
            contractName += `_t${type}`;
        }

        const abi = fs.readFileSync(path.resolve(__dirname, `${contractName}.abi`));
        const bin = fs.readFileSync(path.resolve(__dirname, `${contractName}.bin`));

        const Converter = new ContractFactory(JSON.parse(abi), `0x${bin}`, accounts[0]);
        if (version > 28) {
            const converter = await Converter.deploy(tokenAddress, registryAddress, maxConversionFee);
            if (reserveTokenAddress !== ZERO_ADDRESS) {
                await converter.addReserve(reserveTokenAddress, weight);
            }

            return converter;
        }

        return Converter.deploy(tokenAddress, registryAddress, maxConversionFee, reserveTokenAddress, weight);
    }

    let converterType;
    switch (type) {
        case 3:
            converterType = Contracts.StandardPoolConverter;
            break;

        default:
            throw new Error(`Unsupported converter type ${type}`);
    }

    const converter = await converterType.deploy(tokenAddress, registryAddress, maxConversionFee);
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

    return await Contracts.StandardPoolConverter.attach(address);
};
