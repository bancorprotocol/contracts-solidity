const { BigNumber, ethers } = require('ethers');

const { formatBytes32String, id } = ethers.utils;

module.exports = {
    registry: {
        CONTRACT_REGISTRY: formatBytes32String('ContractRegistry'),
        BANCOR_NETWORK: formatBytes32String('BancorNetwork'),
        NETWORK_SETTINGS: formatBytes32String('NetworkSettings'),
        CONVERTER_FACTORY: formatBytes32String('ConverterFactory'),
        CONVERSION_PATH_FINDER: formatBytes32String('ConversionPathFinder'),
        CONVERTER_UPGRADER: formatBytes32String('BancorConverterUpgrader'),
        CONVERTER_REGISTRY: formatBytes32String('BancorConverterRegistry'),
        CONVERTER_REGISTRY_DATA: formatBytes32String('BancorConverterRegistryData'),
        BNT_TOKEN: formatBytes32String('BNTToken'),
        BANCOR_X: formatBytes32String('BancorX'),
        BANCOR_X_UPGRADER: formatBytes32String('BancorXUpgrader'),
        LIQUIDITY_PROTECTION: formatBytes32String('LiquidityProtection'),

        // Needed for legacy tests
        BANCOR_FORMULA: formatBytes32String('BancorFormula')
    },

    roles: {
        ROLE_SUPERVISOR: id('ROLE_SUPERVISOR'),
        ROLE_OWNER: id('ROLE_OWNER'),
        ROLE_GOVERNOR: id('ROLE_GOVERNOR'),
        ROLE_MINTER: id('ROLE_MINTER'),
        ROLE_SEEDER: id('ROLE_SEEDER'),
        ROLE_MANAGER: id('ROLE_MANAGER'),
        ROLE_PUBLISHER: id('ROLE_PUBLISHER'),
        ROLE_UPDATER: id('ROLE_UPDATER')
    },

    NATIVE_TOKEN_ADDRESS: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    MAX_UINT256: BigNumber.from(2).pow(BigNumber.from(256)).sub(BigNumber.from(1)),
    ZERO_ADDRESS: ethers.constants.AddressZero
};
