const { ethers } = require('hardhat');

const deployContract = async (contractName, ...args) => {
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

const attachContract = async (contractName, address) => {
    return await ethers.getContractAt(contractName, address);
};

const deployOrAttach = (contractName) => {
    return {
        deploy: (...args) => {
            return deployContract(contractName, ...args);
        },
        attach: (address) => {
            return attachContract(contractName, address);
        }
    };
};

module.exports = {
    BancorFormula: deployOrAttach('BancorFormula'),
    BancorNetwork: deployOrAttach('BancorNetwork'),
    BancorX: deployOrAttach('BancorX'),
    CheckpointStore: deployOrAttach('CheckpointStore'),
    ContractRegistry: deployOrAttach('ContractRegistry'),
    ConversionPathFinder: deployOrAttach('ConversionPathFinder'),
    ConverterFactory: deployOrAttach('ConverterFactory'),
    ConverterRegistry: deployOrAttach('ConverterRegistry'),
    ConverterRegistryData: deployOrAttach('ConverterRegistryData'),
    ConverterUpgrader: deployOrAttach('ConverterUpgrader'),
    ConverterV27OrLowerWithFallback: deployOrAttach('ConverterV27OrLowerWithFallback'),
    ConverterV27OrLowerWithoutFallback: deployOrAttach('ConverterV27OrLowerWithoutFallback'),
    ConverterV28OrHigherWithFallback: deployOrAttach('ConverterV28OrHigherWithFallback'),
    ConverterV28OrHigherWithoutFallback: deployOrAttach('ConverterV28OrHigherWithoutFallback'),
    DSToken: deployOrAttach('DSToken'),
    FixedRatePoolConverter: deployOrAttach('FixedRatePoolConverter'),
    FixedRatePoolConverterFactory: deployOrAttach('FixedRatePoolConverterFactory'),
    IConverterAnchor: deployOrAttach('IConverterAnchor'),
    LiquidityPoolV1Converter: deployOrAttach('LiquidityPoolV1Converter'),
    LiquidityPoolV1ConverterFactory: deployOrAttach('LiquidityPoolV1ConverterFactory'),
    LiquidityProtection: deployOrAttach('LiquidityProtection'),
    LiquidityProtectionSettings: deployOrAttach('LiquidityProtectionSettings'),
    LiquidityProtectionSettingsMigrator: deployOrAttach('LiquidityProtectionSettingsMigrator'),
    LiquidityProtectionStats: deployOrAttach('LiquidityProtectionStats'),
    LiquidityProtectionStore: deployOrAttach('LiquidityProtectionStore'),
    LiquidityProtectionSystemStore: deployOrAttach('LiquidityProtectionSystemStore'),
    NetworkSettings: deployOrAttach('NetworkSettings'),
    Owned: deployOrAttach('Owned'),
    StandardPoolConverter: deployOrAttach('StandardPoolConverter'),
    StandardPoolConverterFactory: deployOrAttach('StandardPoolConverterFactory'),
    TestBancorFormula: deployOrAttach('TestBancorFormula'),
    TestBancorNetwork: deployOrAttach('TestBancorNetwork'),
    TestCall: deployOrAttach('TestCall'),
    TestCheckpointStore: deployOrAttach('TestCheckpointStore'),
    TestContractRegistryClient: deployOrAttach('TestContractRegistryClient'),
    TestConverterFactory: deployOrAttach('TestConverterFactory'),
    TestConverterRegistry: deployOrAttach('TestConverterRegistry'),
    TestFixedRatePoolConverter: deployOrAttach('TestFixedRatePoolConverter'),
    TestLiquidityPoolV1Converter: deployOrAttach('TestLiquidityPoolV1Converter'),
    TestLiquidityPoolV1ConverterFactory: deployOrAttach('TestLiquidityPoolV1ConverterFactory'),
    TestLiquidityProtection: deployOrAttach('TestLiquidityProtection'),
    TestLiquidityProtectionEventsSubscriber: deployOrAttach('TestLiquidityProtectionEventsSubscriber'),
    TestMathEx: deployOrAttach('TestMathEx'),
    TestNonStandardToken: deployOrAttach('TestNonStandardToken'),
    TestReserveToken: deployOrAttach('TestReserveToken'),
    TestSafeERC20Ex: deployOrAttach('TestSafeERC20Ex'),
    TestStakingRewards: deployOrAttach('TestStakingRewards'),
    TestStakingRewardsStore: deployOrAttach('TestStakingRewardsStore'),
    TestStandardPoolConverter: deployOrAttach('TestStandardPoolConverter'),
    TestStandardPoolConverterFactory: deployOrAttach('TestStandardPoolConverterFactory'),
    TestStandardToken: deployOrAttach('TestStandardToken'),
    TestTokenGovernance: deployOrAttach('TestTokenGovernance'),
    TestTypedConverterAnchorFactory: deployOrAttach('TestTypedConverterAnchorFactory'),
    TokenGovernance: deployOrAttach('TokenGovernance'),
    TokenHolder: deployOrAttach('TokenHolder'),
    VortexBurner: deployOrAttach('VortexBurner'),
    Whitelist: deployOrAttach('Whitelist'),
    XTransferRerouter: deployOrAttach('XTransferRerouter')
};
