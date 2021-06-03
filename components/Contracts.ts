import { Contract, ContractFactory } from '@ethersproject/contracts';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

import { ethers } from 'hardhat';

import { BancorNetwork, BancorNetwork__factory } from 'typechain';

const deployContract = async (contractName: any, ...args: any) => {
    let signer = (await ethers.getSigners())[0];

    if (typeof args[args.length - 1] === 'object' && args[args.length - 1].from) {
        signer = args[args.length - 1].from;
        if (typeof signer !== 'object' || signer.constructor.name !== 'SignerWithAddress') {
            throw new Error('Signer must be SignerWithAddress');
        }
        args.pop();
    }

    const contractFactory = await ethers.getContractFactory(contractName, signer);
    return args === undefined || args.length === 0 ? await contractFactory.deploy() : contractFactory.deploy(...args);
};

const deployOrAttach = <
    T extends Contract,
    F extends ContractFactory,
    ParamsTypes extends typeof ContractFactory.prototype.deploy
>(
    contractName: string,
    argsNumber: number,
    connect: any
) => {
    return {
        deploy: (...args: Parameters<ParamsTypes>): Promise<T> => {
            return deployContract(contractName, ...args);
        },
        attach: async (address: string, signer?: SignerWithAddress): Promise<T> => {
            return connect(address, signer);
        }
    };
};

export default {
    // BancorFormula: deployOrAttach('BancorFormula'),
    BancorNetwork: deployOrAttach<
        BancorNetwork,
        BancorNetwork__factory,
        typeof BancorNetwork__factory.prototype.deploy
    >('BancorNetwork', BancorNetwork__factory.prototype.deploy.length, BancorNetwork__factory.connect)
    // BancorX: deployOrAttach('BancorX'),
    // CheckpointStore: deployOrAttach('CheckpointStore'),
    // ContractRegistry: deployOrAttach('ContractRegistry'),
    // ConversionPathFinder: deployOrAttach('ConversionPathFinder'),
    // ConverterFactory: deployOrAttach('ConverterFactory'),
    // ConverterRegistry: deployOrAttach('ConverterRegistry'),
    // ConverterRegistryData: deployOrAttach('ConverterRegistryData'),
    // ConverterUpgrader: deployOrAttach('ConverterUpgrader'),
    // ConverterV27OrLowerWithFallback: deployOrAttach('ConverterV27OrLowerWithFallback'),
    // ConverterV27OrLowerWithoutFallback: deployOrAttach('ConverterV27OrLowerWithoutFallback'),
    // ConverterV28OrHigherWithFallback: deployOrAttach('ConverterV28OrHigherWithFallback'),
    // ConverterV28OrHigherWithoutFallback: deployOrAttach('ConverterV28OrHigherWithoutFallback'),
    // DSToken: deployOrAttach('DSToken'),
    // ERC20: deployOrAttach('ERC20'),
    // FixedRatePoolConverter: deployOrAttach('FixedRatePoolConverter'),
    // FixedRatePoolConverterFactory: deployOrAttach('FixedRatePoolConverterFactory'),
    // IConverterAnchor: deployOrAttach('IConverterAnchor'),
    // LiquidityPoolV1Converter: deployOrAttach('LiquidityPoolV1Converter'),
    // LiquidityPoolV1ConverterFactory: deployOrAttach('LiquidityPoolV1ConverterFactory'),
    // LiquidityProtection: deployOrAttach('LiquidityProtection'),
    // LiquidityProtectionSettings: deployOrAttach('LiquidityProtectionSettings'),
    // LiquidityProtectionSettingsMigrator: deployOrAttach('LiquidityProtectionSettingsMigrator'),
    // LiquidityProtectionStats: deployOrAttach('LiquidityProtectionStats'),
    // LiquidityProtectionStore: deployOrAttach('LiquidityProtectionStore'),
    // LiquidityProtectionSystemStore: deployOrAttach('LiquidityProtectionSystemStore'),
    // NetworkSettings: deployOrAttach('NetworkSettings'),
    // Owned: deployOrAttach('Owned'),
    // StakingRewards: deployOrAttach('StakingRewards'),
    // StakingRewardsStore: deployOrAttach('StakingRewardsStore'),
    // StandardPoolConverter: deployOrAttach('StandardPoolConverter'),
    // StandardPoolConverterFactory: deployOrAttach('StandardPoolConverterFactory'),
    // TestBancorFormula: deployOrAttach('TestBancorFormula'),
    // TestBancorNetwork: deployOrAttach('TestBancorNetwork'),
    // TestCheckpointStore: deployOrAttach('TestCheckpointStore'),
    // TestContractRegistryClient: deployOrAttach('TestContractRegistryClient'),
    // TestConverterFactory: deployOrAttach('TestConverterFactory'),
    // TestConverterRegistry: deployOrAttach('TestConverterRegistry'),
    // TestFixedRatePoolConverter: deployOrAttach('TestFixedRatePoolConverter'),
    // TestLiquidityPoolV1Converter: deployOrAttach('TestLiquidityPoolV1Converter'),
    // TestLiquidityPoolV1ConverterFactory: deployOrAttach('TestLiquidityPoolV1ConverterFactory'),
    // TestLiquidityProtection: deployOrAttach('TestLiquidityProtection'),
    // TestLiquidityProvisionEventsSubscriber: deployOrAttach('TestLiquidityProvisionEventsSubscriber'),
    // TestMathEx: deployOrAttach('TestMathEx'),
    // TestNonStandardToken: deployOrAttach('TestNonStandardToken'),
    // TestReserveToken: deployOrAttach('TestReserveToken'),
    // TestSafeERC20Ex: deployOrAttach('TestSafeERC20Ex'),
    // TestStakingRewards: deployOrAttach('TestStakingRewards'),
    // TestStakingRewardsStore: deployOrAttach('TestStakingRewardsStore'),
    // TestStandardPoolConverter: deployOrAttach('TestStandardPoolConverter'),
    // TestStandardPoolConverterFactory: deployOrAttach('TestStandardPoolConverterFactory'),
    // TestStandardToken: deployOrAttach('TestStandardToken'),
    // TestTokenGovernance: deployOrAttach('TestTokenGovernance'),
    // TestTransferPositionCallback: deployOrAttach('TestTransferPositionCallback'),
    // TestTypedConverterAnchorFactory: deployOrAttach('TestTypedConverterAnchorFactory'),
    // TokenGovernance: deployOrAttach('TokenGovernance'),
    // TokenHolder: deployOrAttach('TokenHolder'),
    // VortexBurner: deployOrAttach('VortexBurner'),
    // Whitelist: deployOrAttach('Whitelist'),
    // XTransferRerouter: deployOrAttach('XTransferRerouter')
};
