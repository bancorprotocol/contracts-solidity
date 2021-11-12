const {
    BigNumber,
    utils: { id, formatBytes32String }
} = require('ethers');

const MAX_CONVERSION_FEE = 1_000_000;
const STANDARD_POOL_CONVERTER_WEIGHTS = [500_000, 500_000];

const toWei = (value, decimals) => BigNumber.from(value).mul(BigNumber.from(10).pow(decimals));
const percentageToPPM = (value) => (Number(value.replace('%', '')) * 1_000_000) / 100;

module.exports = async (signer, deploy, deployed, execute, config) => {
    const ROLE_OWNER = id('ROLE_OWNER');
    const ROLE_GOVERNOR = id('ROLE_GOVERNOR');
    const ROLE_MINTER = id('ROLE_MINTER');
    const ROLE_PUBLISHER = id('ROLE_PUBLISHER');

    const reserves = {
        ETH: {
            address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
            decimals: 18
        }
    };

    // main contracts
    const contractRegistry = await deploy('contractRegistry', 'ContractRegistry');
    const converterFactory = await deploy('converterFactory', 'ConverterFactory');
    const bancorNetwork = await deploy('bancorNetwork', 'BancorNetwork', contractRegistry.address);
    const conversionPathFinder = await deploy('conversionPathFinder', 'ConversionPathFinder', contractRegistry.address);
    const converterUpgrader = await deploy('converterUpgrader', 'ConverterUpgrader', contractRegistry.address);
    const converterRegistry = await deploy('converterRegistry', 'ConverterRegistry', contractRegistry.address);
    const converterRegistryData = await deploy(
        'converterRegistryData',
        'ConverterRegistryData',
        contractRegistry.address
    );

    const networkFeeWallet = await deploy('networkFeeWallet', 'TokenHolder');
    const networkSettings = await deploy('networkSettings', 'NetworkSettings', networkFeeWallet.address, 0);

    const standardPoolConverterFactory = await deploy('standardPoolConverterFactory', 'StandardPoolConverterFactory');

    // contract deployment for etherscan verification only
    const poolToken1 = await deploy('poolToken1', 'DSToken', 'Token1', 'TKN1', 18);
    await deploy('standardPoolConverter', 'StandardPoolConverter', poolToken1.address, contractRegistry.address, 1000);

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

    for (const reserve of config.reserves) {
        if (reserve.address) {
            const token = await deployed('ERC20', reserve.address);
            const symbol = await token.symbol();
            const decimals = await token.decimals();
            reserves[symbol] = { address: token.address, decimals: decimals };
        } else {
            const { symbol, decimals } = reserve;
            const name = symbol + ' DS Token';
            const supply = toWei(reserve.supply, decimals);
            const token = await deploy('dsToken-' + symbol, 'DSToken', name, symbol, decimals);

            await execute(token.issue(await signer.getAddress(), supply));

            reserves[symbol] = { address: token.address, decimals };
        }
    }

    for (const [converter, index] of config.converters.map((converter, index) => [converter, index])) {
        const { type, symbol, decimals, fee } = converter;
        const name = converter.symbol + ' Liquidity Pool';
        const tokens = converter.reserves.map((reserve) => reserves[reserve.symbol].address);
        const amounts = converter.reserves.map((reserve) => toWei(reserve.balance, reserves[reserve.symbol].decimals));
        const value = amounts[converter.reserves.findIndex((reserve) => reserve.symbol === 'ETH')];

        await execute(
            converterRegistry.newConverter(
                type,
                name,
                symbol,
                decimals,
                MAX_CONVERSION_FEE,
                tokens,
                STANDARD_POOL_CONVERTER_WEIGHTS
            )
        );

        const converterAnchor = await deployed('IConverterAnchor', await converterRegistry.getAnchor(index));

        const standardConverter = await deployed('StandardPoolConverter', await converterAnchor.owner());
        await execute(standardConverter.acceptOwnership());
        await execute(standardConverter.setConversionFee(percentageToPPM(fee)));

        if (amounts.every((amount) => amount > 0)) {
            for (let i = 0; i < converter.reserves.length; i++) {
                const reserve = converter.reserves[i];
                if (reserve.symbol !== 'ETH') {
                    const deployedToken = await deployed('ERC20', tokens[i]);
                    await execute(deployedToken.approve(standardConverter.address, amounts[i]));
                }
            }

            const deployedConverterType = { 3: 'StandardPoolConverter' }[type];
            const deployedConverter = await deployed(deployedConverterType, standardConverter.address);
            await execute(deployedConverter.addLiquidity(tokens, amounts, 1, { value }));
        }

        reserves[converter.symbol] = {
            address: converterAnchor.address,
            decimals: decimals
        };
    }

    await execute(contractRegistry.registerAddress(formatBytes32String('BNTToken'), reserves.BNT.address));
    await execute(conversionPathFinder.setAnchorToken(reserves.BNT.address));

    const bntTokenGovernance = await deploy('bntTokenGovernance', 'TokenGovernance', reserves.BNT.address);
    const vbntTokenGovernance = await deploy('vbntTokenGovernance', 'TokenGovernance', reserves.vBNT.address);

    await execute(bntTokenGovernance.grantRole(ROLE_GOVERNOR, await signer.getAddress()));
    await execute(vbntTokenGovernance.grantRole(ROLE_GOVERNOR, await signer.getAddress()));

    const bntToken = await deployed('DSToken', reserves.BNT.address);
    await execute(bntToken.transferOwnership(bntTokenGovernance.address));
    await execute(bntTokenGovernance.acceptTokenOwnership());

    const checkpointStore = await deploy('checkpointStore', 'CheckpointStore');

    const stakingRewardsStore = await deploy('stakingRewardsStore', 'StakingRewardsStore');
    const stakingRewards = await deploy(
        'stakingRewards',
        'StakingRewards',
        stakingRewardsStore.address,
        bntTokenGovernance.address,
        checkpointStore.address,
        contractRegistry.address
    );

    await execute(
        contractRegistry.registerAddress(formatBytes32String('StakingRewards'), stakingRewards.address)
    );

    const liquidityProtectionSettings = await deploy(
        'liquidityProtectionSettings',
        'LiquidityProtectionSettings',
        reserves.BNT.address,
        contractRegistry.address
    );

    const liquidityProtectionStore = await deploy('liquidityProtectionStore', 'LiquidityProtectionStore');
    const liquidityProtectionStats = await deploy('liquidityProtectionStats', 'LiquidityProtectionStats');
    const liquidityProtectionSystemStore = await deploy(
        'liquidityProtectionSystemStore',
        'LiquidityProtectionSystemStore'
    );
    const liquidityProtectionWallet = await deploy('liquidityProtectionWallet', 'TokenHolder');

    const liquidityProtection = await deploy(
        'liquidityProtection',
        'LiquidityProtection',
        liquidityProtectionSettings.address,
        liquidityProtectionStore.address,
        liquidityProtectionStats.address,
        liquidityProtectionSystemStore.address,
        liquidityProtectionWallet.address,
        bntTokenGovernance.address,
        vbntTokenGovernance.address,
        checkpointStore.address
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

    const minNetworkTokenLiquidityForMinting = toWei(params.minNetworkTokenLiquidityForMinting, reserves.BNT.decimals);
    await execute(
        liquidityProtectionSettings.setMinNetworkTokenLiquidityForMinting(minNetworkTokenLiquidityForMinting)
    );

    const defaultNetworkTokenMintingLimit = toWei(params.defaultNetworkTokenMintingLimit, reserves.BNT.decimals);
    await execute(liquidityProtectionSettings.setDefaultNetworkTokenMintingLimit(defaultNetworkTokenMintingLimit));

    await execute(
        liquidityProtectionSettings.setProtectionDelays(params.minProtectionDelay, params.maxProtectionDelay)
    );
    await execute(liquidityProtectionSettings.setLockDuration(params.lockDuration));

    for (const converter of params.converters) {
        await execute(liquidityProtectionSettings.addPoolToWhitelist(reserves[converter].address));
    }

    const vortexBurner = await deploy(
        'vortexBurner',
        'VortexBurner',
        reserves.BNT.address,
        vbntTokenGovernance.address,
        contractRegistry.address
    );

    await execute(networkFeeWallet.transferOwnership(vortexBurner.address));
    await execute(vortexBurner.acceptNetworkFeeOwnership());
};
