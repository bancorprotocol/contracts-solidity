import { ethers } from 'hardhat';
import DefaultContracts, { Contract } from 'contracts';
import { DeploymentConfig, BancorSystem } from './types';
import { Signer } from '@ethersproject/abstract-signer';
import { ContractReceipt, ContractTransaction } from '@ethersproject/contracts';

const {
    BigNumber,
    utils: { id, formatBytes32String }
} = ethers;

const MAX_CONVERSION_FEE = 1_000_000;
const STANDARD_POOL_CONVERTER_WEIGHTS = [500_000, 500_000];

const toWei = (value: number, decimals: number) => BigNumber.from(value).mul(BigNumber.from(10).pow(decimals));
const percentageToPPM = (value: string) => (Number(value.replace('%', '')) * 1_000_000) / 100;

export type deployFct = <C extends Contract>(name: string, toDeployContract: Promise<C>) => Promise<C>;
const basicDeploy: deployFct = async <C extends Contract>(_: string, toDeployContract: Promise<C>): Promise<C> => {
    const contract = await toDeployContract;
    await contract.deployTransaction.wait();
    return contract;
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

    const Contracts = DefaultContracts.connect(signer);

    // main contracts
    const contractRegistry = await deploy('contractRegistry', Contracts.ContractRegistry.deploy());
    const converterFactory = await deploy('converterFactory', Contracts.ConverterFactory.deploy());
    const bancorNetwork = await deploy('bancorNetwork', Contracts.BancorNetwork.deploy(contractRegistry.address));
    const conversionPathFinder = await deploy(
        'conversionPathFinder',
        Contracts.ConversionPathFinder.deploy(contractRegistry.address)
    );
    const converterUpgrader = await deploy(
        'converterUpgrader',
        Contracts.ConverterUpgrader.deploy(contractRegistry.address)
    );
    const converterRegistry = await deploy(
        'converterRegistry',
        Contracts.ConverterRegistry.deploy(contractRegistry.address)
    );
    const converterRegistryData = await deploy(
        'converterRegistryData',
        Contracts.ConverterRegistryData.deploy(contractRegistry.address)
    );

    const networkFeeWallet = await deploy('networkFeeWallet', Contracts.TokenHolder.deploy());
    const networkSettings = await deploy(
        'networkSettings',
        Contracts.NetworkSettings.deploy(networkFeeWallet.address, 0)
    );

    const standardPoolConverterFactory = await deploy(
        'standardPoolConverterFactory',
        Contracts.StandardPoolConverterFactory.deploy()
    );

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
        'bntToken',
        Contracts.DSToken.deploy(
            config.networkToken.symbol + ' Token',
            config.networkToken.symbol,
            config.networkToken.decimals
        )
    );
    const vbntToken = await deploy(
        'vbntToken',
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
        'liquidityProtectionSettings',
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
            const token = await deploy(symbol, Contracts.TestStandardToken.deploy(name, symbol, supply));
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
                STANDARD_POOL_CONVERTER_WEIGHTS
            )
        );

        const converterAnchor = await Contracts.IConverterAnchor.attach(await converterRegistry.getAnchor(index));

        const standardConverter = await Contracts.StandardPoolConverter.attach(await converterAnchor.owner());
        converters[converter.symbol] = { symbol: converter.symbol, address: standardConverter.address };
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

    const bntTokenGovernance = await deploy('bntTokenGovernance', Contracts.TokenGovernance.deploy(bntToken.address));
    const vbntTokenGovernance = await deploy(
        'vbntTokenGovernance',
        Contracts.TokenGovernance.deploy(vbntToken.address)
    );

    await execute(bntTokenGovernance.grantRole(ROLE_GOVERNOR, await signer.getAddress()));
    await execute(vbntTokenGovernance.grantRole(ROLE_GOVERNOR, await signer.getAddress()));

    await execute(bntToken.transferOwnership(bntTokenGovernance.address));
    await execute(bntTokenGovernance.acceptTokenOwnership());

    const checkpointStore = await deploy('checkpointStore', Contracts.CheckpointStore.deploy());

    const stakingRewardsStore = await deploy('stakingRewardsStore', Contracts.StakingRewardsStore.deploy());
    const stakingRewards = await deploy(
        'stakingRewards',
        Contracts.StakingRewards.deploy(
            stakingRewardsStore.address,
            bntTokenGovernance.address,
            checkpointStore.address,
            contractRegistry.address
        )
    );

    const liquidityProtectionStore = await deploy(
        'liquidityProtectionStore',
        Contracts.LiquidityProtectionStore.deploy()
    );
    const liquidityProtectionStats = await deploy(
        'liquidityProtectionStats',
        Contracts.LiquidityProtectionStats.deploy()
    );
    const liquidityProtectionSystemStore = await deploy(
        'liquidityProtectionSystemStore',
        Contracts.LiquidityProtectionSystemStore.deploy()
    );
    const liquidityProtectionWallet = await deploy('liquidityProtectionWallet', Contracts.TokenHolder.deploy());

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
        'vortexBurner',
        Contracts.VortexBurner.deploy(bntToken.address, vbntTokenGovernance.address, contractRegistry.address)
    );

    await execute(networkFeeWallet.transferOwnership(vortexBurner.address));
    await execute(vortexBurner.acceptNetworkFeeOwnership());

    return {
        contractRegistry: contractRegistry.address,
        converterFactory: converterFactory.address,
        bancorNetwork: bancorNetwork.address,
        conversionPathFinder: conversionPathFinder.address,
        converterUpgrader: converterUpgrader.address,
        converterRegistry: converterRegistry.address,
        converterRegistryData: converterRegistryData.address,
        networkFeeWallet: networkFeeWallet.address,
        networkSettings: networkSettings.address,
        standardPoolConverterFactory: standardPoolConverterFactory.address,
        bntToken: bntToken.address,
        vbntToken: vbntToken.address,
        liquidityProtectionSettings: liquidityProtectionSettings.address,
        reserves: reserves,
        converters: converters,
        bntTokenGovernance: bntTokenGovernance.address,
        vbntTokenGovernance: vbntTokenGovernance.address,
        checkpointStore: checkpointStore.address,
        stakingRewardsStore: stakingRewardsStore.address,
        stakingRewards: stakingRewards.address,
        liquidityProtectionStore: liquidityProtectionStore.address,
        liquidityProtectionStats: liquidityProtectionStats.address,
        liquidityProtectionSystemStore: liquidityProtectionSystemStore.address,
        liquidityProtectionWallet: liquidityProtectionWallet.address,
        liquidityProtection: liquidityProtection.address,
        vortexBurner: vortexBurner.address
    };
};
