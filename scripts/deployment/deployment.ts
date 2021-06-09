import { ethers } from 'hardhat';
import Contracts from 'contracts';
import { DeploymentConfig, BancorSystem } from './types';
import { Signer } from '@ethersproject/abstract-signer';
import { Contract, ContractReceipt, ContractTransaction } from '@ethersproject/contracts';

const {
    BigNumber,
    utils: { id, formatBytes32String }
} = ethers;

const MAX_CONVERSION_FEE = 1_000_000;
const STANDARD_POOL_CONVERTER_WEIGHTS = [500_000, 500_000];

const toWei = (value: number, decimals: number) => BigNumber.from(value).mul(BigNumber.from(10).pow(decimals));
const percentageToPPM = (value: string) => (Number(value.replace('%', '')) * 1_000_000) / 100;

export type deployFct = <C extends Contract>(toDeployContract: Promise<C>) => Promise<C>;
const basicDeploy: deployFct = async <C extends Contract>(toDeployContract: Promise<C>): Promise<C> => {
    return await toDeployContract;
};

export type executeFct = (txExecution: Promise<ContractTransaction>) => Promise<ContractReceipt>;
const basicExecute = async (txExecution: Promise<ContractTransaction>): Promise<ContractReceipt> => {
    return (await txExecution).wait();
};

