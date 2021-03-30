import { Contract, ContractFactory } from '@ethersproject/contracts';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { ethers } from 'hardhat';

import {
    BancorFormula,
    BancorNetwork,
    BancorX,
    CheckpointStore,
    ContractRegistry,
    ConversionPathFinder,
    ConverterBase,
    ConverterFactory,
    ConverterRegistry,
    ConverterRegistryData,
    ConverterUpgrader,
    ConverterV27OrLowerWithFallback,
    ConverterV28OrHigherWithFallback,
    ConverterV28OrHigherWithoutFallback,
    DSToken,
    FixedRatePoolConverter,
    FixedRatePoolConverterFactory,
    LiquidityPoolV1Converter,
    LiquidityPoolV1ConverterFactory,
    LiquidityProtection,
    LiquidityProtectionSettings,
    LiquidityProtectionStats,
    LiquidityProtectionStore,
    LiquidityProtectionSystemStore,
    NetworkSettings,
    Owned,
    StandardPoolConverter,
    StandardPoolConverterFactory,
    TestBancorFormula,
    TestBancorNetwork,
    TestCheckpointStore,
    TestContractRegistryClient,
    TestConverterFactory,
    TestConverterRegistry,
    TestFixedRatePoolConverter,
    TestLiquidityPoolV1Converter,
    TestLiquidityPoolV1ConverterFactory,
    TestLiquidityProtection,
    TestLiquidityProtectionEventsSubscriber,
    TestMathEx,
    TestNonStandardToken,
    TestReentrancyGuard,
    TestReentrancyGuardAttacker,
    TestStandardPoolConverter,
    TestStandardPoolConverterFactory,
    TestStandardToken,
    TestTokenGovernance,
    TestTypedConverterAnchorFactory,
    TokenGovernance,
    TokenHolder,
    Whitelist,
    XTransferRerouter
} from '../../typechain';

let contractStore: { [key: string]: ContractFactory } = {};

const deployContract = async <T extends Promise<Contract>>(
    contractName: string,
    _signerOrArg: any = undefined,
    ...args: any[]
): Promise<T> => {
    let signer;

    if (typeof _signerOrArg === 'object') {
        if (_signerOrArg.constructor.name === 'SignerWithAddress') {
            signer = _signerOrArg;
        } else {
            signer = (await ethers.getSigners())[0];
            args.unshift(_signerOrArg);
        }
    } else {
        signer = (await ethers.getSigners())[0];
        if (_signerOrArg !== undefined) {
            args.unshift(_signerOrArg);
        }
    }

    if (contractStore[contractName + signer.address] === undefined) {
        contractStore[contractName + signer.address] = await ethers.getContractFactory(contractName);
    }

    return args !== undefined
        ? await contractStore[contractName + signer.address].deploy(...args)
        : await contractStore[contractName + signer.address].deploy();
};

const attachContract = async <T extends Promise<Contract>>(
    contractName: string,
    address: string,
    signer?: SignerWithAddress
): Promise<T> => {
    return await ethers.getContractAt(contractName, address, signer);
};

