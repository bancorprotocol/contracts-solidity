import { ethers } from 'hardhat';
import Contracts from 'contracts';

const { keccak256, formatBytes32String } = ethers.utils;

import deployment from './deployment.json';

async function main() {
    const account = (await ethers.getSigners())[0];

    const decimalToInteger = (value: any, decimals: any) => {
        const parts = [...value.split('.'), ''];
        return parts[0] + parts[1].padEnd(decimals, '0');
    };

    const percentageToPPM = (value: any) => {
        return decimalToInteger(value.replace('%', ''), 4);
    };

    const ROLE_OWNER = keccak256('ROLE_OWNER');
    const ROLE_GOVERNOR = keccak256('ROLE_GOVERNOR');
    const ROLE_MINTER = keccak256('ROLE_MINTER');
    const ROLE_PUBLISHER = keccak256('ROLE_PUBLISHER');

    const reserves: { [key: string]: any } = {
        ETH: {
            address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
            decimals: 18
        }
    };

    // main contracts
    const contractRegistry = await Contracts.ContractRegistry.deploy();
    const converterFactory = await Contracts.ConverterFactory.deploy();
    const bancorNetwork = await Contracts.BancorNetwork.deploy(contractRegistry.address);
    const conversionPathFinder = await Contracts.ConversionPathFinder.deploy(contractRegistry.address);
    const converterUpgrader = await Contracts.ConverterUpgrader.deploy(contractRegistry.address);
    const converterRegistry = await Contracts.ConverterRegistry.deploy(contractRegistry.address);
    const converterRegistryData = await Contracts.ConverterRegistryData.deploy(contractRegistry.address);

    const networkFeeWallet = await Contracts.TokenHolder.deploy();
    const networkSettings = await Contracts.NetworkSettings.deploy(networkFeeWallet.address, 0);

    const standardPoolConverterFactory = await Contracts.StandardPoolConverterFactory.deploy();

    // contract deployment for etherscan verification only
    const poolToken1 = await Contracts.DSToken.deploy('Token1', 'TKN1', 18);
    await Contracts.StandardPoolConverter.deploy(poolToken1.address, contractRegistry.address, 1000);

    // initialize contract registry
    await contractRegistry.registerAddress(formatBytes32String('ContractRegistry'), contractRegistry.address);
    await contractRegistry.registerAddress(formatBytes32String('ConverterFactory'), converterFactory.address);
    await contractRegistry.registerAddress(formatBytes32String('BancorNetwork'), bancorNetwork.address);
    await contractRegistry.registerAddress(formatBytes32String('NetworkSettings'), networkSettings.address);

    await contractRegistry.registerAddress(formatBytes32String('ConversionPathFinder'), conversionPathFinder.address);
    await contractRegistry.registerAddress(formatBytes32String('BancorConverterUpgrader'), converterUpgrader.address);
    await contractRegistry.registerAddress(formatBytes32String('BancorConverterRegistry'), converterRegistry.address);
    await contractRegistry.registerAddress(
        formatBytes32String('BancorConverterRegistryData'),
        converterRegistryData.address
    );

    // initialize converter factory
    await converterFactory.registerTypedConverterFactory(standardPoolConverterFactory.address);

    var converterIndex = 0;
    for (const converter of deployment.converters) {
        const type = converter.type;
        const name = converter.symbol + ' Liquidity Pool';
        const symbol = converter.symbol;
        const decimals = converter.decimals;
        const fee = percentageToPPM(converter.fee);
        const tokensSymbols = converter.symbol.split('/');

        // @ts-ignore
        const tokens = [deployment.reserves[tokensSymbols[0]].address, deployment.reserves[tokensSymbols[1]].address];
        const weights = [percentageToPPM('50%'), percentageToPPM('50%')];

        await converterRegistry.newConverter(type, name, symbol, decimals, percentageToPPM('100%'), tokens, weights);

        const converterAnchor = await Contracts.IConverterAnchor.attach(
            await converterRegistry.getAnchor(converterIndex)
        );

        const standardConverter = await Contracts.StandardPoolConverter.attach(await converterAnchor.owner());
        await standardConverter.acceptOwnership();
        await standardConverter.setConversionFee(fee);

        reserves[converter.symbol] = {
            address: converterAnchor.address,
            decimals: decimals
        };
        converterIndex++;
    }

    await contractRegistry.registerAddress(formatBytes32String('BNTToken'), reserves.BNT.address);
    await conversionPathFinder.setAnchorToken(reserves.BNT.address);

    const bntTokenGovernance = await Contracts.TokenGovernance.deploy(reserves.BNT.address);
    const vbntTokenGovernance = await Contracts.TokenGovernance.deploy(reserves.vBNT.address);

    await bntTokenGovernance.grantRole(ROLE_GOVERNOR, account.address);
    await vbntTokenGovernance.grantRole(ROLE_GOVERNOR, account.address);

    const bntToken = await Contracts.DSToken.attach(reserves.BNT.address);
    await bntToken.transferOwnership(bntTokenGovernance.address);
    await bntTokenGovernance.acceptTokenOwnership();

    const checkpointStore = await Contracts.CheckpointStore.deploy();

    const stakingRewardsStore = await Contracts.StakingRewardsStore.deploy();
    const stakingRewards = await Contracts.StakingRewards.deploy(
        stakingRewardsStore.address,
        bntTokenGovernance.address,
        checkpointStore.address,
        contractRegistry.address
    );

    const liquidityProtectionSettings = await Contracts.LiquidityProtectionSettings.deploy(
        reserves.BNT.address,
        contractRegistry.address
    );

    const liquidityProtectionStore = await Contracts.LiquidityProtectionStore.deploy();
    const liquidityProtectionStats = await Contracts.LiquidityProtectionStats.deploy();
    const liquidityProtectionSystemStore = await Contracts.LiquidityProtectionSystemStore.deploy();
    const liquidityProtectionWallet = await Contracts.TokenHolder.deploy();

    const liquidityProtection = await Contracts.LiquidityProtection.deploy(
        liquidityProtectionSettings.address,
        liquidityProtectionStore.address,
        liquidityProtectionStats.address,
        liquidityProtectionSystemStore.address,
        liquidityProtectionWallet.address,
        bntTokenGovernance.address,
        vbntTokenGovernance.address,
        checkpointStore.address
    );

    await checkpointStore.grantRole(ROLE_OWNER, liquidityProtection.address);

    await stakingRewardsStore.grantRole(ROLE_OWNER, stakingRewards.address);
    await stakingRewards.grantRole(ROLE_PUBLISHER, liquidityProtection.address);
    await bntTokenGovernance.grantRole(ROLE_MINTER, stakingRewards.address);
    await liquidityProtectionSettings.addSubscriber(stakingRewards.address);

    // granting the LP contract both of the MINTER roles requires the deployer to have the GOVERNOR role
    await bntTokenGovernance.grantRole(ROLE_MINTER, liquidityProtection.address);
    await vbntTokenGovernance.grantRole(ROLE_MINTER, liquidityProtection.address);

    await liquidityProtectionStats.grantRole(ROLE_OWNER, liquidityProtection.address);
    await liquidityProtectionSystemStore.grantRole(ROLE_OWNER, liquidityProtection.address);

    await contractRegistry.registerAddress(formatBytes32String('LiquidityProtection'), liquidityProtection.address);

    await liquidityProtectionStore.transferOwnership(liquidityProtection.address);
    await liquidityProtection.acceptStoreOwnership();

    await liquidityProtectionWallet.transferOwnership(liquidityProtection.address);
    await liquidityProtection.acceptWalletOwnership();

    const params = deployment.liquidityProtectionParams;

    const minNetworkTokenLiquidityForMinting = decimalToInteger(
        params.minNetworkTokenLiquidityForMinting,
        reserves.BNT.decimals
    );
    await liquidityProtectionSettings.setMinNetworkTokenLiquidityForMinting(minNetworkTokenLiquidityForMinting);

    const defaultNetworkTokenMintingLimit = decimalToInteger(
        params.defaultNetworkTokenMintingLimit,
        reserves.BNT.decimals
    );
    await liquidityProtectionSettings.setDefaultNetworkTokenMintingLimit(defaultNetworkTokenMintingLimit);

    await liquidityProtectionSettings.setProtectionDelays(params.minProtectionDelay, params.maxProtectionDelay);
    await liquidityProtectionSettings.setLockDuration(params.lockDuration);

    for (const converter of params.converters) {
        await liquidityProtectionSettings.addPoolToWhitelist(reserves[converter].address);
    }

    const vortexBurner = await Contracts.VortexBurner.deploy(
        reserves.BNT.address,
        vbntTokenGovernance.address,
        contractRegistry.address
    );

    await networkFeeWallet.transferOwnership(vortexBurner.address);
    await vortexBurner.acceptNetworkFeeOwnership();
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
