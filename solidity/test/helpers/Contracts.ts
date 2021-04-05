import { Signer } from '@ethersproject/abstract-signer';
import { Contract, ContractFactory } from '@ethersproject/contracts';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { ethers } from 'hardhat';

import {
    BancorFormula,
    BancorFormula__factory,
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
    ConverterBase,
    ConverterBase__factory,
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
    FixedRatePoolConverter,
    FixedRatePoolConverterFactory,
    FixedRatePoolConverterFactory__factory,
    FixedRatePoolConverter__factory,
    LiquidityPoolV1Converter,
    LiquidityPoolV1ConverterFactory,
    LiquidityPoolV1ConverterFactory__factory,
    LiquidityPoolV1Converter__factory,
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
    TestBancorFormula,
    TestBancorFormula__factory,
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
    TestFixedRatePoolConverter,
    TestFixedRatePoolConverter__factory,
    TestLiquidityPoolV1Converter,
    TestLiquidityPoolV1ConverterFactory,
    TestLiquidityPoolV1ConverterFactory__factory,
    TestLiquidityPoolV1Converter__factory,
    TestLiquidityProtection,
    TestLiquidityProtectionEventsSubscriber,
    TestLiquidityProtectionEventsSubscriber__factory,
    TestLiquidityProtection__factory,
    TestMathEx,
    TestMathEx__factory,
    TestNonStandardToken,
    TestNonStandardToken__factory,
    TestReentrancyGuard,
    TestReentrancyGuardAttacker,
    TestReentrancyGuardAttacker__factory,
    TestReentrancyGuard__factory,
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
    Whitelist,
    Whitelist__factory,
    XTransferRerouter,
    XTransferRerouter__factory
} from '../../../typechain';

let contractStore: { [key: string]: ContractFactory } = {};

const deployContract = async <ParamsTypes extends typeof ContractFactory.prototype.deploy, T extends Promise<Contract>>(
    contractName: string,
    argsNumber: number,
    args: Parameters<ParamsTypes>
): Promise<T> => {
    let signer: SignerWithAddress = (await ethers.getSigners())[0];

    // If full arguments then last arg is override
    if (argsNumber == args.length) {
        let overrides = args.pop();
        if (overrides != {} && overrides.from) {
            signer = await ethers.getSigner(overrides.from);
        }
    }

    let signerAddress = await signer.getAddress();
    if (contractStore[contractName + signerAddress] === undefined) {
        contractStore[contractName + signerAddress] = await ethers.getContractFactory(contractName, signer);
    }

    return args === undefined || args.length === 0
        ? await contractStore[contractName + signerAddress].deploy()
        : await contractStore[contractName + signerAddress].deploy(...args);
};

const attachContract = async <T extends Promise<Contract>>(
    contractName: string,
    address: string,
    signer?: SignerWithAddress
): Promise<T> => {
    return await ethers.getContractAt(contractName, address, signer);
};

const deployOrAttach = <T extends Contract, ParamsTypes extends typeof ContractFactory.prototype.deploy>(
    contractName: string,
    argsNumber: number
) => {
    return {
        deploy: async (...parameters: Parameters<ParamsTypes>): Promise<T> => {
            return await deployContract<ParamsTypes, Promise<T>>(contractName, argsNumber, parameters);
        },
        attach: async (address: string, signer?: SignerWithAddress): Promise<T> => {
            return await attachContract<Promise<T>>(contractName, address, signer);
        }
    };
};

const attachOnly = <T extends Contract>(contractName: string) => {
    return {
        attach: async (address: string, signer?: SignerWithAddress): Promise<T> => {
            return await attachContract<Promise<T>>(contractName, address, signer);
        }
    };
};

export type ContractsType =
    | 'TestBancorFormula'
    | 'BancorNetwork'
    | 'StandardPoolConverterFactory'
    | 'LiquidityPoolV1Converter'
    | 'StandardPoolConverter'
    | 'FixedRatePoolConverter'
    | 'LiquidityPoolV1ConverterFactory'
    | 'FixedRatePoolConverterFactory';

