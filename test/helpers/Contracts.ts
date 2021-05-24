import { ParamType } from '@ethersproject/abi';
import { Contract, ContractFactory, Overrides as OldOverrides } from '@ethersproject/contracts';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { sign, Signer } from 'crypto';
import { ethers } from 'hardhat';

import {
    BancorNetwork,
    BancorNetwork__factory,
    BancorX,
    BancorX__factory,
    CheckpointStore,
    CheckpointStore__factory,
    ContractRegistry,
    ContractRegistry__factory,
    ConversionPathFinder,
    ConversionPathFinder__factory,
    ConverterFactory,
    ConverterFactory__factory,
    ConverterRegistry,
    ConverterRegistryData,
    ConverterRegistryData__factory,
    ConverterRegistry__factory,
    ConverterUpgrader,
    ConverterUpgrader__factory,
    ConverterV27OrLowerWithFallback,
    ConverterV27OrLowerWithFallback__factory,
    ConverterV28OrHigherWithFallback,
    ConverterV28OrHigherWithFallback__factory,
    ConverterV28OrHigherWithoutFallback,
    ConverterV28OrHigherWithoutFallback__factory,
    DSToken,
    DSToken__factory,
    IConverterAnchor,
    IConverterAnchor__factory,
    LiquidityProtection,
    LiquidityProtectionSettings,
    LiquidityProtectionSettings__factory,
    LiquidityProtectionStats,
    LiquidityProtectionStats__factory,
    LiquidityProtectionStore,
    LiquidityProtectionStore__factory,
    LiquidityProtectionSystemStore,
    LiquidityProtectionSystemStore__factory,
    LiquidityProtection__factory,
    NetworkSettings,
    NetworkSettings__factory,
    Owned,
    Owned__factory,
    StandardPoolConverter,
    StandardPoolConverterFactory,
    StandardPoolConverterFactory__factory,
    StandardPoolConverter__factory,
    TestBancorNetwork,
    TestBancorNetwork__factory,
    TestCheckpointStore,
    TestCheckpointStore__factory,
    TestContractRegistryClient,
    TestContractRegistryClient__factory,
    TestConverterFactory,
    TestConverterFactory__factory,
    TestConverterRegistry,
    TestConverterRegistry__factory,
    TestLiquidityProtection,
    TestLiquidityProtection__factory,
    TestMathEx,
    TestMathEx__factory,
    TestNonStandardToken,
    TestNonStandardToken__factory,
    TestReserveToken,
    TestReserveToken__factory,
    TestSafeERC20Ex,
    TestSafeERC20Ex__factory,
    TestStakingRewards,
    TestStakingRewardsStore,
    TestStakingRewardsStore__factory,
    TestStakingRewards__factory,
    TestStandardPoolConverter,
    TestStandardPoolConverterFactory,
    TestStandardPoolConverterFactory__factory,
    TestStandardPoolConverter__factory,
    TestStandardToken,
    TestStandardToken__factory,
    TestTokenGovernance,
    TestTokenGovernance__factory,
    TestTypedConverterAnchorFactory,
    TestTypedConverterAnchorFactory__factory,
    TokenGovernance,
    TokenGovernance__factory,
    TokenHolder,
    TokenHolder__factory,
    VortexBurner,
    VortexBurner__factory
} from '../../typechain';

// Replace type of the last param of a function
type LastIndex<T extends readonly any[]> = ((...t: T) => void) extends (x: any, ...r: infer R) => void
    ? Exclude<keyof T, keyof R>
    : never;
type ReplaceLastParam<TParams extends readonly any[], TReplace> = {
    [K in keyof TParams]: K extends LastIndex<TParams> ? TReplace : TParams[K];
};
type ReplaceLast<F, TReplace> = F extends (...args: infer T) => infer R
    ? (...args: ReplaceLastParam<T, TReplace>) => R
    : never;

type Overrides = OldOverrides & { from?: SignerWithAddress };

const deployOrAttach = <C extends Contract, T extends ContractFactory>(
    contractName: string,
    deployParamLength: number
) => {
    type ParamsTypes = ReplaceLast<T['deploy'], Overrides>;
    return {
        deploy: async (...args: Parameters<ParamsTypes>): Promise<C> => {
            let defaultSigner = (await ethers.getSigners())[0];

            // If similar then last param is override
            if (args.length === deployParamLength) {
                const overrides = args.pop() as Overrides;

                const contractFactory = await ethers.getContractFactory(
                    contractName,
                    overrides.from ? overrides.from : defaultSigner
                );
                delete overrides.from;
                return (await contractFactory.deploy(...args, overrides)) as C;
            }
            return (await (await ethers.getContractFactory(contractName)).deploy(...args)) as C;
        },
        attach: async (address: string, signer?: SignerWithAddress): Promise<C> => {
            let defaultSigner = (await ethers.getSigners())[0];

            const contractFactory = await ethers.getContractFactory(contractName, signer ? signer : defaultSigner);
            return contractFactory.attach(address) as C;
        }
    };
};

