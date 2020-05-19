const fs = require('fs');
const truffleContract = require('truffle-contract');
const BancorConverter = artifacts.require('BancorConverter');
const LiquidTokenConverter = artifacts.require('LiquidTokenConverter');
const LiquidityPoolV1Converter = artifacts.require('LiquidityPoolV1Converter');
const utils = require('./Utils');

module.exports.new = async function(type, tokenAddress, registryAddress, maxConversionFee, reserveTokenAddress, weight, version) {
    if (version) {
        const abi = fs.readFileSync(__dirname + `/../bin/bancor_converter_v${version}.abi`);
        const bin = fs.readFileSync(__dirname + `/../bin/bancor_converter_v${version}.bin`);
        const bancorConverter = truffleContract({abi: JSON.parse(abi), unlinked_binary: '0x' + bin});
        const block = await web3.eth.getBlock('latest');
        bancorConverter.setProvider(web3.currentProvider);
        bancorConverter.defaults({from: web3.eth.accounts[0], gas: block.gasLimit});
        return await bancorConverter.new(tokenAddress, registryAddress, maxConversionFee, reserveTokenAddress, weight);
    }
    const converterType = [LiquidTokenConverter, LiquidityPoolV1Converter][type];
    const converter = await converterType.new(tokenAddress, registryAddress, maxConversionFee);
    if (reserveTokenAddress != utils.zeroAddress)
        await converter.addReserve(reserveTokenAddress, weight);
    return converter;
}

module.exports.at = function(address, version) {
    if (version) {
        const abi = fs.readFileSync(__dirname + `/../bin/bancor_converter_v${version}.abi`);
        const bancorConverter = truffleContract({abi: JSON.parse(abi)});
        return bancorConverter.at(address);
    }
    return BancorConverter.at(address);
}
