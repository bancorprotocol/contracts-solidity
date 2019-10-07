const fs = require('fs');
const truffleContract = require('truffle-contract');
const BancorConverter = artifacts.require('BancorConverter');

module.exports.new = async function(tokenAddress, registryAddress, maxConversionFee, reserveTokenAddress, ratio, version) {
    if (version) {
        const abi = fs.readFileSync(__dirname + `/../bin/bancor_converter_v${version}.abi`);
        const bin = fs.readFileSync(__dirname + `/../bin/bancor_converter_v${version}.bin`);
        const bancorConverter = truffleContract({abi: JSON.parse(abi), unlinked_binary: '0x' + bin});
        const block = await web3.eth.getBlock('latest');
        bancorConverter.setProvider(web3.currentProvider);
        bancorConverter.defaults({from: web3.eth.accounts[0], gas: block.gasLimit});
        return await bancorConverter.new(tokenAddress, registryAddress, maxConversionFee, reserveTokenAddress, ratio);
    }
    return await BancorConverter.new(tokenAddress, registryAddress, maxConversionFee, reserveTokenAddress, ratio);
}

module.exports.at = function(address, version) {
    if (version) {
        const abi = fs.readFileSync(__dirname + `/../bin/bancor_converter_v${version}.abi`);
        const bancorConverter = truffleContract({abi: JSON.parse(abi)});
        return bancorConverter.at(address);
    }
    return BancorConverter.at(address);
}
