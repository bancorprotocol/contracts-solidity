import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';

export default {
    registry: {
        CONTRACT_REGISTRY: ethers.utils.formatBytes32String('ContractRegistry'),
        BANCOR_NETWORK: ethers.utils.formatBytes32String('BancorNetwork'),
        BANCOR_FORMULA: ethers.utils.formatBytes32String('BancorFormula'),
        NETWORK_SETTINGS: ethers.utils.formatBytes32String('NetworkSettings'),
        CONVERTER_FACTORY: ethers.utils.formatBytes32String('ConverterFactory'),
        CONVERSION_PATH_FINDER: ethers.utils.formatBytes32String('ConversionPathFinder'),
        CONVERTER_UPGRADER: ethers.utils.formatBytes32String('BancorConverterUpgrader'),
        CONVERTER_REGISTRY: ethers.utils.formatBytes32String('BancorConverterRegistry'),
        CONVERTER_REGISTRY_DATA: ethers.utils.formatBytes32String('BancorConverterRegistryData'),
        BNT_TOKEN: ethers.utils.formatBytes32String('BNTToken'),
        BANCOR_X: ethers.utils.formatBytes32String('BancorX'),
        BANCOR_X_UPGRADER: ethers.utils.formatBytes32String('BancorXUpgrader')
    },

    roles: {
        ROLE_OWNER: ethers.utils.id('ROLE_OWNER'),
        ROLE_GOVERNOR: ethers.utils.id('ROLE_GOVERNOR'),
        ROLE_MINTER: ethers.utils.id('ROLE_MINTER'),
        ROLE_SEEDER: ethers.utils.id('ROLE_SEEDER')
    },

    NATIVE_TOKEN_ADDRESS: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    MAX_UINT256: BigNumber.from('2').pow(BigNumber.from('256')).sub(BigNumber.from('1')),
    ZERO_ADDRESS: ethers.constants.AddressZero
};
