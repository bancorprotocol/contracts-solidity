var ethwallet = require('ethereumjs-wallet');
var ProviderEngine = require("web3-provider-engine");
var WalletSubprovider = require('web3-provider-engine/subproviders/wallet.js');
var RpcSubprovider = require('web3-provider-engine/subproviders/rpc.js')
var Web3 = require("web3");

if ( process.argv[2] == 'migrate' ) {
  // Insert raw hex private key here, e.g. using MyEtherWallet
  var wallet = ethwallet.fromPrivateKey(Buffer.from(process.env.ETH_DEPLOYER_KEY, 'hex'));
  var address = "0x" + wallet.getAddress().toString("hex");
  var engine = new ProviderEngine();
  engine.addProvider(new WalletSubprovider(wallet, {}));
  engine.addProvider(new RpcSubprovider({rpcUrl: process.env.ETH_NODE_URL}));
  engine.start(); // Required by the provider engine.

  module.exports = {
    networks: {
      development: {
        network_id: 1010,
        gas: 7000000,
        provider: engine,
        from: address
      },
      staging: {
        network_id: 1010,
        gas: 7000000,
        provider: engine,
        from: address
      },
      beta: {
        network_id: 1010,
        gas: 7000000,
        provider: engine,
        from: address
      },
      beta2: {
        network_id: 1010,
        gas: 7000000,
        provider: engine,
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
    solc: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  };
}
