module.exports = {
    networks: {
        development: {
            host: "localhost",
            port: 8545,
            network_id: "*", // Match any network id
            gasPrice: 22000000000,
            gas: 4712388
        }
    },
    solc: {
        optimizer: {
            enabled: true,
            runs: 5000000
        }
    }
};
