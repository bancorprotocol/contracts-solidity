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
  engine.addProvider(new RpcSubprovider({rpcUrl: "https://vicious-spider-50320.getho.io/jsonrpc"}));
  engine.start(); // Required by the provider engine.

  module.exports = {
    networks: {
      development: {
        network_id: 1010,
        gas: 4712388,
        provider: engine,
        from: address
      },
      staging: {
        network_id: 1010,
        gas: 4712388,
        provider: engine,
        from: address
      },
      beta: {
        network_id: 1010,
        gas: 4712388,
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
}
