let contracts = {};

const deployContract = async (contractName, ...args) => {
    let signer = (await ethers.getSigners())[0];

    if (typeof args[args.length - 1] === 'object' && args[args.length - 1].constructor.name === 'SignerWithAddress') {
        signer = args[args.length - 1];
        args.pop();
    }

    if (contracts[contractName + signer.address] === undefined) {
        contracts[contractName + signer.address] = await ethers.getContractFactory(contractName, signer);
    }

    return args === undefined || args.length === 0
        ? await contracts[contractName + signer.address].deploy()
        : await contracts[contractName + signer.address].deploy(...args);
};

const attachContract = async (contractName, address) => {
    if (contracts[contractName] === undefined) {
        contracts[contractName] = await ethers.getContractFactory(contractName);
    }
    return await contracts[contractName].attach(address);
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
    TestBancorFormula: deployOrAttach('TestBancorFormula'),
    BancorNetwork: deployOrAttach('BancorNetwork'),
    BancorFormula: deployOrAttach('BancorFormula'),
    NetworkSettings: deployOrAttach('NetworkSettings'),
    ContractRegistry: deployOrAttach('ContractRegistry'),
    ConverterRegistry: deployOrAttach('ConverterRegistry'),
    ConverterFactory: deployOrAttach('ConverterFactory'),
    ConversionPathFinder: deployOrAttach('ConversionPathFinder'),
    TestStandardToken: deployOrAttach('TestStandardToken'),
    TestNonStandardToken: deployOrAttach('TestNonStandardToken'),
    TestBancorNetwork: deployOrAttach('TestBancorNetwork'),
    ConverterV27OrLowerWithoutFallback: deployOrAttach('ConverterV27OrLowerWithoutFallback'),
    ConverterV27OrLowerWithFallback: deployOrAttach('ConverterV27OrLowerWithFallback'),
    ConverterV28OrHigherWithoutFallback: deployOrAttach('ConverterV28OrHigherWithoutFallback'),
    ConverterV28OrHigherWithFallback: deployOrAttach('ConverterV28OrHigherWithFallback'),
    LiquidityPoolV1Converter: deployOrAttach('LiquidityPoolV1Converter'),
    TestCheckpointStore: deployOrAttach('TestCheckpointStore'),
    DSToken: deployOrAttach('DSToken'),
    BancorX: deployOrAttach('BancorX'),
    TestContractRegistryClient: deployOrAttach('TestContractRegistryClient'),
    ConversionPathFinder: deployOrAttach('ConversionPathFinder'),
    ConverterRegistryData: deployOrAttach('ConverterRegistryData'),
    LiquidityPoolV1ConverterFactory: deployOrAttach('LiquidityPoolV1ConverterFactory'),
    ConverterUpgrader: deployOrAttach('ConverterUpgrader'),
    StandardPoolConverter: deployOrAttach('StandardPoolConverter'),
    FixedRatePoolConverter: deployOrAttach('FixedRatePoolConverter'),
    StandardPoolConverterFactory: deployOrAttach('StandardPoolConverterFactory'),
    FixedRatePoolConverterFactory: deployOrAttach('FixedRatePoolConverterFactory'),
    TestTypedConverterAnchorFactory: deployOrAttach('TestTypedConverterAnchorFactory'),
    TestConverterFactory: deployOrAttach('TestConverterFactory'),
    TestConverterRegistry: deployOrAttach('TestConverterRegistry'),
    TestFixedRatePoolConverter: deployOrAttach('TestFixedRatePoolConverter'),
    Whitelist: deployOrAttach('Whitelist'),
    TestLiquidityPoolV1Converter: deployOrAttach('TestLiquidityPoolV1Converter'),
    TestLiquidityPoolV1ConverterFactory: deployOrAttach('TestLiquidityPoolV1ConverterFactory'),
    TestStandardPoolConverterFactory: deployOrAttach('TestStandardPoolConverterFactory'),
    TestTokenGovernance: deployOrAttach('TestTokenGovernance'),
    LiquidityProtectionSettings: deployOrAttach('LiquidityProtectionSettings'),
    LiquidityProtectionStore: deployOrAttach('LiquidityProtectionStore'),
    LiquidityProtectionStats: deployOrAttach('LiquidityProtectionStats'),
    LiquidityProtectionSystemStore: deployOrAttach('LiquidityProtectionSystemStore'),
    TestLiquidityProtection: deployOrAttach('TestLiquidityProtection'),
    TokenHolder: deployOrAttach('TokenHolder'),
    TestLiquidityProtectionEventsSubscriber: deployOrAttach('TestLiquidityProtectionEventsSubscriber'),
    TestStandardPoolConverter: deployOrAttach('TestStandardPoolConverter'),
    TokenGovernance: deployOrAttach('TokenGovernance'),
    CheckpointStore: deployOrAttach('CheckpointStore'),
    LiquidityProtection: deployOrAttach('LiquidityProtection'),
    LiquidityProtectionSettingsMigrator: deployOrAttach('LiquidityProtectionSettingsMigrator'),
    TestMathEx: deployOrAttach('TestMathEx'),
    Owned: deployOrAttach('Owned'),
    TestReentrancyGuardAttacker: deployOrAttach('TestReentrancyGuardAttacker'),
    TestReentrancyGuard: deployOrAttach('TestReentrancyGuard'),
    XTransferRerouter: deployOrAttach('XTransferRerouter'),
    VortexBurner: deployOrAttach('VortexBurner'),
    TestSafeERC20Ex: deployOrAttach('TestSafeERC20Ex'),
    TestReserveToken: deployOrAttach('TestReserveToken'),
    TestLiquidityProtectionEventsSubscriber: deployOrAttach('TestLiquidityProtectionEventsSubscriber')
};
