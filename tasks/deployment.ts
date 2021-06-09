import fs from 'fs';
import { task, types } from 'hardhat/config';
import { LedgerSigner } from '@ethersproject/hardware-wallets';
import { DeploymentConfig } from 'scripts/deployment/types';
import { deploySystem } from 'scripts/deployment/deployment';

task('deploy', 'Deploy')
    .addFlag('ledger', 'Signing from a ledger')
    .addParam('configPath', 'Deployment Configuration file path', '', types.inputFile)
    .addParam('ledgerPath', 'Ledger path', "m/44'/60'/0'/0", types.string)
    .setAction(
        async (
            args: {
                ledger: boolean;
                configPath: string;
                ledgerPath: string;
            },
            hre
        ) => {
            // const signer = args.ledger
            //     ? new LedgerSigner(hre.ethers.provider, 'hid', args.ledgerPath)
            //     : (await hre.ethers.getSigners())[0];
            // const config: DeploymentConfig = JSON.parse(fs.readFileSync(args.configPath, 'utf8')) as DeploymentConfig;
            // const deployedSystem = await deploySystem(signer, config);
            // console.log('Deployed !');
        }
    );
