const ethwallet = require('ethereumjs-wallet');
const WalletProvider = require("truffle-hdwallet-provider-privkey");

if ( process.argv[2] == 'migrate' ) {
  var wallet = ethwallet.fromPrivateKey(Buffer.from(process.env.ETH_DEPLOYER_KEY, 'hex'));
  var address = "0x" + wallet.getAddress().toString("hex");

  module.exports = {
    networks: {
      development: {
        network_id: process.env.ETH_NETWORK_ID,
        gas: process.env.ETH_GAS_LIMIT,
        gasPrice: process.env.ETH_GAS_PRICE,
        provider: function() {
          return new WalletProvider([process.env.ETH_DEPLOYER_KEY], process.env.ETH_NODE_URL);
        },
        from: address
      },
      staging: {
        network_id: process.env.ETH_NETWORK_ID,
        gas: process.env.ETH_GAS_LIMIT,
        gasPrice: process.env.ETH_GAS_PRICE,
        provider: function() {
          return new WalletProvider([process.env.ETH_DEPLOYER_KEY], process.env.ETH_NODE_URL);
        },
        from: address
      },
      beta: {
        network_id: process.env.ETH_NETWORK_ID,
        gas: process.env.ETH_GAS_LIMIT,
        gasPrice: process.env.ETH_GAS_PRICE,
        provider: function() {
          return new WalletProvider([process.env.ETH_DEPLOYER_KEY], process.env.ETH_NODE_URL);
        },
        from: address
      },
      beta2: {
        network_id: process.env.ETH_NETWORK_ID,
        gas: process.env.ETH_GAS_LIMIT,
        gasPrice: process.env.ETH_GAS_PRICE,
        provider: function() {
          return new WalletProvider([process.env.ETH_DEPLOYER_KEY], process.env.ETH_NODE_URL);
        },
        from: address
      }
    },
    solc: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  };
} else {
  module.exports = {
    /*networks: {
      test: {
        gas: 7000000,
        gasPrice: 1000000000,
        network_id: 1010,
        host: "localhost",
        port: 8545
      }
    },*/
    solc: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  };
}
