import DefaultContracts from 'contracts';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { LedgerSigner } from '@ethersproject/hardware-wallets';
import { BancorSystem } from 'types';
import { execute, loadConfig } from 'tasks/utils';

export default async (
    args: {
        ledger: boolean;
        configPath: string;
        ledgerPath: string;
        contractName: string;
        contractNameRegistry: string;
    },
    hre: HardhatRuntimeEnvironment
) => {
    const signer = args.ledger
        ? new LedgerSigner(hre.ethers.provider, 'hid', args.ledgerPath)
        : (await hre.ethers.getSigners())[0];
    const config = await loadConfig<BancorSystem>(args.configPath);

    // TODO
};
