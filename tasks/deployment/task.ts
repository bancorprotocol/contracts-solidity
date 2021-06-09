import fs from 'fs';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { LedgerSigner } from '@ethersproject/hardware-wallets';
import { DeploymentConfig } from './types';
import { deployFct, deploySystem, executeFct } from 'tasks/deployment/deployment';
import { ContractReceipt, ContractTransaction } from '@ethersproject/contracts';
import { Contract } from 'contracts';

const deploy: deployFct = async <C extends Contract>(name: string, toDeployContract: Promise<C>): Promise<C> => {
    const contract = await toDeployContract;
    await contract.deployTransaction.wait();

    console.log(
        `Deployed (${name} as ${contract.__contractName__}) at ${contract.address}, tx: ${contract.deployTransaction.hash}`
    );
    return await toDeployContract;
};

const execute: executeFct = async (txExecution: Promise<ContractTransaction>): Promise<ContractReceipt> => {
    const receipt = await (await txExecution).wait();

    console.log(`Tx: ${receipt.transactionHash}`);
    return receipt;
};

export default async (
    args: {
        ledger: boolean;
        configPath: string;
        ledgerPath: string;
    },
    hre: HardhatRuntimeEnvironment
) => {
    const signer = args.ledger
        ? new LedgerSigner(hre.ethers.provider, 'hid', args.ledgerPath)
        : (await hre.ethers.getSigners())[0];

    const config = JSON.parse(fs.readFileSync(args.configPath, 'utf8')) as DeploymentConfig;
    const deployedSystem = await deploySystem(signer, config, deploy, execute);
    console.log('Deployed !');
};
