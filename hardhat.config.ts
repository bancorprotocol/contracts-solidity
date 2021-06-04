import fs from 'fs';
import path from 'path';

import '@nomiclabs/hardhat-waffle';
import '@nomiclabs/hardhat-ethers';
import '@nomiclabs/hardhat-etherscan';

import 'solidity-coverage';
import 'hardhat-contract-sizer';
import 'hardhat-abi-exporter';
import 'hardhat-gas-reporter';
import '@typechain/hardhat';

const configPath = path.join(__dirname, '/config.json');
const configFile = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, 'utf8')) : {};

const loadAPIKey = (apiKeyName: string) => {
    return configFile.apiKeys ? (configFile.apiKeys[apiKeyName] ? configFile.apiKeys[apiKeyName] : '') : '';
};

// Casting to unknown assume the good type is provided
const loadENVKey = <T>(envKeyName: string) => {
    return process.env[envKeyName] as unknown as T;
};

const configNetworks = configFile.networks || {};

import { HardhatUserConfig } from 'hardhat/config';

const config: HardhatUserConfig = {
    networks: {
        hardhat: {
            gasPrice: 20000000000,
            gas: 9500000,
            accounts: {
                count: 10,
                accountsBalance: '10000000000000000000000000000'
            }
        },

        ...configNetworks
    },

    solidity: {
        version: '0.6.12',
        settings: {
            optimizer: {
                enabled: true,
                runs: 200
            },
            metadata: {
                bytecodeHash: 'none'
            }
        }
    },

    etherscan: {
        apiKey: loadAPIKey('etherscan')
    },
    contractSizer: {
        alphaSort: true,
        runOnCompile: false,
        disambiguatePaths: false
    },
    abiExporter: {
        path: './data/abi',
        clear: true
    },
    gasReporter: {
        currency: 'USD',
        enabled: loadENVKey('PROFILE')
    },

    mocha: {
        timeout: 600000,
        color: true,
        bail: loadENVKey('BAIL')
    }
};

export default config;

// Patch BigNumber to include a min and a max functions.
import { BigNumber } from 'ethers';

declare module 'ethers' {
    class BigNumber {
        static min(a: any, b: any): boolean;
        static max(a: any, b: any): boolean;
    }
}

BigNumber.min = (a: any, b: any) => (BigNumber.from(a).gt(b) ? b : a);
BigNumber.max = (a: any, b: any) => (BigNumber.from(a).gt(b) ? a : b);
