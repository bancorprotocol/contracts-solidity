import DefaultContracts from 'contracts';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { LedgerSigner } from '@ethersproject/hardware-wallets';
import { BancorSystem } from 'types';
import { advancedExecute, loadConfig } from 'tasks/utils';
import { Signer } from '@ethersproject/abstract-signer';
import { BigNumberish } from '@ethersproject/bignumber';
import { BigNumber } from 'ethers';

export const whitelistPool = async (
    signer: Signer,
    config: BancorSystem,
    overrides: { gasPrice?: BigNumberish },
    poolAddress: string,
    execute = advancedExecute
) => {
    const Contracts = DefaultContracts.connect(signer);

    const liquidityProtectionSettings = await Contracts.LiquidityProtectionSettings.attach(
        config.liquidityProtection.liquidityProtectionSettings,
        signer
    );

    if (await liquidityProtectionSettings.isPoolWhitelisted(poolAddress)) {
        throw new Error('Pool is already whitelisted');
    }
    await execute(liquidityProtectionSettings.addPoolToWhitelist(poolAddress, overrides));
};

export default async (
    args: {
        ledger: boolean;
        gasPrice: number;
        configPath: string;
        ledgerPath: string;
        poolAddress: string;
    },
    hre: HardhatRuntimeEnvironment
) => {
    const signer = args.ledger
        ? new LedgerSigner(hre.ethers.provider, 'hid', args.ledgerPath)
        : (await hre.ethers.getSigners())[0];
    const gasPrice = args.gasPrice === 0 ? undefined : BigNumber.from(args.gasPrice);
    const config = await loadConfig<BancorSystem>(args.configPath);

    await whitelistPool(signer, config, { gasPrice }, args.poolAddress);
    console.log(`Pool ${args.poolAddress} whitelisted ✨`);
};
