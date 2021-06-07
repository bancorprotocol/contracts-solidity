import { ethers } from 'hardhat';
import { deployFct, deployment, executeFct } from './deployment';
import { testDeploymentConfig } from './config';
import { Contract, ContractReceipt, ContractTransaction } from '@ethersproject/contracts';

const deploy: deployFct = async <C extends Contract>(toDeployContract: Promise<C>): Promise<C> => {
    const contract = await toDeployContract;
    await contract.deployTransaction.wait();

    console.log(`Deployed (${contract}) at ${contract.address}, tx: ${contract.deployTransaction.hash}`);
    return await toDeployContract;
};

const execute: executeFct = async (txExecution: Promise<ContractTransaction>): Promise<ContractReceipt> => {
    const receipt = await (await txExecution).wait();

    console.log(`Tx: ${receipt.transactionHash}`);
    return receipt;
};

const main = async () => {
    await deployment((await ethers.getSigners())[0], testDeploymentConfig, deploy, execute);
};

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
