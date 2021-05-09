const fs = require('fs');
const { ethers } = require('hardhat');
const path = require('path');

const { ContractFactory } = require('ethers');

module.exports.new = async () => {
    const accounts = await ethers.getSigners();

    const abi = fs.readFileSync(path.resolve(__dirname, './bin/BancorFormula.abi'));
    const bin = fs.readFileSync(path.resolve(__dirname, './bin/BancorFormula.bin'));

    const BancorFormula = new ContractFactory(JSON.parse(abi), `0x${bin}`, accounts[0]);
    return BancorFormula.deploy();
};