const deployOrAttach = <T extends Contract>(contractName: string) => {
    return {
        deploy: async (...args: any[]): Promise<T> => {
            return await deployContract<Promise<T>>(contractName, ...args);
        },
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
    TestBancorFormula: deployOrAttach<TestBancorFormula>('TestBancorFormula'),
    BancorNetwork: deployOrAttach<BancorNetwork>('BancorNetwork'),
    BancorFormula: deployOrAttach<BancorFormula>('BancorFormula'),
    NetworkSettings: deployOrAttach<NetworkSettings>('NetworkSettings'),
    ContractRegistry: deployOrAttach<ContractRegistry>('ContractRegistry'),
    ConverterRegistry: deployOrAttach<ConverterRegistry>('ConverterRegistry'),
    ConverterFactory: deployOrAttach<ConverterFactory>('ConverterFactory'),
    TestStandardToken: deployOrAttach<TestStandardToken>('TestStandardToken'),
    TestNonStandardToken: deployOrAttach<TestNonStandardToken>('TestNonStandardToken'),
    TestBancorNetwork: deployOrAttach<TestBancorNetwork>('TestBancorNetwork'),
    ConverterV27OrLowerWithFallback: deployOrAttach<ConverterV27OrLowerWithFallback>('ConverterV27OrLowerWithFallback'),
    ConverterV28OrHigherWithoutFallback: deployOrAttach<ConverterV28OrHigherWithoutFallback>(
        'ConverterV28OrHigherWithoutFallback'
    ),
    ConverterV28OrHigherWithFallback: deployOrAttach<ConverterV28OrHigherWithFallback>(
        'ConverterV28OrHigherWithFallback'
    ),
    LiquidityPoolV1Converter: deployOrAttach<LiquidityPoolV1Converter>('LiquidityPoolV1Converter'),
    TestCheckpointStore: deployOrAttach<TestCheckpointStore>('TestCheckpointStore'),
    DSToken: deployOrAttach<DSToken>('DSToken'),
    BancorX: deployOrAttach<BancorX>('BancorX'),
    TestContractRegistryClient: deployOrAttach<TestContractRegistryClient>('TestContractRegistryClient'),
    ConversionPathFinder: deployOrAttach<ConversionPathFinder>('ConversionPathFinder'),
    ConverterRegistryData: deployOrAttach<ConverterRegistryData>('ConverterRegistryData'),
    LiquidityPoolV1ConverterFactory: deployOrAttach<LiquidityPoolV1ConverterFactory>('LiquidityPoolV1ConverterFactory'),
    ConverterUpgrader: deployOrAttach<ConverterUpgrader>('ConverterUpgrader'),
    StandardPoolConverter: deployOrAttach<StandardPoolConverter>('StandardPoolConverter'),
    FixedRatePoolConverter: deployOrAttach<FixedRatePoolConverter>('FixedRatePoolConverter'),
    StandardPoolConverterFactory: deployOrAttach<StandardPoolConverterFactory>('StandardPoolConverterFactory'),
    FixedRatePoolConverterFactory: deployOrAttach<FixedRatePoolConverterFactory>('FixedRatePoolConverterFactory'),
    TestTypedConverterAnchorFactory: deployOrAttach<TestTypedConverterAnchorFactory>('TestTypedConverterAnchorFactory'),
    TestConverterFactory: deployOrAttach<TestConverterFactory>('TestConverterFactory'),
    TestConverterRegistry: deployOrAttach<TestConverterRegistry>('TestConverterRegistry'),
    TestFixedRatePoolConverter: deployOrAttach<TestFixedRatePoolConverter>('TestFixedRatePoolConverter'),
    Whitelist: deployOrAttach<Whitelist>('Whitelist'),
    TestLiquidityPoolV1Converter: deployOrAttach<TestLiquidityPoolV1Converter>('TestLiquidityPoolV1Converter'),
    TestLiquidityPoolV1ConverterFactory: deployOrAttach<TestLiquidityPoolV1ConverterFactory>(
        'TestLiquidityPoolV1ConverterFactory'
    ),
    TestStandardPoolConverterFactory: deployOrAttach<TestStandardPoolConverterFactory>(
        'TestStandardPoolConverterFactory'
    ),
    TestTokenGovernance: deployOrAttach<TestTokenGovernance>('TestTokenGovernance'),
    LiquidityProtectionSettings: deployOrAttach<LiquidityProtectionSettings>('LiquidityProtectionSettings'),
    LiquidityProtectionStore: deployOrAttach<LiquidityProtectionStore>('LiquidityProtectionStore'),
    LiquidityProtectionStats: deployOrAttach<LiquidityProtectionStats>('LiquidityProtectionStats'),
    LiquidityProtectionSystemStore: deployOrAttach<LiquidityProtectionSystemStore>('LiquidityProtectionSystemStore'),
    TestLiquidityProtection: deployOrAttach<TestLiquidityProtection>('TestLiquidityProtection'),
    TokenHolder: deployOrAttach<TokenHolder>('TokenHolder'),
    TestLiquidityProtectionEventsSubscriber: deployOrAttach<TestLiquidityProtectionEventsSubscriber>(
        'TestLiquidityProtectionEventsSubscriber'
    ),
    TestStandardPoolConverter: deployOrAttach<TestStandardPoolConverter>('TestStandardPoolConverter'),
    TokenGovernance: deployOrAttach<TokenGovernance>('TokenGovernance'),
    CheckpointStore: deployOrAttach<CheckpointStore>('CheckpointStore'),
    LiquidityProtection: deployOrAttach<LiquidityProtection>('LiquidityProtection'),
    TestMathEx: deployOrAttach<TestMathEx>('TestMathEx'),
    Owned: deployOrAttach<Owned>('Owned'),
    TestReentrancyGuardAttacker: deployOrAttach<TestReentrancyGuardAttacker>('TestReentrancyGuardAttacker'),
    TestReentrancyGuard: deployOrAttach<TestReentrancyGuard>('TestReentrancyGuard'),
    XTransferRerouter: deployOrAttach<XTransferRerouter>('XTransferRerouter'),
    ConverterBase: deployOrAttach<ConverterBase>('ConverterBase')
};
