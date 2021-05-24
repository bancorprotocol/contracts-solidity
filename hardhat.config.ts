import fs from 'fs';
import path from 'path';
import { HardhatUserConfig } from 'hardhat/types/config';

// Import plugins
import '@nomiclabs/hardhat-waffle';
import '@nomiclabs/hardhat-etherscan';

import 'solidity-coverage';
import '@typechain/hardhat';
import 'hardhat-contract-sizer';
import 'hardhat-abi-exporter';
import 'hardhat-gas-reporter';

// Load Config
const configPath = path.join(__dirname, '/config.json');
const config = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, 'utf8')) : {};

const loadAPIKey = (apiKeyName: string) => {
    return config.apiKeys ? (config.apiKeys[apiKeyName] ? config.apiKeys[apiKeyName] : '') : '';
};

const loadEnv = (envVar: string): any => {
    return process.env[envVar];
};

// Config
const configNetworks = config.networks || {};

const Config: HardhatUserConfig = {
    // Network Config
    networks: {
        // Hardhat network
        hardhat: {
            gasPrice: 20000000000,
            gas: 9500000,
            accounts: {
                count: 10,
                accountsBalance: '10000000000000000000000000000'
            }
        },

        // Load the rest of the Network config from a file
        ...configNetworks
    },

    // Solidity Config
    solidity: {
        version: '0.6.12',
        settings: {
            optimizer: {
                enabled: true,
                runs: 200
            }
        }
    },

    // Plugins Config
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
        enabled: loadEnv('PROFILE')
    },
    typechain: {
        outDir: 'typechain',
        target: 'ethers-v5'
    },
    // Test Config
    mocha: {
        timeout: 600000,
        color: true,
        bail: loadEnv('BAIL')
    }
};

export default Config;
