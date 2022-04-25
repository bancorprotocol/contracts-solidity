import fs from 'fs';
import path from 'path';

import '@nomiclabs/hardhat-waffle';
import '@nomiclabs/hardhat-ethers';

import 'solidity-coverage';
import 'hardhat-contract-sizer';
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
            },
            allowUnlimitedContractSize: true
        },

        ...configNetworks
    },

    typechain: {
        outDir: 'typechain',
        target: 'ethers-v5'
    },

    solidity: {
        compilers: [
            {
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
            {
                version: '0.8.13',
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200
                    },
                    metadata: {
                        bytecodeHash: 'none'
                    }
                }
            }
        ]
    },

    contractSizer: {
        alphaSort: true,
        runOnCompile: false,
        disambiguatePaths: false
    },

    mocha: {
        timeout: 600000,
        color: true,
        bail: loadENVKey('BAIL')
    }
};

export default config;
