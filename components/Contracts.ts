import { Signer } from '@ethersproject/abstract-signer';
import { Contract as OldContract, ContractFactory, Overrides as OldOverrides } from '@ethersproject/contracts';
import { ethers } from 'hardhat';
import {
    BancorNetwork__factory,
    BancorX__factory,
    CheckpointStore__factory,
    ContractRegistry__factory,
    ConversionPathFinder__factory,
    ConverterFactory__factory,
    ConverterRegistryData__factory,
    ConverterRegistry__factory,
    ConverterUpgrader__factory,
    ConverterV27OrLowerWithFallback__factory,
    ConverterV28OrHigherWithFallback__factory,
    ConverterV28OrHigherWithoutFallback__factory,
    DSToken__factory,
    ERC20__factory,
    LiquidityProtectionSettings__factory,
    LiquidityProtectionStats__factory,
    LiquidityProtectionStore__factory,
    LiquidityProtectionSystemStore__factory,
    LiquidityProtection__factory,
    NetworkSettings__factory,
    Owned__factory,
    StakingRewardsStore__factory,
    StakingRewards__factory,
    StandardPoolConverterFactory__factory,
    StandardPoolConverter__factory,
    TestBancorNetwork__factory,
    TestCheckpointStore__factory,
    TestContractRegistryClient__factory,
    TestConverterFactory__factory,
    TestConverterRegistry__factory,
    TestLiquidityProtection__factory,
    TestLiquidityProvisionEventsSubscriber__factory,
    TestMathEx__factory,
    TestNonStandardToken__factory,
    TestReserveToken__factory,
    TestSafeERC20Ex__factory,
    TestStakingRewardsStore__factory,
    TestStakingRewards__factory,
    TestStandardPoolConverterFactory__factory,
    TestStandardPoolConverter__factory,
    TestStandardToken__factory,
    TestTokenGovernance__factory,
    TestTransferPositionCallback__factory,
    TestTypedConverterAnchorFactory__factory,
    TokenGovernance__factory,
    TokenHolder__factory,
    VortexBurner__factory
} from '../typechain';

// Replace the type of the last param of a function
type LastIndex<T extends readonly any[]> = ((...t: T) => void) extends (x: any, ...r: infer R) => void
    ? Exclude<keyof T, keyof R>
    : never;
type ReplaceLastParam<TParams extends readonly any[], TReplace> = {
    [K in keyof TParams]: K extends LastIndex<TParams> ? TReplace : TParams[K];
};
type ReplaceLast<F, TReplace> = F extends (...args: infer T) => infer R
    ? (...args: ReplaceLastParam<T, TReplace>) => R
    : never;

type AsyncReturnType<T extends (...args: any) => any> = T extends (...args: any) => Promise<infer U>
    ? U
    : T extends (...args: any) => infer U
    ? U
    : any;

export type Overrides = OldOverrides & { from?: Signer };

export type ContractName = { __contractName__: string };
export type Contract = OldContract & ContractName;

const deployOrAttach = <F extends ContractFactory>(contractName: string, passedSigner?: Signer) => {
    type ParamsTypes = ReplaceLast<F['deploy'], Overrides>;

    return {
        deploy: async (...args: Parameters<ParamsTypes>): Promise<AsyncReturnType<F['deploy']> & ContractName> => {
            let defaultSigner = passedSigner ? passedSigner : (await ethers.getSigners())[0];

            const deployParamLength = (await ethers.getContractFactory(contractName)).deploy.length;

            // If similar length, override the last param
            if (args.length != 0 && args.length === deployParamLength) {
                const overrides = args.pop() as Overrides;

                const contractFactory = await ethers.getContractFactory(
                    contractName,
                    overrides.from ? overrides.from : defaultSigner
                );
                delete overrides.from;

                const contract = (await contractFactory.deploy(...args, overrides)) as AsyncReturnType<F['deploy']> &
                    ContractName;
                contract.__contractName__ = contractName;
                return contract;
            }
            const contract = (await (
                await ethers.getContractFactory(contractName, defaultSigner)
            ).deploy(...args)) as AsyncReturnType<F['deploy']> & ContractName;
            contract.__contractName__ = contractName;
            return contract;
        },
        attach: attachOnly<F>(contractName, passedSigner).attach
    };
};

const attachOnly = <F extends ContractFactory>(contractName: string, passedSigner?: Signer) => {
    return {
        attach: async (address: string, signer?: Signer): Promise<AsyncReturnType<F['deploy']> & ContractName> => {
            let defaultSigner = passedSigner ? passedSigner : (await ethers.getSigners())[0];
            const contract = (await ethers.getContractAt(
                contractName,
                address,
                signer ? signer : defaultSigner
            )) as AsyncReturnType<F['deploy']> & ContractName;
            contract.__contractName__ = contractName;
            return contract;
        }
    };
};

