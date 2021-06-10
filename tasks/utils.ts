import fs from 'fs';
import path from 'path';
import hre from 'hardhat';
import { Contract } from 'contracts';
import { ContractReceipt, ContractTransaction } from '@ethersproject/contracts';

export type deployFct = <C extends Contract>(name: string, toDeployContract: Promise<C>) => Promise<C>;
export type executeFct = (txExecution: Promise<ContractTransaction>) => Promise<ContractReceipt>;

// Basic
export const basicDeploy: deployFct = async <C extends Contract>(
    _: string,
    toDeployContract: Promise<C>
): Promise<C> => {
    const contract = await toDeployContract;
    await contract.deployTransaction.wait();
    return contract;
};
export const basicExecute = async (txExecution: Promise<ContractTransaction>): Promise<ContractReceipt> => {
    return (await txExecution).wait();
};

// Advanced
export const deploy: deployFct = async <C extends Contract>(name: string, toDeployContract: Promise<C>): Promise<C> => {
    const contract = await toDeployContract;
    console.log(`Deploying contract ${name} (${contract.__contractName__})`);
    console.log('Tx: ', contract.deployTransaction.hash);

    console.log('Waiting to be mined ...');
    await contract.deployTransaction.wait();

    console.log(`Deployed at ${contract.address} 🚀 `);
    return contract;
};
export const execute: executeFct = async (txExecution: Promise<ContractTransaction>): Promise<ContractReceipt> => {
    const tx = await txExecution;
    console.log('Executing tx: ', tx.hash);

    const receipt = await (await txExecution).wait();

    if (receipt.status !== 1) {
        throw new Error('Tx failed');
    }

    console.log('Executed ✨');
    return receipt;
};

// File management
export const saveConfig = async (fileName: string, obj: Object) => {
    await fs.promises.writeFile(
        path.join(hre.config.paths.root, './deployments-data/', fileName + '.' + hre.network.name + '.json'),
        JSON.stringify(obj, null, 4)
    );
};
export const loadConfig = async <C>(path: string): Promise<C> => {
    return JSON.parse(fs.readFileSync(path, 'utf8')) as C;
};
