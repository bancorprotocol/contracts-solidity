import fs from 'fs';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { LedgerSigner } from '@ethersproject/hardware-wallets';

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

    console.log('Deployed !');
};
