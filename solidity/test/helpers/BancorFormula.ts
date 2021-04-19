import { ethers } from 'hardhat';
import fs from 'fs';
import path from 'path';

import { ContractFactory } from 'ethers';

const deploy = async () => {
    const accounts = await ethers.getSigners();

    const abi = fs.readFileSync(path.resolve(__dirname, '../bin/BancorFormula.abi'));
    const bin = fs.readFileSync(path.resolve(__dirname, '../bin/BancorFormula.bin'));

    const BancorFormula = new ContractFactory(JSON.parse(abi.toString()), `0x${bin}`, accounts[0]);
    return BancorFormula.deploy();
};

export default {
    deploy
};
