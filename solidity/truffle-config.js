var ethwallet = require('ethereumjs-wallet');
var ProviderEngine = require("web3-provider-engine");
var WalletSubprovider = require('web3-provider-engine/subproviders/wallet.js');
var RpcSubprovider = require('web3-provider-engine/subproviders/rpc.js')
var Web3 = require("web3");

// Insert raw hex private key here, e.g. using MyEtherWallet
var wallet = ethwallet.fromPrivateKey(Buffer.from('20b46f987f0b65aa19654b7361edc2c8716c70c2fe0f9592f000dafc2ca9f91f', 'hex'));

var address = "0x" + wallet.getAddress().toString("hex");

var engineStaging = new ProviderEngine();
engineStaging.addProvider(new WalletSubprovider(wallet, {}));
engineStaging.addProvider(new RpcSubprovider({rpcUrl: "https://13.113.253.3:8545"}));
engineStaging.start(); // Required by the provider engine.

var enginePrivate = new ProviderEngine();
enginePrivate.addProvider(new WalletSubprovider(wallet, {}));
enginePrivate.addProvider(new RpcSubprovider({rpcUrl: "http://localhost:8545"}));
enginePrivate.start(); // Required by the provider engine.

module.exports = {
  networks: {
    development: {
      host: 'localhost',
      port: 8545,
      network_id: '*' // Match any network id
    },
    staging: {
      network_id: 123,
      gas: 4700000,
      gasPrice: 10000000000,
      provider: engineStaging,
      from: address
    },
    private: {
      network_id: 123,
      gas: 4700000,
      gasPrice: 10000000000,
      provider: enginePrivate,
      from: address
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
  },
  solc: {
    optimizer: {
      enabled: true,
      runs: 200
    }
  }
};