const getContracts = (signer?: Signer) => {
    return {
        // Link every contract to a default signer
        connect: (signer: Signer) => getContracts(signer),

        BancorNetwork: deployOrAttach<BancorNetwork__factory>('BancorNetwork', signer),
        BancorX: deployOrAttach<BancorX__factory>('BancorX', signer),
        CheckpointStore: deployOrAttach<CheckpointStore__factory>('CheckpointStore', signer),
        ContractRegistry: deployOrAttach<ContractRegistry__factory>('ContractRegistry', signer),
        ConversionPathFinder: deployOrAttach<ConversionPathFinder__factory>('ConversionPathFinder', signer),
        ConverterFactory: deployOrAttach<ConverterFactory__factory>('ConverterFactory', signer),
        ConverterRegistry: deployOrAttach<ConverterRegistry__factory>('ConverterRegistry', signer),
        ConverterRegistryData: deployOrAttach<ConverterRegistryData__factory>('ConverterRegistryData', signer),
        ConverterUpgrader: deployOrAttach<ConverterUpgrader__factory>('ConverterUpgrader', signer),
        ConverterV27OrLowerWithFallback: deployOrAttach<ConverterV27OrLowerWithFallback__factory>(
            'ConverterV27OrLowerWithFallback',
            signer
        ),
        ConverterV27OrLowerWithoutFallback: deployOrAttach<ContractFactory>(
            'ConverterV27OrLowerWithoutFallback',
            signer
        ),
        ConverterV28OrHigherWithFallback: deployOrAttach<ConverterV28OrHigherWithFallback__factory>(
            'ConverterV28OrHigherWithFallback',
            signer
        ),
        ConverterV28OrHigherWithoutFallback: deployOrAttach<ConverterV28OrHigherWithoutFallback__factory>(
            'ConverterV28OrHigherWithoutFallback',
            signer
        ),
        DSToken: deployOrAttach<DSToken__factory>('DSToken', signer),
        ERC20: deployOrAttach<ERC20__factory>('ERC20', signer),
        FixedRatePoolConverter: deployOrAttach('FixedRatePoolConverter', signer),
        FixedRatePoolConverterFactory: deployOrAttach('FixedRatePoolConverterFactory', signer),
        IConverterAnchor: attachOnly<ContractFactory>('IConverterAnchor', signer),
        LiquidityProtection: deployOrAttach<LiquidityProtection__factory>('LiquidityProtection', signer),
        LiquidityProtectionSettings: deployOrAttach<LiquidityProtectionSettings__factory>(
            'LiquidityProtectionSettings',
            signer
        ),
        LiquidityProtectionStats: deployOrAttach<LiquidityProtectionStats__factory>('LiquidityProtectionStats', signer),
        LiquidityProtectionStore: deployOrAttach<LiquidityProtectionStore__factory>('LiquidityProtectionStore', signer),
        LiquidityProtectionSystemStore: deployOrAttach<LiquidityProtectionSystemStore__factory>(
            'LiquidityProtectionSystemStore',
            signer
        ),
        NetworkSettings: deployOrAttach<NetworkSettings__factory>('NetworkSettings', signer),
        Owned: deployOrAttach<Owned__factory>('Owned', signer),
        StakingRewards: deployOrAttach<StakingRewards__factory>('StakingRewards', signer),
        StakingRewardsStore: deployOrAttach<StakingRewardsStore__factory>('StakingRewardsStore', signer),
        StandardPoolConverter: deployOrAttach<StandardPoolConverter__factory>('StandardPoolConverter', signer),
        StandardPoolConverterFactory: deployOrAttach<StandardPoolConverterFactory__factory>(
            'StandardPoolConverterFactory',
            signer
        ),
        TestBancorNetwork: deployOrAttach<TestBancorNetwork__factory>('TestBancorNetwork', signer),
        TestCheckpointStore: deployOrAttach<TestCheckpointStore__factory>('TestCheckpointStore', signer),
        TestContractRegistryClient: deployOrAttach<TestContractRegistryClient__factory>(
            'TestContractRegistryClient',
            signer
        ),
        TestConverterFactory: deployOrAttach<TestConverterFactory__factory>('TestConverterFactory', signer),
        TestConverterRegistry: deployOrAttach<TestConverterRegistry__factory>('TestConverterRegistry', signer),
        TestLiquidityProtection: deployOrAttach<TestLiquidityProtection__factory>('TestLiquidityProtection', signer),
        TestLiquidityProvisionEventsSubscriber: deployOrAttach<TestLiquidityProvisionEventsSubscriber__factory>(
            'TestLiquidityProvisionEventsSubscriber',
            signer
        ),
        TestMathEx: deployOrAttach<TestMathEx__factory>('TestMathEx', signer),
        TestNonStandardToken: deployOrAttach<TestNonStandardToken__factory>('TestNonStandardToken', signer),
        TestReserveToken: deployOrAttach<TestReserveToken__factory>('TestReserveToken', signer),
        TestSafeERC20Ex: deployOrAttach<TestSafeERC20Ex__factory>('TestSafeERC20Ex', signer),
        TestStakingRewards: deployOrAttach<TestStakingRewards__factory>('TestStakingRewards', signer),
        TestStakingRewardsStore: deployOrAttach<TestStakingRewardsStore__factory>('TestStakingRewardsStore', signer),
        TestStandardPoolConverter: deployOrAttach<TestStandardPoolConverter__factory>(
            'TestStandardPoolConverter',
            signer
        ),
        TestStandardPoolConverterFactory: deployOrAttach<TestStandardPoolConverterFactory__factory>(
            'TestStandardPoolConverterFactory',
            signer
        ),
        TestStandardToken: deployOrAttach<TestStandardToken__factory>('TestStandardToken', signer),
        TestTokenGovernance: deployOrAttach<TestTokenGovernance__factory>('TestTokenGovernance', signer),
        TestTransferPositionCallback: deployOrAttach<TestTransferPositionCallback__factory>(
            'TestTransferPositionCallback',
            signer
        ),
        TestTypedConverterAnchorFactory: deployOrAttach<TestTypedConverterAnchorFactory__factory>(
            'TestTypedConverterAnchorFactory',
            signer
        ),
        TokenGovernance: deployOrAttach<TokenGovernance__factory>('TokenGovernance', signer),
        TokenHolder: deployOrAttach<TokenHolder__factory>('TokenHolder', signer),
        VortexBurner: deployOrAttach<VortexBurner__factory>('VortexBurner', signer)
    };
};

export default getContracts();