export default {
    TestBancorFormula: deployOrAttach<TestBancorFormula, typeof TestBancorFormula__factory.prototype.deploy>(
        'TestBancorFormula',
        TestBancorFormula__factory.prototype.deploy.length
    ),
    BancorNetwork: deployOrAttach<BancorNetwork, typeof BancorNetwork__factory.prototype.deploy>(
        'BancorNetwork',
        BancorNetwork__factory.prototype.deploy.length
    ),
    BancorFormula: deployOrAttach<BancorFormula, typeof BancorFormula__factory.prototype.deploy>(
        'BancorFormula',
        BancorFormula__factory.prototype.deploy.length
    ),
    NetworkSettings: deployOrAttach<NetworkSettings, typeof NetworkSettings__factory.prototype.deploy>(
        'NetworkSettings',
        NetworkSettings__factory.prototype.deploy.length
    ),
    ContractRegistry: deployOrAttach<ContractRegistry, typeof ContractRegistry__factory.prototype.deploy>(
        'ContractRegistry',
        ContractRegistry__factory.prototype.deploy.length
    ),
    ConverterRegistry: deployOrAttach<ConverterRegistry, typeof ConverterRegistry__factory.prototype.deploy>(
        'ConverterRegistry',
        ConverterRegistry__factory.prototype.deploy.length
    ),
    ConverterFactory: deployOrAttach<ConverterFactory, typeof ConverterFactory__factory.prototype.deploy>(
        'ConverterFactory',
        ConverterFactory__factory.prototype.deploy.length
    ),
    TestStandardToken: deployOrAttach<TestStandardToken, typeof TestStandardToken__factory.prototype.deploy>(
        'TestStandardToken',
        TestStandardToken__factory.prototype.deploy.length
    ),
    TestNonStandardToken: deployOrAttach<TestNonStandardToken, typeof TestNonStandardToken__factory.prototype.deploy>(
        'TestNonStandardToken',
        TestNonStandardToken__factory.prototype.deploy.length
    ),
    TestBancorNetwork: deployOrAttach<TestBancorNetwork, typeof TestBancorNetwork__factory.prototype.deploy>(
        'TestBancorNetwork',
        TestBancorNetwork__factory.prototype.deploy.length
    ),
    ConverterV27OrLowerWithFallback: deployOrAttach<
        ConverterV27OrLowerWithFallback,
        typeof ConverterV27OrLowerWithFallback__factory.prototype.deploy
    >('ConverterV27OrLowerWithFallback', ConverterV27OrLowerWithFallback__factory.prototype.deploy.length),
    ConverterV28OrHigherWithoutFallback: deployOrAttach<
        ConverterV28OrHigherWithoutFallback,
        typeof ConverterV28OrHigherWithoutFallback__factory.prototype.deploy
    >('ConverterV28OrHigherWithoutFallback', ConverterV28OrHigherWithoutFallback__factory.prototype.deploy.length),
    ConverterV28OrHigherWithFallback: deployOrAttach<
        ConverterV28OrHigherWithFallback,
        typeof ConverterV28OrHigherWithFallback__factory.prototype.deploy
    >('ConverterV28OrHigherWithFallback', ConverterV28OrHigherWithFallback__factory.prototype.deploy.length),
    LiquidityPoolV1Converter: deployOrAttach<
        LiquidityPoolV1Converter,
        typeof LiquidityPoolV1Converter__factory.prototype.deploy
    >('LiquidityPoolV1Converter', LiquidityPoolV1Converter__factory.prototype.deploy.length),
    TestCheckpointStore: deployOrAttach<TestCheckpointStore, typeof TestCheckpointStore__factory.prototype.deploy>(
        'TestCheckpointStore',
        TestCheckpointStore__factory.prototype.deploy.length
    ),
    DSToken: deployOrAttach<DSToken, typeof DSToken__factory.prototype.deploy>(
        'DSToken',
        DSToken__factory.prototype.deploy.length
    ),
    BancorX: deployOrAttach<BancorX, typeof BancorX__factory.prototype.deploy>(
        'BancorX',
        BancorX__factory.prototype.deploy.length
    ),
    TestContractRegistryClient: deployOrAttach<
        TestContractRegistryClient,
        typeof TestContractRegistryClient__factory.prototype.deploy
    >('TestContractRegistryClient', TestContractRegistryClient__factory.prototype.deploy.length),
    ConversionPathFinder: deployOrAttach<ConversionPathFinder, typeof ConversionPathFinder__factory.prototype.deploy>(
        'ConversionPathFinder',
        ConversionPathFinder__factory.prototype.deploy.length
    ),
    ConverterRegistryData: deployOrAttach<
        ConverterRegistryData,
        typeof ConverterRegistryData__factory.prototype.deploy
    >('ConverterRegistryData', ConverterRegistryData__factory.prototype.deploy.length),
    LiquidityPoolV1ConverterFactory: deployOrAttach<
        LiquidityPoolV1ConverterFactory,
        typeof LiquidityPoolV1ConverterFactory__factory.prototype.deploy
    >('LiquidityPoolV1ConverterFactory', LiquidityPoolV1ConverterFactory__factory.prototype.deploy.length),
    ConverterUpgrader: deployOrAttach<ConverterUpgrader, typeof ConverterUpgrader__factory.prototype.deploy>(
        'ConverterUpgrader',
        ConverterUpgrader__factory.prototype.deploy.length
    ),
    StandardPoolConverter: deployOrAttach<
        StandardPoolConverter,
        typeof StandardPoolConverter__factory.prototype.deploy
    >('StandardPoolConverter', StandardPoolConverter__factory.prototype.deploy.length),
    FixedRatePoolConverter: deployOrAttach<
        FixedRatePoolConverter,
        typeof FixedRatePoolConverter__factory.prototype.deploy
    >('FixedRatePoolConverter', FixedRatePoolConverter__factory.prototype.deploy.length),
    StandardPoolConverterFactory: deployOrAttach<
        StandardPoolConverterFactory,
        typeof StandardPoolConverterFactory__factory.prototype.deploy
    >('StandardPoolConverterFactory', StandardPoolConverterFactory__factory.prototype.deploy.length),
    FixedRatePoolConverterFactory: deployOrAttach<
        FixedRatePoolConverterFactory,
        typeof FixedRatePoolConverterFactory__factory.prototype.deploy
    >('FixedRatePoolConverterFactory', FixedRatePoolConverterFactory__factory.prototype.deploy.length),
    TestTypedConverterAnchorFactory: deployOrAttach<
        TestTypedConverterAnchorFactory,
        typeof TestTypedConverterAnchorFactory__factory.prototype.deploy
    >('TestTypedConverterAnchorFactory', TestTypedConverterAnchorFactory__factory.prototype.deploy.length),
    TestConverterFactory: deployOrAttach<TestConverterFactory, typeof TestConverterFactory__factory.prototype.deploy>(
        'TestConverterFactory',
        TestConverterFactory__factory.prototype.deploy.length
    ),
    TestConverterRegistry: deployOrAttach<
        TestConverterRegistry,
        typeof TestConverterRegistry__factory.prototype.deploy
    >('TestConverterRegistry', TestConverterRegistry__factory.prototype.deploy.length),
    TestFixedRatePoolConverter: deployOrAttach<
        TestFixedRatePoolConverter,
        typeof TestFixedRatePoolConverter__factory.prototype.deploy
    >('TestFixedRatePoolConverter', TestFixedRatePoolConverter__factory.prototype.deploy.length),
    Whitelist: deployOrAttach<Whitelist, typeof Whitelist__factory.prototype.deploy>(
        'Whitelist',
        Whitelist__factory.prototype.deploy.length
    ),
    TestLiquidityPoolV1Converter: deployOrAttach<
        TestLiquidityPoolV1Converter,
        typeof TestLiquidityPoolV1Converter__factory.prototype.deploy
    >('TestLiquidityPoolV1Converter', TestLiquidityPoolV1Converter__factory.prototype.deploy.length),
    TestLiquidityPoolV1ConverterFactory: deployOrAttach<
        TestLiquidityPoolV1ConverterFactory,
        typeof TestLiquidityPoolV1ConverterFactory__factory.prototype.deploy
    >('TestLiquidityPoolV1ConverterFactory', TestLiquidityPoolV1ConverterFactory__factory.prototype.deploy.length),
    TestStandardPoolConverterFactory: deployOrAttach<
        TestStandardPoolConverterFactory,
        typeof TestStandardPoolConverterFactory__factory.prototype.deploy
    >('TestStandardPoolConverterFactory', TestStandardPoolConverterFactory__factory.prototype.deploy.length),
    TestTokenGovernance: deployOrAttach<TestTokenGovernance, typeof TestTokenGovernance__factory.prototype.deploy>(
        'TestTokenGovernance',
        TestTokenGovernance__factory.prototype.deploy.length
    ),
    LiquidityProtectionSettings: deployOrAttach<
        LiquidityProtectionSettings,
        typeof LiquidityProtectionSettings__factory.prototype.deploy
    >('LiquidityProtectionSettings', LiquidityProtectionSettings__factory.prototype.deploy.length),
    LiquidityProtectionStore: deployOrAttach<
        LiquidityProtectionStore,
        typeof LiquidityProtectionStore__factory.prototype.deploy
    >('LiquidityProtectionStore', LiquidityProtectionStore__factory.prototype.deploy.length),
    LiquidityProtectionStats: deployOrAttach<
        LiquidityProtectionStats,
        typeof LiquidityProtectionStats__factory.prototype.deploy
    >('LiquidityProtectionStats', LiquidityProtectionStats__factory.prototype.deploy.length),
    LiquidityProtectionSystemStore: deployOrAttach<
        LiquidityProtectionSystemStore,
        typeof LiquidityProtectionSystemStore__factory.prototype.deploy
    >('LiquidityProtectionSystemStore', LiquidityProtectionSystemStore__factory.prototype.deploy.length),
    TestLiquidityProtection: deployOrAttach<
        TestLiquidityProtection,
        typeof TestLiquidityProtection__factory.prototype.deploy
    >('TestLiquidityProtection', TestLiquidityProtection__factory.prototype.deploy.length),
    TokenHolder: deployOrAttach<TokenHolder, typeof TokenHolder__factory.prototype.deploy>(
        'TokenHolder',
        TokenHolder__factory.prototype.deploy.length
    ),
    TestLiquidityProtectionEventsSubscriber: deployOrAttach<
        TestLiquidityProtectionEventsSubscriber,
        typeof TestLiquidityProtectionEventsSubscriber__factory.prototype.deploy
    >(
        'TestLiquidityProtectionEventsSubscriber',
        TestLiquidityProtectionEventsSubscriber__factory.prototype.deploy.length
    ),
    TestStandardPoolConverter: deployOrAttach<
        TestStandardPoolConverter,
        typeof TestStandardPoolConverter__factory.prototype.deploy
    >('TestStandardPoolConverter', TestStandardPoolConverter__factory.prototype.deploy.length),
    TokenGovernance: deployOrAttach<TokenGovernance, typeof TokenGovernance__factory.prototype.deploy>(
        'TokenGovernance',
        TokenGovernance__factory.prototype.deploy.length
    ),
    CheckpointStore: deployOrAttach<CheckpointStore, typeof CheckpointStore__factory.prototype.deploy>(
        'CheckpointStore',
        CheckpointStore__factory.prototype.deploy.length
    ),
    LiquidityProtection: deployOrAttach<LiquidityProtection, typeof LiquidityProtection__factory.prototype.deploy>(
        'LiquidityProtection',
        LiquidityProtection__factory.prototype.deploy.length
    ),
    TestMathEx: deployOrAttach<TestMathEx, typeof TestMathEx__factory.prototype.deploy>(
        'TestMathEx',
        TestMathEx__factory.prototype.deploy.length
    ),
    Owned: deployOrAttach<Owned, typeof Owned__factory.prototype.deploy>(
        'Owned',
        Owned__factory.prototype.deploy.length
    ),
    TestReentrancyGuardAttacker: deployOrAttach<
        TestReentrancyGuardAttacker,
        typeof TestReentrancyGuardAttacker__factory.prototype.deploy
    >('TestReentrancyGuardAttacker', TestReentrancyGuardAttacker__factory.prototype.deploy.length),
    TestReentrancyGuard: deployOrAttach<TestReentrancyGuard, typeof TestReentrancyGuard__factory.prototype.deploy>(
        'TestReentrancyGuard',
        TestReentrancyGuard__factory.prototype.deploy.length
    ),
    XTransferRerouter: deployOrAttach<XTransferRerouter, typeof XTransferRerouter__factory.prototype.deploy>(
        'XTransferRerouter',
        XTransferRerouter__factory.prototype.deploy.length
    ),
    ConverterV27OrLowerWithoutFallback: deployOrAttach<any, typeof TmpFunc>(
        'ConverterV27OrLowerWithoutFallback',
        NetworkSettings__factory.prototype.deploy.length
    ),

    /////////////////
    // Attach only //
    /////////////////
    ConverterBase: attachOnly<ConverterBase>('ConverterBase')
};

//
const TmpFunc = (): any => {};
