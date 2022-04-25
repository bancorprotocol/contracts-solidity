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
    ConverterV27OrLowerWithoutFallback__factory,
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
import { ContractFactory, Signer } from 'ethers';
import { ethers } from 'hardhat';

export type AsyncReturnType<T extends (...args: any) => any> = T extends (...args: any) => Promise<infer U>
    ? U
    : T extends (...args: any) => infer U
    ? U
    : any;

export type Contract<F extends ContractFactory> = AsyncReturnType<F['deploy']>;

export interface ContractBuilder<F extends ContractFactory> {
    metadata: {
        contractName: string;
        bytecode: string;
    };
    deploy(...args: Parameters<F['deploy']>): Promise<Contract<F>>;
    attach(address: string, signer?: Signer): Promise<Contract<F>>;
}

export type FactoryConstructor<F extends ContractFactory> = {
    new (signer?: Signer): F;
    abi: unknown;
    bytecode: string;
};

export const deployOrAttach = <F extends ContractFactory>(
    contractName: string,
    FactoryConstructor: FactoryConstructor<F>,
    initialSigner?: Signer
): ContractBuilder<F> => {
    return {
        metadata: {
            contractName,
            bytecode: FactoryConstructor.bytecode
        },
        deploy: async (...args: Parameters<F['deploy']>): Promise<Contract<F>> => {
            const defaultSigner = initialSigner || (await ethers.getSigners())[0];

            return new FactoryConstructor(defaultSigner).deploy(...(args || [])) as Promise<Contract<F>>;
        },
        attach: attachOnly<F>(FactoryConstructor, initialSigner).attach
    };
};

export const attachOnly = <F extends ContractFactory>(
    FactoryConstructor: FactoryConstructor<F>,
    initialSigner?: Signer
) => {
    return {
        attach: async (address: string, signer?: Signer): Promise<Contract<F>> => {
            const defaultSigner = initialSigner || (await ethers.getSigners())[0];
            return new FactoryConstructor(signer || defaultSigner).attach(address) as Contract<F>;
        }
    };
};

