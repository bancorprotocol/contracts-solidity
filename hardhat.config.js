const fs = require('fs');
const path = require('path');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const { argv } = yargs(hideBin(process.argv));

require('@nomiclabs/hardhat-waffle');
require('@nomiclabs/hardhat-ethers');
require('@nomiclabs/hardhat-etherscan');

require('solidity-coverage');
require('hardhat-contract-sizer');
require('hardhat-abi-exporter');

// Load Config
const configPath = path.join(__dirname, '/config.json');
const config = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, 'utf8')) : {};

const loadAPIKey = (apiKeyName) => {
    return config.apiKeys ? (config.apiKeys[apiKeyName] ? config.apiKeys[apiKeyName] : '') : '';
};

// Config
const configNetworks = config.networks || {};
const APIKeyEtherscan = loadAPIKey('etherscan');

module.exports = {
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
        apiKey: APIKeyEtherscan
    },
    contractSizer: {
        alphaSort: true,
        runOnCompile: false,
        disambiguatePaths: false
    },
    abiExporter: {
        path: './solidity/build/abi',
        clear: true
    },

    // System Config
    paths: {
        sources: './solidity/contracts',
        tests: './solidity/test',
        cache: './cache',
        artifacts: './solidity/build/contracts'
    },

    // Test Config
    mocha: {
        spec: argv.spec || 'solidity/test',
        exit: true,
        recursive: true,
        before_timeout: 600000,
        timeout: 600000,
        useColors: true,
        bail: process.env.BAIL
    }
};
