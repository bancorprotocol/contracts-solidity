/* eslint-disable import/no-extraneous-dependencies */
const ganache = require('ganache-core');
/* eslint-enable import/no-extraneous-dependencies */

module.exports = {
    contracts_directory: './solidity',
    contracts_build_directory: './solidity/build/contracts',
    networks: {
        development: {
            host: 'localhost',
            port: 7545,
            network_id: '*',
            gasPrice: 20000000000,
            gas: 6721975,
            provider: ganache.provider({
                defaultEtherBalance: 1000,
            }),
        },
        production: {
            host: 'localhost',
            port: 7545,
            network_id: '*',
            gasPrice: 20000000000,
            gas: 6721975
        }
    },
    plugins: ['solidity-coverage'],
    compilers: {
        solc: {
            version: '0.4.26',
            settings: {
                optimizer: {
                    enabled: true,
                    runs: 1000,
                },
            },
        },
    },
    mocha: {
        enableTimeouts: false,
        useColors: true,
        bail: true,
        reporter: 'list'
    },
};