const getContracts = (signer?: Signer) => {
    return {
        // Link every contract to a default signer
        connect: (signer: Signer) => getContracts(signer),

        BancorNetwork: deployOrAttach('BancorNetwork', BancorNetwork__factory, signer),
        BancorX: deployOrAttach('BancorX', BancorX__factory, signer),
        CheckpointStore: deployOrAttach('CheckpointStore', CheckpointStore__factory, signer),
        ContractRegistry: deployOrAttach('ContractRegistry', ContractRegistry__factory, signer),
        ConversionPathFinder: deployOrAttach('ConversionPathFinder', ConversionPathFinder__factory, signer),
        ConverterFactory: deployOrAttach('ConverterFactory', ConverterFactory__factory, signer),
        ConverterRegistry: deployOrAttach('ConverterRegistry', ConverterRegistry__factory, signer),
        ConverterRegistryData: deployOrAttach('ConverterRegistryData', ConverterRegistryData__factory, signer),
        ConverterUpgrader: deployOrAttach('ConverterUpgrader', ConverterUpgrader__factory, signer),
        ConverterV27OrLowerWithFallback: deployOrAttach(
            'ConverterV27OrLowerWithFallback',
            ConverterV27OrLowerWithFallback__factory,
            signer
        ),
        ConverterV27OrLowerWithoutFallback: deployOrAttach(
            'ConverterV27OrLowerWithoutFallback',
            ConverterV27OrLowerWithoutFallback__factory,
            signer
        ),
        ConverterV28OrHigherWithFallback: deployOrAttach(
            'ConverterV28OrHigherWithFallback',
            ConverterV28OrHigherWithFallback__factory,
            signer
        ),
        ConverterV28OrHigherWithoutFallback: deployOrAttach(
            'ConverterV28OrHigherWithoutFallback',
            ConverterV28OrHigherWithoutFallback__factory,
            signer
        ),
        DSToken: deployOrAttach('DSToken', DSToken__factory, signer),
        ERC20: deployOrAttach('ERC20', ERC20__factory, signer),
        LiquidityProtection: deployOrAttach('LiquidityProtection', LiquidityProtection__factory, signer),
        LiquidityProtectionSettings: deployOrAttach(
            'LiquidityProtectionSettings',
            LiquidityProtectionSettings__factory,
            signer
        ),
        LiquidityProtectionStats: deployOrAttach('LiquidityProtectionStats', LiquidityProtectionStats__factory, signer),
        LiquidityProtectionStore: deployOrAttach('LiquidityProtectionStore', LiquidityProtectionStore__factory, signer),
        LiquidityProtectionSystemStore: deployOrAttach(
            'LiquidityProtectionSystemStore',
            LiquidityProtectionSystemStore__factory,
            signer
        ),
        NetworkSettings: deployOrAttach('NetworkSettings', NetworkSettings__factory, signer),
        Owned: deployOrAttach('Owned', Owned__factory, signer),
        StakingRewards: deployOrAttach('StakingRewards', StakingRewards__factory, signer),
        StakingRewardsStore: deployOrAttach('StakingRewardsStore', StakingRewardsStore__factory, signer),
        StandardPoolConverter: deployOrAttach('StandardPoolConverter', StandardPoolConverter__factory, signer),
        StandardPoolConverterFactory: deployOrAttach(
            'StandardPoolConverterFactory',
            StandardPoolConverterFactory__factory,
            signer
        ),
        TestBancorNetwork: deployOrAttach('TestBancorNetwork', TestBancorNetwork__factory, signer),
        TestCheckpointStore: deployOrAttach('TestCheckpointStore', TestCheckpointStore__factory, signer),
        TestContractRegistryClient: deployOrAttach(
            'TestContractRegistryClient',
            TestContractRegistryClient__factory,
            signer
        ),
        TestConverterFactory: deployOrAttach('TestConverterFactory', TestConverterFactory__factory, signer),
        TestConverterRegistry: deployOrAttach('TestConverterRegistry', TestConverterRegistry__factory, signer),
        TestLiquidityProtection: deployOrAttach('TestLiquidityProtection', TestLiquidityProtection__factory, signer),
        TestLiquidityProvisionEventsSubscriber: deployOrAttach(
            'TestLiquidityProvisionEventsSubscriber',
            TestLiquidityProvisionEventsSubscriber__factory,
            signer
        ),
        TestMathEx: deployOrAttach('TestMathEx', TestMathEx__factory, signer),
        TestNonStandardToken: deployOrAttach('TestNonStandardToken', TestNonStandardToken__factory, signer),
        TestReserveToken: deployOrAttach('TestReserveToken', TestReserveToken__factory, signer),
        TestSafeERC20Ex: deployOrAttach('TestSafeERC20Ex', TestSafeERC20Ex__factory, signer),
        TestStakingRewards: deployOrAttach('TestStakingRewards', TestStakingRewards__factory, signer),
        TestStakingRewardsStore: deployOrAttach('TestStakingRewardsStore', TestStakingRewardsStore__factory, signer),
        TestStandardPoolConverter: deployOrAttach(
            'TestStandardPoolConverter',
            TestStandardPoolConverter__factory,
            signer
        ),
        TestStandardPoolConverterFactory: deployOrAttach(
            'TestStandardPoolConverterFactory',
            TestStandardPoolConverterFactory__factory,
            signer
        ),
        TestStandardToken: deployOrAttach('TestStandardToken', TestStandardToken__factory, signer),
        TestTokenGovernance: deployOrAttach('TestTokenGovernance', TestTokenGovernance__factory, signer),
        TestTransferPositionCallback: deployOrAttach(
            'TestTransferPositionCallback',
            TestTransferPositionCallback__factory,
            signer
        ),
        TestTypedConverterAnchorFactory: deployOrAttach(
            'TestTypedConverterAnchorFactory',
            TestTypedConverterAnchorFactory__factory,
            signer
        ),
        TokenGovernance: deployOrAttach('TokenGovernance', TokenGovernance__factory, signer),
        TokenHolder: deployOrAttach('TokenHolder', TokenHolder__factory, signer),
        VortexBurner: deployOrAttach('VortexBurner', VortexBurner__factory, signer)
    };
};

export default getContracts();
