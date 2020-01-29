## Utilities

### [Prerequisites](../../README.md#prerequisites)

### [Installation](../../README.md#installation)

### Verify Network Path Finder

```bash
node verify_network_path_finder.js
    Ethereum node address
    BancorNetworkPathFinder contract address
```

### Migrate Converter Registry

```bash
node migrate_converter_registry.js
    Ethereum node address
    Account private key
    Old BancorConverterRegistry contract address
    New BancorConverterRegistry contract address
```

### Deploy Network Emulation

```bash
node deploy_network_emulation.js
    Configuration file name
    Ethereum node address
    Account private key
```

This process can also be executed via `truffle deploy` or `truffle migrate` provided with the same input parameters:
```bash
truffle deploy
    Configuration file name
    Ethereum node address
    Account private key
```

The configuration file is updated during the process, in order to allow resuming a prematurely-terminated execution.

Here is an example of the initial configuration file which should be provided to the process:
```json
{
    "etherTokenParams": {
        "name": "Bancor Ether Token",
        "symbol": "ETH",
        "supply": "12800000000000000"
    },
    "smartToken0Params": {
        "name": "Bancor Network Token",
        "symbol": "BNT",
        "decimals": 18,
        "supply": "69100000000000000000"
    },
    "smartToken1Params": {
        "name": "ETH/BNT Relay Token",
        "symbol": "ETHBNT",
        "decimals": 18,
        "supply": "13800000000000000000"
    },
    "smartToken2Params": {
        "name": "XXX/BNT Relay Token",
        "symbol": "XXXBNT",
        "decimals": 18,
        "supply": "8380000000000000000"
    },
    "smartToken3Params": {
        "name": "YYY/BNT Relay Token",
        "symbol": "YYYBNT",
        "decimals": 18,
        "supply": "93900000000000000"
    },
    "smartToken4Params": {
        "name": "Smart Token Of Chayot",
        "symbol": "STC",
        "decimals": 18,
        "supply": "56500000000000000000"
    },
    "erc20TokenAParams": {
        "name": "XXX Standard Token",
        "symbol": "XXX",
        "decimals": 18,
        "supply": "1000000000000000000000"
    },
    "erc20TokenBParams": {
        "name": "YYY Standard Token",
        "symbol": "YYY",
        "decimals": 18,
        "supply": "36000000000000000000"
    },
    "converter1Params": {
        "fee": 1000,
        "ratio1": 500000,
        "reserve1": "7950000000000000000",
        "ratio2": 500000,
        "reserve2": "12700000000000000"
    },
    "converter2Params": {
        "fee": 1000,
        "ratio1": 500000,
        "reserve1": "340000000000000000",
        "ratio2": 500000,
        "reserve2": "1040000000000000000"
    },
    "converter3Params": {
        "fee": 2000,
        "ratio1": 500000,
        "reserve1": "369000000000000000",
        "ratio2": 500000,
        "reserve2": "84800000000000000"
    },
    "converter4Params": {
        "fee": 3000,
        "ratio1": 100000,
        "reserve1": "41100000000000000"
    }
}
```
