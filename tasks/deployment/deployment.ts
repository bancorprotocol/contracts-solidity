import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { LedgerSigner } from '@ethersproject/hardware-wallets';
import { loadConfig, saveConfig, advancedDeploy, advancedExecute } from '../utils';
import { ethers } from 'hardhat';
import DefaultContracts from 'contracts';
import { DeploymentConfig, BancorSystem } from 'types';
import { Signer } from '@ethersproject/abstract-signer';
import { BigNumberish } from '@ethersproject/bignumber';

const {
    BigNumber,
    utils: { id, formatBytes32String }
} = ethers;

const MAX_CONVERSION_FEE = 1_000_000;
const STANDARD_POOL_CONVERTER_WEIGHTS = [500_000, 500_000];

const toWei = (value: number, decimals: number) => BigNumber.from(value).mul(BigNumber.from(10).pow(decimals));
const percentageToPPM = (value: string) => (Number(value.replace('%', '')) * 1_000_000) / 100;

export const deploySystem = async (
    signer: Signer,
    config: DeploymentConfig,
    overrides: { gasPrice?: BigNumberish },
    deploy = advancedDeploy,
    execute = advancedExecute
): Promise<BancorSystem> => {
    const ROLE_OWNER = id('ROLE_OWNER');
    const ROLE_GOVERNOR = id('ROLE_GOVERNOR');
    const ROLE_MINTER = id('ROLE_MINTER');
    const ROLE_PUBLISHER = id('ROLE_PUBLISHER');

    const Contracts = DefaultContracts.connect(signer);

    // main contracts
    const contractRegistry = await deploy('contractRegistry', Contracts.ContractRegistry.deploy(overrides));
    const converterFactory = await deploy('converterFactory', Contracts.ConverterFactory.deploy(overrides));
    const bancorNetwork = await deploy(
        'bancorNetwork',
        Contracts.BancorNetwork.deploy(contractRegistry.address, overrides)
    );
    const conversionPathFinder = await deploy(
        'conversionPathFinder',
        Contracts.ConversionPathFinder.deploy(contractRegistry.address, overrides)
    );
    const converterUpgrader = await deploy(
        'converterUpgrader',
        Contracts.ConverterUpgrader.deploy(contractRegistry.address, overrides)
    );
    const converterRegistry = await deploy(
        'converterRegistry',
        Contracts.ConverterRegistry.deploy(contractRegistry.address, overrides)
    );
    const converterRegistryData = await deploy(
        'converterRegistryData',
        Contracts.ConverterRegistryData.deploy(contractRegistry.address, overrides)
    );

    const networkFeeWallet = await deploy('networkFeeWallet', Contracts.TokenHolder.deploy(overrides));
    const networkSettings = await deploy(
        'networkSettings',
        Contracts.NetworkSettings.deploy(networkFeeWallet.address, 0, overrides)
    );

    const standardPoolConverterFactory = await deploy(
        'standardPoolConverterFactory',
        Contracts.StandardPoolConverterFactory.deploy(overrides)
    );

    // initialize contract registry
    await execute(
        contractRegistry.registerAddress(formatBytes32String('ContractRegistry'), contractRegistry.address, overrides)
    );
    await execute(
        contractRegistry.registerAddress(formatBytes32String('ConverterFactory'), converterFactory.address, overrides)
    );
    await execute(
        contractRegistry.registerAddress(formatBytes32String('BancorNetwork'), bancorNetwork.address, overrides)
    );
    await execute(
        contractRegistry.registerAddress(formatBytes32String('NetworkSettings'), networkSettings.address, overrides)
    );

    await execute(
        contractRegistry.registerAddress(
            formatBytes32String('ConversionPathFinder'),
            conversionPathFinder.address,
            overrides
        )
    );
    await execute(
        contractRegistry.registerAddress(
            formatBytes32String('BancorConverterUpgrader'),
            converterUpgrader.address,
            overrides
        )
    );
    await execute(
        contractRegistry.registerAddress(
            formatBytes32String('BancorConverterRegistry'),
            converterRegistry.address,
            overrides
        )
    );
    await execute(
        contractRegistry.registerAddress(
            formatBytes32String('BancorConverterRegistryData'),
            converterRegistryData.address,
            overrides
        )
    );
    await execute(converterFactory.registerTypedConverterFactory(standardPoolConverterFactory.address, overrides));

    // initialize network tokens
    const bntToken = await deploy(
        'bntToken',
        Contracts.DSToken.deploy(
            config.networkToken.symbol + ' Token',
            config.networkToken.symbol,
            config.networkToken.decimals,
            overrides
        )
    );
    const vbntToken = await deploy(
        'vbntToken',
        Contracts.DSToken.deploy(
            config.networkGovToken.symbol + ' Token',
            config.networkGovToken.symbol,
            config.networkGovToken.decimals,
            overrides
        )
    );

    // give some BNT for adding dual liquidity
    await execute(
        bntToken.issue(
            await signer.getAddress(),
            toWei(config.networkToken.supply, config.networkToken.decimals),
            overrides
        )
    );

    const liquidityProtectionSettings = await deploy(
        'liquidityProtectionSettings',
        Contracts.LiquidityProtectionSettings.deploy(bntToken.address, contractRegistry.address, overrides)
    );

    const reserves: { [symbol: string]: { address: string; decimals: number } } = {};
    // Adding BNT and vBNT
    reserves[config.networkToken.symbol] = { address: bntToken.address, decimals: await bntToken.decimals() };
    reserves[config.networkGovToken.symbol] = { address: vbntToken.address, decimals: await vbntToken.decimals() };

    // Adding ETH token
    reserves[config.chainToken.symbol] = {
        address: config.chainToken.address,
        decimals: config.chainToken.decimals
    };

    for (const reserve of config.reserves) {
        if (reserve.__typename === 'toDeploy') {
            const { symbol, decimals } = reserve;
            const name = symbol + 'Token';
            const supply = toWei(reserve.supply, decimals);
            const token = await deploy(symbol, Contracts.TestStandardToken.deploy(name, symbol, supply, overrides));
            reserves[symbol] = {
                address: token.address,
                decimals: await token.decimals()
            };
        } else if (reserve.__typename === 'deployed') {
            const token = await Contracts.ERC20.attach(reserve.address, signer);
            const symbol = await token.symbol();
            reserves[symbol] = {
                address: token.address,
                decimals: await token.decimals()
            };
        }
    }

    const converters: { [symbol: string]: { address: string; symbol: string } } = {};
    var index = 0;
    for (const converter of config.converters) {
        const { symbol, decimals, fee } = converter;
        const name = converter.symbol + ' Liquidity Pool';
        const tokens = converter.reserves.map((reserve) => reserves[reserve.symbol].address);
        const amounts = converter.reserves.map((reserve) => toWei(reserve.balance, reserves[reserve.symbol].decimals));
        const value = amounts[converter.reserves.findIndex((reserve) => reserve.symbol === 'ETH')];

        await execute(
            converterRegistry.newConverter(
                3,
                name,
                symbol,
                decimals,
                MAX_CONVERSION_FEE,
                tokens,
                STANDARD_POOL_CONVERTER_WEIGHTS,
                overrides
            )
        );

        const converterAnchor = await Contracts.IConverterAnchor.attach(
            await converterRegistry.getAnchor(index),
            signer
        );

        const standardConverter = await Contracts.StandardPoolConverter.attach(await converterAnchor.owner(), signer);
        converters[converter.symbol] = { symbol: converter.symbol, address: standardConverter.address };
        await execute(standardConverter.acceptOwnership(overrides));
        await execute(standardConverter.setConversionFee(percentageToPPM(fee), overrides));

        if (amounts.every((amount) => amount.gt(0))) {
            for (let i = 0; i < converter.reserves.length; i++) {
                const reserve = converter.reserves[i];
                if (reserve.symbol !== config.chainToken.symbol) {
                    const deployedToken = await Contracts.ERC20.attach(tokens[i], signer);
                    await execute(deployedToken.approve(standardConverter.address, amounts[i], overrides));
                }
            }

            const deployedConverter = await Contracts.StandardPoolConverter.attach(standardConverter.address, signer);
            await execute(deployedConverter.addLiquidity(tokens, amounts, 1, { value, gasPrice: overrides.gasPrice }));
        }

        if (converter.protected) {
            await execute(liquidityProtectionSettings.addPoolToWhitelist(standardConverter.address, overrides));
        }

        index++;
    }

    await execute(contractRegistry.registerAddress(formatBytes32String('BNTToken'), bntToken.address, overrides));
    await execute(conversionPathFinder.setAnchorToken(bntToken.address, overrides));

    const bntTokenGovernance = await deploy(
        'bntTokenGovernance',
        Contracts.TokenGovernance.deploy(bntToken.address, overrides)
    );
    const vbntTokenGovernance = await deploy(
        'vbntTokenGovernance',
        Contracts.TokenGovernance.deploy(vbntToken.address, overrides)
    );

    await execute(bntTokenGovernance.grantRole(ROLE_GOVERNOR, await signer.getAddress(), overrides));
    await execute(vbntTokenGovernance.grantRole(ROLE_GOVERNOR, await signer.getAddress(), overrides));

    await execute(bntToken.transferOwnership(bntTokenGovernance.address, overrides));
    await execute(bntTokenGovernance.acceptTokenOwnership(overrides));

    const checkpointStore = await deploy('checkpointStore', Contracts.CheckpointStore.deploy(overrides));

    const stakingRewardsStore = await deploy('stakingRewardsStore', Contracts.StakingRewardsStore.deploy(overrides));
    const stakingRewards = await deploy(
        'stakingRewards',
        Contracts.StakingRewards.deploy(
            stakingRewardsStore.address,
            bntTokenGovernance.address,
            checkpointStore.address,
            contractRegistry.address,
            overrides
        )
    );

    const liquidityProtectionStore = await deploy(
        'liquidityProtectionStore',
        Contracts.LiquidityProtectionStore.deploy(overrides)
    );
    const liquidityProtectionStats = await deploy(
        'liquidityProtectionStats',
        Contracts.LiquidityProtectionStats.deploy(overrides)
    );
    const liquidityProtectionSystemStore = await deploy(
        'liquidityProtectionSystemStore',
        Contracts.LiquidityProtectionSystemStore.deploy(overrides)
    );
    const liquidityProtectionWallet = await deploy(
        'liquidityProtectionWallet',
        Contracts.TokenHolder.deploy(overrides)
    );

    const liquidityProtection = await deploy(
        'liquidityProtection',
        Contracts.LiquidityProtection.deploy(
            liquidityProtectionSettings.address,
            liquidityProtectionStore.address,
            liquidityProtectionStats.address,
            liquidityProtectionSystemStore.address,
            liquidityProtectionWallet.address,
            bntTokenGovernance.address,
            vbntTokenGovernance.address,
            checkpointStore.address,
            overrides
        )
    );

    await execute(checkpointStore.grantRole(ROLE_OWNER, liquidityProtection.address, overrides));

    await execute(stakingRewardsStore.grantRole(ROLE_OWNER, stakingRewards.address, overrides));
    await execute(stakingRewards.grantRole(ROLE_PUBLISHER, liquidityProtection.address, overrides));
    await execute(bntTokenGovernance.grantRole(ROLE_MINTER, stakingRewards.address, overrides));
    await execute(liquidityProtectionSettings.addSubscriber(stakingRewards.address, overrides));

    // granting the LP contract both of the MINTER roles requires the deployer to have the GOVERNOR role
    await execute(bntTokenGovernance.grantRole(ROLE_MINTER, liquidityProtection.address, overrides));
    await execute(vbntTokenGovernance.grantRole(ROLE_MINTER, liquidityProtection.address, overrides));

    await execute(liquidityProtectionStats.grantRole(ROLE_OWNER, liquidityProtection.address, overrides));
    await execute(liquidityProtectionSystemStore.grantRole(ROLE_OWNER, liquidityProtection.address, overrides));

    await execute(
        contractRegistry.registerAddress(
            formatBytes32String('LiquidityProtection'),
            liquidityProtection.address,
            overrides
        )
    );

    await execute(liquidityProtectionStore.transferOwnership(liquidityProtection.address, overrides));
    await execute(liquidityProtection.acceptStoreOwnership(overrides));

    await execute(liquidityProtectionWallet.transferOwnership(liquidityProtection.address, overrides));
    await execute(liquidityProtection.acceptWalletOwnership(overrides));

    const params = config.liquidityProtectionParams;

    const minNetworkTokenLiquidityForMinting = toWei(
        params.minNetworkTokenLiquidityForMinting,
        config.networkToken.decimals
    );
    await execute(
        liquidityProtectionSettings.setMinNetworkTokenLiquidityForMinting(minNetworkTokenLiquidityForMinting, overrides)
    );

    const defaultNetworkTokenMintingLimit = toWei(params.defaultNetworkTokenMintingLimit, config.networkToken.decimals);
    await execute(
        liquidityProtectionSettings.setDefaultNetworkTokenMintingLimit(defaultNetworkTokenMintingLimit, overrides)
    );

    await execute(
        liquidityProtectionSettings.setProtectionDelays(params.minProtectionDelay, params.maxProtectionDelay, overrides)
    );
    await execute(liquidityProtectionSettings.setLockDuration(params.lockDuration));

    const vortexBurner = await deploy(
        'vortexBurner',
        Contracts.VortexBurner.deploy(
            bntToken.address,
            vbntTokenGovernance.address,
            contractRegistry.address,
            overrides
        )
    );

    await execute(networkFeeWallet.transferOwnership(vortexBurner.address, overrides));
    await execute(vortexBurner.acceptNetworkFeeOwnership(overrides));

    return {
        system: {
            bntToken: bntToken.address,
            vbntToken: vbntToken.address,

            bancorNetwork: bancorNetwork.address,
            contractRegistry: contractRegistry.address,
            networkFeeWallet: networkFeeWallet.address,
            networkSettings: networkSettings.address,
            conversionPathFinder: conversionPathFinder.address,
            vortexBurner: vortexBurner.address
        },
        converter: {
            converterFactory: converterFactory.address,
            converterUpgrader: converterUpgrader.address,
            converterRegistry: converterRegistry.address,
            converterRegistryData: converterRegistryData.address,
            standardPoolConverterFactory: standardPoolConverterFactory.address
        },

        governance: {
            bntTokenGovernance: bntTokenGovernance.address,
            vbntTokenGovernance: vbntTokenGovernance.address
        },
        liquidityProtection: {
            liquidityProtectionSettings: liquidityProtectionSettings.address,
            liquidityProtectionStore: liquidityProtectionStore.address,
            liquidityProtectionStats: liquidityProtectionStats.address,
            liquidityProtectionSystemStore: liquidityProtectionSystemStore.address,
            liquidityProtectionWallet: liquidityProtectionWallet.address,
            liquidityProtection: liquidityProtection.address,
            checkpointStore: checkpointStore.address
        },
        stakingRewards: {
            stakingRewardsStore: stakingRewardsStore.address,
            stakingRewards: stakingRewards.address
        }
    };
};

export default async (
    args: {
        ledger: boolean;
        gasPrice: number;
        configPath: string;
        ledgerPath: string;
    },
    hre: HardhatRuntimeEnvironment
) => {
    const signer = args.ledger
        ? new LedgerSigner(hre.ethers.provider, 'hid', args.ledgerPath)
        : (await hre.ethers.getSigners())[0];
    const gasPrice = args.gasPrice === 0 ? undefined : BigNumber.from(args.gasPrice);
    const config = await loadConfig<DeploymentConfig>(args.configPath);

    const deployedSystem = await deploySystem(signer, config, { gasPrice });
    await saveConfig('bancorSystem', deployedSystem);

    console.log('System Deployed !');
};
