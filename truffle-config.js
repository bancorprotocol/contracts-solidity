/* eslint-disable import/no-extraneous-dependencies */
require('chai')
    .use(require('chai-as-promised'))
    .use(require('chai-bn')(require('bn.js')))
    .use(require('dirty-chai'))
    .expect();

const ganache = require('ganache-core');
/* eslint-enable import/no-extraneous-dependencies */

module.exports = {
    contracts_directory: './solidity',
    contracts_build_directory: './solidity/build/contracts',
    test_directory: './solidity/test',
    networks: {
        development: {
            host: 'localhost',
            port: 7545,
            network_id: '*',
            gasPrice: 20000000000,
            gas: 6721975,
            provider: ganache.provider({
                default_balance_ether: 10000000000000000000
            })
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
                    runs: 1000
                }
            }
        }
    },
    mocha: {
        enableTimeouts: false,
        useColors: true,
        reporter: 'list'
    }
};
