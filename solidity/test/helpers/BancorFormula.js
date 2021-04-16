const fs = require('fs');
const path = require('path');

const { web3 } = require('@openzeppelin/test-environment');

const truffleContract = require('@truffle/contract');

module.exports.new = async () => {
    const abi = fs.readFileSync(path.resolve(__dirname, '../bin/BancorFormula.abi'));
    const bin = fs.readFileSync(path.resolve(__dirname, '../bin/BancorFormula.bin'));
    const BancorFormula = truffleContract({ abi: JSON.parse(abi), unlinked_binary: `0x${bin}` });
    const block = await web3.eth.getBlock('latest');
    BancorFormula.setProvider(web3.currentProvider);
    BancorFormula.defaults({ from: (await web3.eth.getAccounts())[0], gas: block.gasLimit });
    return BancorFormula.new();
};
