const fs = require('fs');
const path = require('path');

const { ContractFactory } = require('ethers');

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
        const abi = fs.readFileSync(path.resolve(__dirname, `../bin/converter_v${version}.abi`));
        const bin = fs.readFileSync(path.resolve(__dirname, `../bin/converter_v${version}.bin`));
        const converter = new ContractFactory(JSON.parse(abi), `0x${bin}`, accounts[0]);

        return await converter.deploy(tokenAddress, registryAddress, maxConversionFee, reserveTokenAddress, weight);
    }

    const converterType = {
        1: await LiquidityPoolV1Converter,
        3: await StandardPoolConverter,
        4: await FixedRatePoolConverter
    }[type];
    const converter = await converterType.deploy(tokenAddress, registryAddress, maxConversionFee);
    if (reserveTokenAddress !== ethers.constants.AddressZero) {
        await converter.addReserve(reserveTokenAddress, weight);
    }

    return converter;
};

module.exports.at = async (address, version) => {
    console.log('2');
    if (version) {
        const abi = fs.readFileSync(path.resolve(__dirname, `../bin/converter_v${version}.abi`));
        return await ethers.getContractAt(JSON.parse(abi), address);
    }

    return await ethers.getContractAt('ConverterBase', address);
};
