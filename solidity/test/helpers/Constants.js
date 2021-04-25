const {
    web3: {
        utils: { asciiToHex, keccak256 }
    }
} = require('@openzeppelin/test-environment');

module.exports = {
    registry: {
        CONTRACT_REGISTRY: asciiToHex('ContractRegistry'),
        BANCOR_NETWORK: asciiToHex('BancorNetwork'),
        NETWORK_SETTINGS: asciiToHex('NetworkSettings'),
        CONVERTER_FACTORY: asciiToHex('ConverterFactory'),
        CONVERSION_PATH_FINDER: asciiToHex('ConversionPathFinder'),
        CONVERTER_UPGRADER: asciiToHex('BancorConverterUpgrader'),
        CONVERTER_REGISTRY: asciiToHex('BancorConverterRegistry'),
        CONVERTER_REGISTRY_DATA: asciiToHex('BancorConverterRegistryData'),
        BNT_TOKEN: asciiToHex('BNTToken'),
        BANCOR_X: asciiToHex('BancorX'),
        BANCOR_X_UPGRADER: asciiToHex('BancorXUpgrader'),
        LIQUIDITY_PROTECTION: asciiToHex('LiquidityProtection')
    },

    roles: {
        ROLE_SUPERVISOR: keccak256('ROLE_SUPERVISOR'),
        ROLE_OWNER: keccak256('ROLE_OWNER'),
        ROLE_GOVERNOR: keccak256('ROLE_GOVERNOR'),
        ROLE_MINTER: keccak256('ROLE_MINTER'),
        ROLE_SEEDER: keccak256('ROLE_SEEDER'),
        ROLE_MANAGER: keccak256('ROLE_MANAGER'),
        ROLE_PUBLISHER: keccak256('ROLE_PUBLISHER'),
        ROLE_UPDATER: keccak256('ROLE_UPDATER')
    },

    NATIVE_TOKEN_ADDRESS: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'
};
