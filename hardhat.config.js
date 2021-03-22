require('@nomiclabs/hardhat-waffle');
require('@nomiclabs/hardhat-ethers');

require('solidity-coverage');

module.exports = {
    networks: {
        hardhat: {
            gasPrice: 0
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
        timeout: 600000,
        color: true,
        slow: 30000
    }
};
