module.exports = {
    contracts_directory: './solidity',
    contracts_build_directory: './solidity/build/contracts',
    test_directory: './solidity/test',
    networks: {
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
            version: '0.6.12',
            settings: {
                optimizer: {
                    enabled: true,
                    runs: 200
                }
            }
        }
    },
    mocha: {
        before_timeout: 600000,
        timeout: 600000,
        useColors: true,
        reporter: 'list'
    }
};
