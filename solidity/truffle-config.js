module.exports = {
  networks: {
    development: {
      host: 'localhost',
      port: 8545,
      network_id: '*' // Match any network id
    },
    private: {
      network_id: 123,
      host: 'localhost',
      port: 8545,
      gas: 6000000,
      gasPrice: 4000000000
    },
    ropsten: {
      network_id: 3,
      host: 'localhost',
      port: 8545,
      gas: 4700000,
      gasPrice: 10000000000
    }
  },
  rpc: {
    host: 'localhost',
    post: 8545
  }
};