export default {
    BancorNetwork: deployOrAttach<BancorNetwork, BancorNetwork__factory>(
        'BancorNetwork',
        BancorNetwork__factory.prototype.deploy.length
    ),
    BancorX: deployOrAttach<BancorX, BancorX__factory>('BancorX', BancorX__factory.prototype.deploy.length),
    CheckpointStore: deployOrAttach<CheckpointStore, CheckpointStore__factory>(
        'CheckpointStore',
        CheckpointStore__factory.prototype.deploy.length
    ),
    ContractRegistry: deployOrAttach<ContractRegistry, ContractRegistry__factory>(
        'ContractRegistry',
        ContractRegistry__factory.prototype.deploy.length
    ),
    ConversionPathFinder: deployOrAttach<ConversionPathFinder, ConversionPathFinder__factory>(
        'ConversionPathFinder',
        ConversionPathFinder__factory.prototype.deploy.length
    ),
    ConverterFactory: deployOrAttach<ConverterFactory, ConverterFactory__factory>(
        'ConverterFactory',
        ConverterFactory__factory.prototype.deploy.length
    ),
    ConverterRegistry: deployOrAttach<ConverterRegistry, ConverterRegistry__factory>(
        'ConverterRegistry',
        ConverterRegistry__factory.prototype.deploy.length
    ),
    ConverterRegistryData: deployOrAttach<ConverterRegistryData, ConverterRegistryData__factory>(
        'ConverterRegistryData',
        ConverterRegistryData__factory.prototype.deploy.length
    ),
    ConverterUpgrader: deployOrAttach<ConverterUpgrader, ConverterUpgrader__factory>(
        'ConverterUpgrader',
        ConverterUpgrader__factory.prototype.deploy.length
    ),
    ConverterV27OrLowerWithFallback: deployOrAttach<
        ConverterV27OrLowerWithFallback,
        ConverterV27OrLowerWithFallback__factory
    >('ConverterV27OrLowerWithFallback', ConverterV27OrLowerWithFallback__factory.prototype.deploy.length),
    ConverterV27OrLowerWithoutFallback: deployOrAttach<Contract, ContractFactory>(
        'ConverterV27OrLowerWithoutFallback',
        ContractFactory.prototype.deploy.length
    ),
    ConverterV28OrHigherWithFallback: deployOrAttach<
        ConverterV28OrHigherWithFallback,
        ConverterV28OrHigherWithFallback__factory
    >('ConverterV28OrHigherWithFallback', ConverterV28OrHigherWithFallback__factory.prototype.deploy.length),
    ConverterV28OrHigherWithoutFallback: deployOrAttach<
        ConverterV28OrHigherWithoutFallback,
        ConverterV28OrHigherWithoutFallback__factory
    >('ConverterV28OrHigherWithoutFallback', ConverterV28OrHigherWithoutFallback__factory.prototype.deploy.length),
    DSToken: deployOrAttach<DSToken, DSToken__factory>('DSToken', DSToken__factory.prototype.deploy.length),
    IConverterAnchor: deployOrAttach<IConverterAnchor, ContractFactory>(
        'IConverterAnchor',
        ContractFactory.prototype.deploy.length
    ),
    LiquidityProtection: deployOrAttach<LiquidityProtection, LiquidityProtection__factory>(
        'LiquidityProtection',
        LiquidityProtection__factory.prototype.deploy.length
    ),
    LiquidityProtectionSettings: deployOrAttach<LiquidityProtectionSettings, LiquidityProtectionSettings__factory>(
        'LiquidityProtectionSettings',
        LiquidityProtectionSettings__factory.prototype.deploy.length
    ),
    LiquidityProtectionStats: deployOrAttach<LiquidityProtectionStats, LiquidityProtectionStats__factory>(
        'LiquidityProtectionStats',
        LiquidityProtectionStats__factory.prototype.deploy.length
    ),
    LiquidityProtectionStore: deployOrAttach<LiquidityProtectionStore, LiquidityProtectionStore__factory>(
        'LiquidityProtectionStore',
        LiquidityProtectionStore__factory.prototype.deploy.length
    ),
    LiquidityProtectionSystemStore: deployOrAttach<
        LiquidityProtectionSystemStore,
        LiquidityProtectionSystemStore__factory
    >('LiquidityProtectionSystemStore', LiquidityProtectionSystemStore__factory.prototype.deploy.length),
    NetworkSettings: deployOrAttach<NetworkSettings, NetworkSettings__factory>(
        'NetworkSettings',
        NetworkSettings__factory.prototype.deploy.length
    ),
    Owned: deployOrAttach<Owned, Owned__factory>('Owned', Owned__factory.prototype.deploy.length),
    StandardPoolConverter: deployOrAttach<StandardPoolConverter, StandardPoolConverter__factory>(
        'StandardPoolConverter',
        StandardPoolConverter__factory.prototype.deploy.length
    ),
    StandardPoolConverterFactory: deployOrAttach<StandardPoolConverterFactory, StandardPoolConverterFactory__factory>(
        'StandardPoolConverterFactory',
        StandardPoolConverterFactory__factory.prototype.deploy.length
    ),
    TestBancorNetwork: deployOrAttach<TestBancorNetwork, TestBancorNetwork__factory>(
        'TestBancorNetwork',
        TestBancorNetwork__factory.prototype.deploy.length
    ),
    TestCheckpointStore: deployOrAttach<TestCheckpointStore, TestCheckpointStore__factory>(
        'TestCheckpointStore',
        TestCheckpointStore__factory.prototype.deploy.length
    ),
    TestContractRegistryClient: deployOrAttach<TestContractRegistryClient, TestContractRegistryClient__factory>(
        'TestContractRegistryClient',
        TestContractRegistryClient__factory.prototype.deploy.length
    ),
    TestConverterFactory: deployOrAttach<TestConverterFactory, TestConverterFactory__factory>(
        'TestConverterFactory',
        TestConverterFactory__factory.prototype.deploy.length
    ),
    TestConverterRegistry: deployOrAttach<TestConverterRegistry, TestConverterRegistry__factory>(
        'TestConverterRegistry',
        TestConverterRegistry__factory.prototype.deploy.length
    ),
    TestLiquidityProtection: deployOrAttach<TestLiquidityProtection, TestLiquidityProtection__factory>(
        'TestLiquidityProtection',
        TestLiquidityProtection__factory.prototype.deploy.length
    ),
    TestMathEx: deployOrAttach<TestMathEx, TestMathEx__factory>(
        'TestMathEx',
        TestMathEx__factory.prototype.deploy.length
    ),
    TestNonStandardToken: deployOrAttach<TestNonStandardToken, TestNonStandardToken__factory>(
        'TestNonStandardToken',
        TestNonStandardToken__factory.prototype.deploy.length
    ),
    TestReserveToken: deployOrAttach<TestReserveToken, TestReserveToken__factory>(
        'TestReserveToken',
        TestReserveToken__factory.prototype.deploy.length
    ),
    TestSafeERC20Ex: deployOrAttach<TestSafeERC20Ex, TestSafeERC20Ex__factory>(
        'TestSafeERC20Ex',
        TestSafeERC20Ex__factory.prototype.deploy.length
    ),
    TestStakingRewards: deployOrAttach<TestStakingRewards, TestStakingRewards__factory>(
        'TestStakingRewards',
        TestStakingRewards__factory.prototype.deploy.length
    ),
    TestStakingRewardsStore: deployOrAttach<TestStakingRewardsStore, TestStakingRewardsStore__factory>(
        'TestStakingRewardsStore',
        TestStakingRewardsStore__factory.prototype.deploy.length
    ),
    TestStandardPoolConverter: deployOrAttach<TestStandardPoolConverter, TestStandardPoolConverter__factory>(
        'TestStandardPoolConverter',
        TestStandardPoolConverter__factory.prototype.deploy.length
    ),
    TestStandardPoolConverterFactory: deployOrAttach<
        TestStandardPoolConverterFactory,
        TestStandardPoolConverterFactory__factory
    >('TestStandardPoolConverterFactory', TestStandardPoolConverterFactory__factory.prototype.deploy.length),
    TestStandardToken: deployOrAttach<TestStandardToken, TestStandardToken__factory>(
        'TestStandardToken',
        TestStandardToken__factory.prototype.deploy.length
    ),
    TestTokenGovernance: deployOrAttach<TestTokenGovernance, TestTokenGovernance__factory>(
        'TestTokenGovernance',
        TestTokenGovernance__factory.prototype.deploy.length
    ),
    TestTypedConverterAnchorFactory: deployOrAttach<
        TestTypedConverterAnchorFactory,
        TestTypedConverterAnchorFactory__factory
    >('TestTypedConverterAnchorFactory', TestTypedConverterAnchorFactory__factory.prototype.deploy.length),
    TokenGovernance: deployOrAttach<TokenGovernance, TokenGovernance__factory>(
        'TokenGovernance',
        TokenGovernance__factory.prototype.deploy.length
    ),
    TokenHolder: deployOrAttach<TokenHolder, TokenHolder__factory>(
        'TokenHolder',
        TokenHolder__factory.prototype.deploy.length
    ),
    VortexBurner: deployOrAttach<VortexBurner, VortexBurner__factory>(
        'VortexBurner',
        VortexBurner__factory.prototype.deploy.length
    )
};
