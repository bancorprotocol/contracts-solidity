const fs = require('fs');
const path = require('path');

const { ContractFactory } = require('ethers');
const { ZERO_ADDRESS } = require('./Constants');

const LiquidityPoolV1Converter = ethers.getContractFactory('LiquidityPoolV1Converter');
const StandardPoolConverter = ethers.getContractFactory('StandardPoolConverter');
const FixedRatePoolConverter = ethers.getContractFactory('FixedRatePoolConverter');

module.exports.new = async (
    type,
    tokenAddress,
    registryAddress,
    maxConversionFee,
    reserveTokenAddress,
    weight,
    version
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
            if (reserveTokenAddress !== ZERO_ADDRESS) {
                await converter.addReserve(reserveTokenAddress, weight);
            }

            return converter;
        }

        return Converter.deploy(tokenAddress, registryAddress, maxConversionFee, reserveTokenAddress, weight);
    }

    const converterType = {
        1: await LiquidityPoolV1Converter,
        3: await StandardPoolConverter,
        4: await FixedRatePoolConverter
    }[type];
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

    return await ethers.getContractAt('ConverterBase', address);
};
