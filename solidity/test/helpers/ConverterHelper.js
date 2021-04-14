const fs = require('fs');
const path = require('path');

const { contract, web3 } = require('@openzeppelin/test-environment');
const { constants } = require('@openzeppelin/test-helpers');

const truffleContract = require('@truffle/contract');

const { ZERO_ADDRESS } = constants;

const StandardPoolConverter = contract.fromArtifact('StandardPoolConverter');

module.exports.new = async (
    type,
    version,
    tokenAddress,
    registryAddress,
    maxConversionFee,
    reserveTokenAddress = ZERO_ADDRESS,
    weight
) => {
    if (version) {
        let contractName = `../bin/converter_v${version}`;
        if (version >= 43) {
            contractName += `_t${type}`;
        }

        const abi = fs.readFileSync(path.resolve(__dirname, `${contractName}.abi`));
        const bin = fs.readFileSync(path.resolve(__dirname, `${contractName}.bin`));

        const Converter = truffleContract({ abi: JSON.parse(abi), unlinked_binary: `0x${bin}` });
        const block = await web3.eth.getBlock('latest');
        Converter.setProvider(web3.currentProvider);
        Converter.defaults({ from: (await web3.eth.getAccounts())[0], gas: block.gasLimit });

        if (version > 28) {
            const converter = await Converter.new(tokenAddress, registryAddress, maxConversionFee);
            if (reserveTokenAddress !== ZERO_ADDRESS) {
                await converter.addReserve(reserveTokenAddress, weight);
            }

            return converter;
        }

        return Converter.new(tokenAddress, registryAddress, maxConversionFee, reserveTokenAddress, weight);
    }

    let converterType;
    switch (type) {
        case 3:
            converterType = StandardPoolConverter;
            break;

        default:
            throw new Error(`Unsupported converter type ${type}`);
    }

    const converter = await converterType.new(tokenAddress, registryAddress, maxConversionFee);
    if (reserveTokenAddress !== ZERO_ADDRESS) {
        await converter.addReserve(reserveTokenAddress, weight);
    }

    return converter;
};

module.exports.at = async (address, version) => {
    if (version) {
        const abi = fs.readFileSync(path.resolve(__dirname, `../bin/converter_v${version}.abi`));
        const converter = truffleContract({ abi: JSON.parse(abi) });
        return converter.at(address);
    }

    return StandardPoolConverter.at(address);
};
