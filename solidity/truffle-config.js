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
  engine.addProvider(new RpcSubprovider({rpcUrl: "https://geth.financie.io:8545"}));
  engine.start(); // Required by the provider engine.

  module.exports = {
    networks: {
      development: {
        network_id: 123,
        gas: 4712388,
        provider: engine,
        from: address
      },
      staging: {
        network_id: 123,
        gas: 4712388,
        provider: engine,
        from: address
      },
      beta: {
        network_id: 123,
        gas: 4712388,
        provider: engine,
        from: address
      },
      ropsten: {
        network_id: 3,
        gas: 4712388,
        provider: engine,
        from: address
      },
      getho: {
        host: "vicious-spider-50320.getho.io/jsonrpc",
        port: 80,
        network_id: 1010,
        gas: 4712388
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
    networks: {
      getho: {
        host: "vicious-spider-50320.getho.io/jsonrpc",
        port: 80,
        network_id: 1010,
        gas: 4712388
      }
    },
    solc: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  };
}
