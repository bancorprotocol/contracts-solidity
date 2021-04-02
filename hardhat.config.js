const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const { argv } = yargs(hideBin(process.argv));

require('@nomiclabs/hardhat-waffle');
require('@nomiclabs/hardhat-ethers');

require('solidity-coverage');

module.exports = {
    networks: {
        hardhat: {
            gasPrice: 20000000000,
            gas: 9500000
        }
    },
    paths: {
        sources: './solidity/contracts',
        tests: './solidity/test',
        cache: './cache',
        artifacts: './solidity/build/contracts'
    },
    solidity: {
        version: '0.6.12',
        settings: {
            optimizer: {
                enabled: true,
                runs: 200
            }
        }
    },
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
