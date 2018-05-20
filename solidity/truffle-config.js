module.exports = {
    networks: {
        development: {
            host: "localhost",
            port: 7545,
            network_id: "*", // Match any network id
            gasPrice: 20000000000,
            gas: 5712388
        }
    },
    solc: {
        optimizer: {
            enabled: true,
            runs: 5000000
        }
    }
};
