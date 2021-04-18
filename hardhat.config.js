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
            accounts: [
                {
                    privateKey: 'fd059ab7b7ad09fc99bae433ab40a2bcbe9141cd60d937ba64688922cb4ad3a9',
                    balance: '10000000000000000000000000000'
                },
                {
                    privateKey: '41d9b0ad7f8db9af212cb40324701eda2ab7391271763c1e19ead4ba4181da40',
                    balance: '10000000000000000000000000000'
                },
                {
                    privateKey: '87a65480eb58022435bd49da60e13bc2b44ccf0cfcb045c755d7376634ee2f6a',
                    balance: '10000000000000000000000000000'
                },
                {
                    privateKey: 'ef655ef06494aa8d762936b65562a3070895ed741daa547d94177a0ddd50adc7',
                    balance: '10000000000000000000000000000'
                },
                {
                    privateKey: '3fe421f9b349347069445b1e860b92ed8c864bb9f8128450e0f65efd3446b70e',
                    balance: '10000000000000000000000000000'
                },
                {
                    privateKey: 'f96051e8ac14af1e89b7a8949a8de71f24fcf9b92b252f17720ecd86abd2e120',
                    balance: '10000000000000000000000000000'
                },
                {
                    privateKey: '116439a3f57d8cf3c2525fafedee41d827e89d875762a14b9240e3d287336ec6',
                    balance: '10000000000000000000000000000'
                },
                {
                    privateKey: '7cb3324b3798e012df64e4513bdb654075d0445a04a5c210ddcfbd335da6d7ba',
                    balance: '10000000000000000000000000000'
                },
                {
                    privateKey: 'a82a955cc6ce65b883cadec63e73a5d7c793fdaef45936aeff0045b526c251d2',
                    balance: '10000000000000000000000000000'
                },
                {
                    privateKey: 'be10611ad3ccb39e1a8b3f580f4efaa6cba24645fa02a6e99dc1fc199d75b446',
                    balance: '10000000000000000000000000000'
                }
            ]
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
        bail: true
    }
};
