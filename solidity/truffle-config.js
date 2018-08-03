var ethwallet = require('ethereumjs-wallet');
var ProviderEngine = require("web3-provider-engine");
var WalletSubprovider = require('web3-provider-engine/subproviders/wallet.js');
var RpcSubprovider = require('web3-provider-engine/subproviders/rpc.js')
var Web3 = require("web3");

// Insert raw hex private key here, e.g. using MyEtherWallet
var walletBeta = ethwallet.fromPrivateKey(Buffer.from('924ed2c34dbc1e1e19f74c2d35f434c5e506e2875e430da9ca2ca71888ae176b', 'hex'));
var addressBeta = "0x" + walletBeta.getAddress().toString("hex");
var engineBeta = new ProviderEngine();
engineBeta.addProvider(new WalletSubprovider(walletBeta, {}));
engineBeta.addProvider(new RpcSubprovider({rpcUrl: "https://geth.financie.io:8545"}));
engineBeta.start(); // Required by the provider engine.

// Insert raw hex private key here, e.g. using MyEtherWallet
var walletStaging = ethwallet.fromPrivateKey(Buffer.from('20b46f987f0b65aa19654b7361edc2c8716c70c2fe0f9592f000dafc2ca9f91f', 'hex'));
var addressStaging = "0x" + walletStaging.getAddress().toString("hex");
var engineStaging = new ProviderEngine();
engineStaging.addProvider(new WalletSubprovider(walletStaging, {}));
engineStaging.addProvider(new RpcSubprovider({rpcUrl: "https://geth.financie.io:8545"}));
engineStaging.start(); // Required by the provider engine.

var walletPrivate = ethwallet.fromPrivateKey(Buffer.from(process.env.ETH_WORKER_KEY, 'hex'));
var addressPrivate = "0x" + walletPrivate.getAddress().toString("hex");
var enginePrivate = new ProviderEngine();
enginePrivate.addProvider(new WalletSubprovider(walletPrivate, {}));
enginePrivate.addProvider(new RpcSubprovider({rpcUrl: "https://geth.financie.io:8545"}));
enginePrivate.start(); // Required by the provider engine.

module.exports = {
  networks: {
    beta: {
      network_id: 123,
      gas: 4700000,
      gasPrice: 10000000000,
      provider: engineBeta,
      from: addressBeta
    },
    staging: {
      network_id: 123,
      gas: 4700000,
      gasPrice: 10000000000,
      provider: engineStaging,
      from: addressStaging
    },
    development: {
      network_id: 123,
      gas: 4700000,
      gasPrice: 10000000000,
      provider: enginePrivate,
      from: addressPrivate
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
