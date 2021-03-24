let contracts = {};

const deployContract = async (contractName, _signerOrArg = undefined, ...args) => {
    let signer;
    if (typeof _signerOrArg === Object) {
        if (owner.constructor.name === 'SignerWithAddress') {
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

    if (contracts[contractName + signer.address] === undefined) {
        contracts[contractName + signer.address] = await ethers.getContractFactory(contractName);
    }

    return args !== undefined
        ? await contracts[contractName + signer.address].deploy(...args)
        : await contracts[contractName + signer.address].deploy();
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
        attach: () => {
            return attachContract(contractName);
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
    ConverterRegistryData: deployOrAttach('ConverterRegistryData'),
    ConversionPathFinder: deployOrAttach('ConversionPathFinder'),
    TestStandardToken: deployOrAttach('TestStandardToken'),
    TestNonStandardToken: deployOrAttach('TestNonStandardToken'),
    TestBancorNetwork: deployOrAttach('TestBancorNetwork'),
    ConverterV27OrLowerWithoutFallback: deployOrAttach('ConverterV27OrLowerWithoutFallback'),
    ConverterV27OrLowerWithFallback: deployOrAttach('ConverterV27OrLowerWithFallback'),
    ConverterV28OrHigherWithoutFallback: deployOrAttach('ConverterV28OrHigherWithoutFallback'),
    ConverterV28OrHigherWithFallback: deployOrAttach('ConverterV28OrHigherWithFallback'),
    LiquidityPoolV1Converter: deployOrAttach('LiquidityPoolV1Converter'),
    DSToken: deployOrAttach('DSToken')
};
