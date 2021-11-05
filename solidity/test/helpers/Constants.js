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
        LIQUIDITY_PROTECTION: web3.utils.asciiToHex('LiquidityProtection')
    },

    roles: {
        ROLE_SUPERVISOR: web3.utils.keccak256('ROLE_SUPERVISOR'),
        ROLE_OWNER: web3.utils.keccak256('ROLE_OWNER'),
        ROLE_GOVERNOR: web3.utils.keccak256('ROLE_GOVERNOR'),
        ROLE_MINTER: web3.utils.keccak256('ROLE_MINTER'),
        ROLE_SEEDER: web3.utils.keccak256('ROLE_SEEDER'),
        ROLE_MANAGER: web3.utils.keccak256('ROLE_MANAGER'),
        ROLE_PUBLISHER: web3.utils.keccak256('ROLE_PUBLISHER'),
        ROLE_UPDATER: web3.utils.keccak256('ROLE_UPDATER')
    },

    NATIVE_TOKEN_ADDRESS: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'
};
