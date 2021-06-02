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

// Config
const configNetworks = configFile.networks || {};
const APIKeyEtherscan = loadAPIKey('etherscan');

import { HardhatUserConfig } from 'hardhat/config';

const config: HardhatUserConfig = {
    // Network Config
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
        apiKey: APIKeyEtherscan
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
        currency: 'USD'
        // enabled: process.env.PROFILE
    },

    mocha: {
        exit: true,
        recursive: true,
        before_timeout: 600000,
        timeout: 600000,
        useColors: true,
        bail: process.env.BAIL
    }
};

export default config;
