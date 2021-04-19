import { Contract, ContractFactory } from '@ethersproject/contracts';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
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
    TestCall,
    TestCall__factory,
    TestCheckpointStore,
    TestCheckpointStore__factory,
    TestContractRegistryClient,
    TestContractRegistryClient__factory,
    TestConverterFactory,
    TestConverterFactory__factory,
    TestConverterRegistry,
    TestConverterRegistry__factory,
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
    TestReserveToken,
    TestReserveToken__factory,
    TestSafeERC20Ex,
    TestSafeERC20Ex__factory,
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
    VortexBurner__factory,
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
        if (overrides != undefined && overrides != {} && overrides.from) {
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
): ContractType => {
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

export type ContractType = {
    deploy: Function;
    attach: Function;
};

export default {
    BancorNetwork: deployOrAttach<BancorNetwork, typeof BancorNetwork__factory.prototype.deploy>(
        'BancorNetwork',
        BancorNetwork__factory.prototype.deploy.length
    ),
    //
    NetworkSettings: deployOrAttach<NetworkSettings, typeof NetworkSettings__factory.prototype.deploy>(
        'NetworkSettings',
        NetworkSettings__factory.prototype.deploy.length
    ),
    //
    ContractRegistry: deployOrAttach<ContractRegistry, typeof ContractRegistry__factory.prototype.deploy>(
        'ContractRegistry',
        ContractRegistry__factory.prototype.deploy.length
    ),
    //
    ConverterRegistry: deployOrAttach<ConverterRegistry, typeof ConverterRegistry__factory.prototype.deploy>(
        'ConverterRegistry',
        ConverterRegistry__factory.prototype.deploy.length
    ),
    //
    ConverterFactory: deployOrAttach<ConverterFactory, typeof ConverterFactory__factory.prototype.deploy>(
        'ConverterFactory',
        ConverterFactory__factory.prototype.deploy.length
    ),
    //
    TestStandardToken: deployOrAttach<TestStandardToken, typeof TestStandardToken__factory.prototype.deploy>(
        'TestStandardToken',
        TestStandardToken__factory.prototype.deploy.length
    ),
    //
    TestNonStandardToken: deployOrAttach<TestNonStandardToken, typeof TestNonStandardToken__factory.prototype.deploy>(
        'TestNonStandardToken',
        TestNonStandardToken__factory.prototype.deploy.length
    ),
    //
    TestBancorNetwork: deployOrAttach<TestBancorNetwork, typeof TestBancorNetwork__factory.prototype.deploy>(
        'TestBancorNetwork',
        TestBancorNetwork__factory.prototype.deploy.length
    ),
    //
    ConverterV27OrLowerWithFallback: deployOrAttach<
        ConverterV27OrLowerWithFallback,
        typeof ConverterV27OrLowerWithFallback__factory.prototype.deploy
    >('ConverterV27OrLowerWithFallback', ConverterV27OrLowerWithFallback__factory.prototype.deploy.length),
    //
    ConverterV28OrHigherWithoutFallback: deployOrAttach<
        ConverterV28OrHigherWithoutFallback,
        typeof ConverterV28OrHigherWithoutFallback__factory.prototype.deploy
    >('ConverterV28OrHigherWithoutFallback', ConverterV28OrHigherWithoutFallback__factory.prototype.deploy.length),
    //
    ConverterV28OrHigherWithFallback: deployOrAttach<
        ConverterV28OrHigherWithFallback,
        typeof ConverterV28OrHigherWithFallback__factory.prototype.deploy
    >('ConverterV28OrHigherWithFallback', ConverterV28OrHigherWithFallback__factory.prototype.deploy.length),
    //
    TestCheckpointStore: deployOrAttach<TestCheckpointStore, typeof TestCheckpointStore__factory.prototype.deploy>(
        'TestCheckpointStore',
        TestCheckpointStore__factory.prototype.deploy.length
    ),
    //
    DSToken: deployOrAttach<DSToken, typeof DSToken__factory.prototype.deploy>(
        'DSToken',
        DSToken__factory.prototype.deploy.length
    ),
    //
    BancorX: deployOrAttach<BancorX, typeof BancorX__factory.prototype.deploy>(
        'BancorX',
        BancorX__factory.prototype.deploy.length
    ),
    //
    TestContractRegistryClient: deployOrAttach<
        TestContractRegistryClient,
        typeof TestContractRegistryClient__factory.prototype.deploy
    >('TestContractRegistryClient', TestContractRegistryClient__factory.prototype.deploy.length),
    //
    ConversionPathFinder: deployOrAttach<ConversionPathFinder, typeof ConversionPathFinder__factory.prototype.deploy>(
        'ConversionPathFinder',
        ConversionPathFinder__factory.prototype.deploy.length
    ),
    //
    ConverterRegistryData: deployOrAttach<
        ConverterRegistryData,
        typeof ConverterRegistryData__factory.prototype.deploy
    >('ConverterRegistryData', ConverterRegistryData__factory.prototype.deploy.length),
    //
    ConverterUpgrader: deployOrAttach<ConverterUpgrader, typeof ConverterUpgrader__factory.prototype.deploy>(
        'ConverterUpgrader',
        ConverterUpgrader__factory.prototype.deploy.length
    ),
    //
    StandardPoolConverter: deployOrAttach<
        StandardPoolConverter,
        typeof StandardPoolConverter__factory.prototype.deploy
    >('StandardPoolConverter', StandardPoolConverter__factory.prototype.deploy.length),
    //
    StandardPoolConverterFactory: deployOrAttach<
        StandardPoolConverterFactory,
        typeof StandardPoolConverterFactory__factory.prototype.deploy
    >('StandardPoolConverterFactory', StandardPoolConverterFactory__factory.prototype.deploy.length),
    //
    TestTypedConverterAnchorFactory: deployOrAttach<
        TestTypedConverterAnchorFactory,
        typeof TestTypedConverterAnchorFactory__factory.prototype.deploy
    >('TestTypedConverterAnchorFactory', TestTypedConverterAnchorFactory__factory.prototype.deploy.length),
    //
    TestConverterFactory: deployOrAttach<TestConverterFactory, typeof TestConverterFactory__factory.prototype.deploy>(
        'TestConverterFactory',
        TestConverterFactory__factory.prototype.deploy.length
    ),
    //
    TestConverterRegistry: deployOrAttach<
        TestConverterRegistry,
        typeof TestConverterRegistry__factory.prototype.deploy
    >('TestConverterRegistry', TestConverterRegistry__factory.prototype.deploy.length),
    //
    Whitelist: deployOrAttach<Whitelist, typeof Whitelist__factory.prototype.deploy>(
        'Whitelist',
        Whitelist__factory.prototype.deploy.length
    ),
    //
    TestStandardPoolConverterFactory: deployOrAttach<
        TestStandardPoolConverterFactory,
        typeof TestStandardPoolConverterFactory__factory.prototype.deploy
    >('TestStandardPoolConverterFactory', TestStandardPoolConverterFactory__factory.prototype.deploy.length),
    //
    TestTokenGovernance: deployOrAttach<TestTokenGovernance, typeof TestTokenGovernance__factory.prototype.deploy>(
        'TestTokenGovernance',
        TestTokenGovernance__factory.prototype.deploy.length
    ),
    //
    LiquidityProtectionSettings: deployOrAttach<
        LiquidityProtectionSettings,
        typeof LiquidityProtectionSettings__factory.prototype.deploy
    >('LiquidityProtectionSettings', LiquidityProtectionSettings__factory.prototype.deploy.length),
    //
    LiquidityProtectionStore: deployOrAttach<
        LiquidityProtectionStore,
        typeof LiquidityProtectionStore__factory.prototype.deploy
    >('LiquidityProtectionStore', LiquidityProtectionStore__factory.prototype.deploy.length),
    //
    LiquidityProtectionStats: deployOrAttach<
        LiquidityProtectionStats,
        typeof LiquidityProtectionStats__factory.prototype.deploy
    >('LiquidityProtectionStats', LiquidityProtectionStats__factory.prototype.deploy.length),
    //
    LiquidityProtectionSystemStore: deployOrAttach<
        LiquidityProtectionSystemStore,
        typeof LiquidityProtectionSystemStore__factory.prototype.deploy
    >('LiquidityProtectionSystemStore', LiquidityProtectionSystemStore__factory.prototype.deploy.length),
    //
    TestLiquidityProtection: deployOrAttach<
        TestLiquidityProtection,
        typeof TestLiquidityProtection__factory.prototype.deploy
    >('TestLiquidityProtection', TestLiquidityProtection__factory.prototype.deploy.length),
    //
    TokenHolder: deployOrAttach<TokenHolder, typeof TokenHolder__factory.prototype.deploy>(
        'TokenHolder',
        TokenHolder__factory.prototype.deploy.length
    ),
    //
    TestLiquidityProtectionEventsSubscriber: deployOrAttach<
        TestLiquidityProtectionEventsSubscriber,
        typeof TestLiquidityProtectionEventsSubscriber__factory.prototype.deploy
    >(
        'TestLiquidityProtectionEventsSubscriber',
        TestLiquidityProtectionEventsSubscriber__factory.prototype.deploy.length
    ),
    //
    TestStandardPoolConverter: deployOrAttach<
        TestStandardPoolConverter,
        typeof TestStandardPoolConverter__factory.prototype.deploy
    >('TestStandardPoolConverter', TestStandardPoolConverter__factory.prototype.deploy.length),
    //
    TokenGovernance: deployOrAttach<TokenGovernance, typeof TokenGovernance__factory.prototype.deploy>(
        'TokenGovernance',
        TokenGovernance__factory.prototype.deploy.length
    ),
    //
    CheckpointStore: deployOrAttach<CheckpointStore, typeof CheckpointStore__factory.prototype.deploy>(
        'CheckpointStore',
        CheckpointStore__factory.prototype.deploy.length
    ),
    //
    LiquidityProtection: deployOrAttach<LiquidityProtection, typeof LiquidityProtection__factory.prototype.deploy>(
        'LiquidityProtection',
        LiquidityProtection__factory.prototype.deploy.length
    ),
    //
    TestMathEx: deployOrAttach<TestMathEx, typeof TestMathEx__factory.prototype.deploy>(
        'TestMathEx',
        TestMathEx__factory.prototype.deploy.length
    ),
    //
    Owned: deployOrAttach<Owned, typeof Owned__factory.prototype.deploy>(
        'Owned',
        Owned__factory.prototype.deploy.length
    ),
    //
    TestReentrancyGuardAttacker: deployOrAttach<
        TestReentrancyGuardAttacker,
        typeof TestReentrancyGuardAttacker__factory.prototype.deploy
    >('TestReentrancyGuardAttacker', TestReentrancyGuardAttacker__factory.prototype.deploy.length),
    //
    TestReentrancyGuard: deployOrAttach<TestReentrancyGuard, typeof TestReentrancyGuard__factory.prototype.deploy>(
        'TestReentrancyGuard',
        TestReentrancyGuard__factory.prototype.deploy.length
    ),
    //
    XTransferRerouter: deployOrAttach<XTransferRerouter, typeof XTransferRerouter__factory.prototype.deploy>(
        'XTransferRerouter',
        XTransferRerouter__factory.prototype.deploy.length
    ),
    //
    ConverterV27OrLowerWithoutFallback: deployOrAttach<Contract, typeof ContractFactory.prototype.deploy>(
        'ConverterV27OrLowerWithoutFallback',
        ContractFactory.prototype.deploy.length
    ),
    //
    VortexBurner: deployOrAttach<VortexBurner, typeof VortexBurner__factory.prototype.deploy>(
        'VortexBurner',
        VortexBurner__factory.prototype.deploy.length
    ),
    //
    TestSafeERC20Ex: deployOrAttach<TestSafeERC20Ex, typeof TestSafeERC20Ex__factory.prototype.deploy>(
        'TestSafeERC20Ex',
        TestSafeERC20Ex__factory.prototype.deploy.length
    ),
    //
    TestReserveToken: deployOrAttach<TestReserveToken, typeof TestReserveToken__factory.prototype.deploy>(
        'TestReserveToken',
        TestReserveToken__factory.prototype.deploy.length
    ),
    //
    TestCall: deployOrAttach<TestCall, typeof TestCall__factory.prototype.deploy>(
        'TestCall',
        TestCall__factory.prototype.deploy.length
    ),

    // Attach Only
    IConverterAnchor: attachOnly<IConverterAnchor>('IConverterAnchor')
};
