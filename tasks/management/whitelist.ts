import fs from 'fs';
import DefaultContracts from 'contracts';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { LedgerSigner } from '@ethersproject/hardware-wallets';
import { BancorSystem } from 'types';

export default async (
    args: {
        ledger: boolean;
        configPath: string;
        ledgerPath: string;
        poolAddress: string;
    },
    hre: HardhatRuntimeEnvironment
) => {
    const signer = args.ledger
        ? new LedgerSigner(hre.ethers.provider, 'hid', args.ledgerPath)
        : (await hre.ethers.getSigners())[0];
    const config = JSON.parse(fs.readFileSync(args.configPath, 'utf8')) as BancorSystem;

    const Contract = DefaultContracts.connect(signer);

    const liquidityProtectionSettings = await Contract.LiquidityProtectionSettings.attach(
        config.liquidityProtection.liquidityProtectionSettings
    );

    if (await liquidityProtectionSettings.isPoolWhitelisted(args.poolAddress)) {
        throw new Error('Pool is already whitelisted');
    }

    const tx = await liquidityProtectionSettings.addPoolToWhitelist(args.poolAddress);
    console.log(`Tx: ${tx.hash}`);

    const txReceipt = await tx.wait();
    if (txReceipt.status !== 1) {
        throw new Error('Tx failed');
    }
    console.log(`Pool ${args.poolAddress} whitelisted ✨`);
};