export const deploySystem = async (
    signer: Signer,
    config: DeploymentConfig,
    deploy: deployFct = basicDeploy,
    execute: executeFct = basicExecute
): Promise<BancorSystem> => {
    const ROLE_OWNER = id('ROLE_OWNER');
    const ROLE_GOVERNOR = id('ROLE_GOVERNOR');
    const ROLE_MINTER = id('ROLE_MINTER');
    const ROLE_PUBLISHER = id('ROLE_PUBLISHER');

    // main contracts
    const contractRegistry = await deploy(Contracts.ContractRegistry.deploy());
    const converterFactory = await deploy(Contracts.ConverterFactory.deploy());
    const bancorNetwork = await deploy(Contracts.BancorNetwork.deploy(contractRegistry.address));
    const conversionPathFinder = await deploy(Contracts.ConversionPathFinder.deploy(contractRegistry.address));
    const converterUpgrader = await deploy(Contracts.ConverterUpgrader.deploy(contractRegistry.address));
    const converterRegistry = await deploy(Contracts.ConverterRegistry.deploy(contractRegistry.address));
    const converterRegistryData = await deploy(Contracts.ConverterRegistryData.deploy(contractRegistry.address));

    const networkFeeWallet = await deploy(Contracts.TokenHolder.deploy());
    const networkSettings = await deploy(Contracts.NetworkSettings.deploy(networkFeeWallet.address, 0));

    const standardPoolConverterFactory = await deploy(Contracts.StandardPoolConverterFactory.deploy());

    // initialize contract registry
    await execute(contractRegistry.registerAddress(formatBytes32String('ContractRegistry'), contractRegistry.address));
    await execute(contractRegistry.registerAddress(formatBytes32String('ConverterFactory'), converterFactory.address));
    await execute(contractRegistry.registerAddress(formatBytes32String('BancorNetwork'), bancorNetwork.address));
    await execute(contractRegistry.registerAddress(formatBytes32String('NetworkSettings'), networkSettings.address));

    await execute(
        contractRegistry.registerAddress(formatBytes32String('ConversionPathFinder'), conversionPathFinder.address)
    );
    await execute(
        contractRegistry.registerAddress(formatBytes32String('BancorConverterUpgrader'), converterUpgrader.address)
    );
    await execute(
        contractRegistry.registerAddress(formatBytes32String('BancorConverterRegistry'), converterRegistry.address)
    );
    await execute(
        contractRegistry.registerAddress(
            formatBytes32String('BancorConverterRegistryData'),
            converterRegistryData.address
        )
    );
    await execute(converterFactory.registerTypedConverterFactory(standardPoolConverterFactory.address));

    // initialize network tokens
    const bntToken = await deploy(
        Contracts.DSToken.deploy(
            config.networkToken.symbol + ' Token',
            config.networkToken.symbol,
            config.networkToken.decimals
        )
    );
    const vbntToken = await deploy(
        Contracts.DSToken.deploy(
            config.networkGovToken.symbol + ' Token',
            config.networkGovToken.symbol,
            config.networkGovToken.decimals
        )
    );

    // give some BNT for adding dual liquidity
    await execute(
        bntToken.issue(await signer.getAddress(), toWei(config.networkToken.supply, config.networkToken.decimals))
    );

    const liquidityProtectionSettings = await deploy(
        Contracts.LiquidityProtectionSettings.deploy(bntToken.address, contractRegistry.address)
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
            const token = await deploy(Contracts.TestStandardToken.deploy(name, symbol, supply));
            reserves[symbol] = {
                address: token.address,
                decimals: await token.decimals()
            };
        } else if (reserve.__typename === 'deployed') {
            const token = await Contracts.ERC20.attach(reserve.address);
            const symbol = await token.symbol();
            reserves[symbol] = {
                address: token.address,
                decimals: await token.decimals()
            };
        }
    }

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
                STANDARD_POOL_CONVERTER_WEIGHTS
            )
        );

        const converterAnchor = await Contracts.IConverterAnchor.attach(await converterRegistry.getAnchor(index));

        const standardConverter = await Contracts.StandardPoolConverter.attach(await converterAnchor.owner());
        await execute(standardConverter.acceptOwnership());
        await execute(standardConverter.setConversionFee(percentageToPPM(fee)));

        if (amounts.every((amount) => amount.gt(0))) {
            for (let i = 0; i < converter.reserves.length; i++) {
                const reserve = converter.reserves[i];
                if (reserve.symbol !== config.chainToken.symbol) {
                    const deployedToken = await Contracts.ERC20.attach(tokens[i]);
                    await execute(deployedToken.approve(standardConverter.address, amounts[i]));
                }
            }

            const deployedConverter = await Contracts.StandardPoolConverter.attach(standardConverter.address);
            await execute(deployedConverter.addLiquidity(tokens, amounts, 1, { value }));
        }

        if (converter.protected) {
            await execute(liquidityProtectionSettings.addPoolToWhitelist(converterAnchor.address));
        }

        index++;
    }

    await execute(contractRegistry.registerAddress(formatBytes32String('BNTToken'), bntToken.address));
    await execute(conversionPathFinder.setAnchorToken(bntToken.address));

    const bntTokenGovernance = await Contracts.TokenGovernance.deploy(bntToken.address);
    const vbntTokenGovernance = await Contracts.TokenGovernance.deploy(vbntToken.address);

    await execute(bntTokenGovernance.grantRole(ROLE_GOVERNOR, await signer.getAddress()));
    await execute(vbntTokenGovernance.grantRole(ROLE_GOVERNOR, await signer.getAddress()));

    await execute(bntToken.transferOwnership(bntTokenGovernance.address));
    await execute(bntTokenGovernance.acceptTokenOwnership());

    const checkpointStore = await deploy(Contracts.CheckpointStore.deploy());

    const stakingRewardsStore = await deploy(Contracts.StakingRewardsStore.deploy());
    const stakingRewards = await deploy(
        Contracts.StakingRewards.deploy(
            stakingRewardsStore.address,
            bntTokenGovernance.address,
            checkpointStore.address,
            contractRegistry.address
        )
    );

    const liquidityProtectionStore = await deploy(Contracts.LiquidityProtectionStore.deploy());
    const liquidityProtectionStats = await deploy(Contracts.LiquidityProtectionStats.deploy());
    const liquidityProtectionSystemStore = await deploy(Contracts.LiquidityProtectionSystemStore.deploy());
    const liquidityProtectionWallet = await deploy(Contracts.TokenHolder.deploy());

    const liquidityProtection = await deploy(
        Contracts.LiquidityProtection.deploy(
            liquidityProtectionSettings.address,
            liquidityProtectionStore.address,
            liquidityProtectionStats.address,
            liquidityProtectionSystemStore.address,
            liquidityProtectionWallet.address,
            bntTokenGovernance.address,
            vbntTokenGovernance.address,
            checkpointStore.address
        )
    );

    await execute(checkpointStore.grantRole(ROLE_OWNER, liquidityProtection.address));

    await execute(stakingRewardsStore.grantRole(ROLE_OWNER, stakingRewards.address));
    await execute(stakingRewards.grantRole(ROLE_PUBLISHER, liquidityProtection.address));
    await execute(bntTokenGovernance.grantRole(ROLE_MINTER, stakingRewards.address));
    await execute(liquidityProtectionSettings.addSubscriber(stakingRewards.address));

    // granting the LP contract both of the MINTER roles requires the deployer to have the GOVERNOR role
    await execute(bntTokenGovernance.grantRole(ROLE_MINTER, liquidityProtection.address));
    await execute(vbntTokenGovernance.grantRole(ROLE_MINTER, liquidityProtection.address));

    await execute(liquidityProtectionStats.grantRole(ROLE_OWNER, liquidityProtection.address));
    await execute(liquidityProtectionSystemStore.grantRole(ROLE_OWNER, liquidityProtection.address));

    await execute(
        contractRegistry.registerAddress(formatBytes32String('LiquidityProtection'), liquidityProtection.address)
    );

    await execute(liquidityProtectionStore.transferOwnership(liquidityProtection.address));
    await execute(liquidityProtection.acceptStoreOwnership());

    await execute(liquidityProtectionWallet.transferOwnership(liquidityProtection.address));
    await execute(liquidityProtection.acceptWalletOwnership());

    const params = config.liquidityProtectionParams;

    const minNetworkTokenLiquidityForMinting = toWei(
        params.minNetworkTokenLiquidityForMinting,
        config.networkToken.decimals
    );
    await execute(
        liquidityProtectionSettings.setMinNetworkTokenLiquidityForMinting(minNetworkTokenLiquidityForMinting)
    );

    const defaultNetworkTokenMintingLimit = toWei(params.defaultNetworkTokenMintingLimit, config.networkToken.decimals);
    await execute(liquidityProtectionSettings.setDefaultNetworkTokenMintingLimit(defaultNetworkTokenMintingLimit));

    await execute(
        liquidityProtectionSettings.setProtectionDelays(params.minProtectionDelay, params.maxProtectionDelay)
    );
    await execute(liquidityProtectionSettings.setLockDuration(params.lockDuration));

    const vortexBurner = await deploy(
        Contracts.VortexBurner.deploy(bntToken.address, vbntTokenGovernance.address, contractRegistry.address)
    );

    await execute(networkFeeWallet.transferOwnership(vortexBurner.address));
    await execute(vortexBurner.acceptNetworkFeeOwnership());

    return {};
};
