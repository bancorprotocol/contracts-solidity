/* eslint-disable import/no-extraneous-dependencies */
require('chai')
    .use(require('chai-as-promised'))
    .use(require('chai-bn')(require('bn.js')))
    .use(require('chai-string'))
    .use(require('dirty-chai'))
    .expect();

const Decimal = require('decimal.js');
Decimal.set({ precision: 100, rounding: Decimal.ROUND_DOWN, toExpPos: 40 });

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
            gas: 9500000,
            provider: ganache.provider({
                gasLimit: 9500000,
                gasPrice: 20000000000,
                default_balance_ether: 10000000000000000000
            })
        },
        production: {
            host: 'localhost',
            port: 7545,
            network_id: '*',
            gasPrice: 20000000000,
            gas: 9500000
        }
    },
    plugins: ['solidity-coverage'],
    compilers: {
        solc: {
            version: '0.4.26',
            settings: {
                optimizer: {
                    enabled: true,
                    runs: 200
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
