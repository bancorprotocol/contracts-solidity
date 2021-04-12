const { web3 } = require('@openzeppelin/test-environment');

module.exports = {
    registry: {
        CONTRACT_REGISTRY: web3.utils.asciiToHex('ContractRegistry'),
        BANCOR_NETWORK: web3.utils.asciiToHex('BancorNetwork'),
        BANCOR_FORMULA: web3.utils.asciiToHex('BancorFormula'),
        NETWORK_SETTINGS: web3.utils.asciiToHex('NetworkSettings'),
        CONVERTER_FACTORY: web3.utils.asciiToHex('ConverterFactory'),
        CONVERSION_PATH_FINDER: web3.utils.asciiToHex('ConversionPathFinder'),
        CONVERTER_UPGRADER: web3.utils.asciiToHex('BancorConverterUpgrader'),
        CONVERTER_REGISTRY: web3.utils.asciiToHex('BancorConverterRegistry'),
        CONVERTER_REGISTRY_DATA: web3.utils.asciiToHex('BancorConverterRegistryData'),
        BNT_TOKEN: web3.utils.asciiToHex('BNTToken'),
        BANCOR_X: web3.utils.asciiToHex('BancorX'),
        BANCOR_X_UPGRADER: web3.utils.asciiToHex('BancorXUpgrader'),
        NETWORK_SETTINGS: web3.utils.asciiToHex('NetworkSettings')
    },

    roles: {
        ROLE_OWNER: web3.utils.keccak256('ROLE_OWNER'),
        ROLE_GOVERNOR: web3.utils.keccak256('ROLE_GOVERNOR'),
        ROLE_MINTER: web3.utils.keccak256('ROLE_MINTER'),
        ROLE_SEEDER: web3.utils.keccak256('ROLE_SEEDER')
    },

    NATIVE_TOKEN_ADDRESS: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'
};
