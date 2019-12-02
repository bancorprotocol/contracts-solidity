## Operational Scripts

### Deploy Network Emulation

```bash
node deploy_network_emulation.js
    Configuration file name
    Ethereum node address
    Account private key
```

### Migrate Converter Registry

```bash
node migrate_converter_registry.js
    Ethereum node address
    Account private key
    Old BancorConverterRegistry contract address
    New BancorConverterRegistry contract address
```

### Verify Network Path Finder

```bash
node verify_network_path_finder.js
    Ethereum node address
    BancorNetworkPathFinder contract address
    BancorConverterRegistry contract addresses
```

#### Deploy Network Emulation / Notes

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
        "supply": "13000000000000000"
    },
    "smartToken1Params": {
        "name": "Bancor Network Token",
        "symbol": "BNT",
        "decimals": 18,
        "supply": "68000000000000000000"
    },
    "smartToken2Params": {
        "name": "Smart Token Of Chayot",
        "symbol": "STC",
        "decimals": 18,
        "supply": "1000000000000000000"
    },
    "smartToken3Params": {
            "name": "XXX/BNT Relay Token",
        "symbol": "XXXBNT",
        "decimals": 18,
        "supply": "200000000000000000"
    },
    "smartToken4Params": {
            "name": "YYY/BNT Relay Token",
        "symbol": "YYYBNT",
        "decimals": 18,
        "supply": "8300000000000000000"
    },
    "erc20TokenAParams": {
            "name": "XXX Standard Token",
        "symbol": "XXX",
        "decimals": 18,
        "supply": "1500000000000000000000"
    },
    "erc20TokenBParams": {
            "name": "YYY Standard Token",
        "symbol": "YYY",
        "decimals": 18,
        "supply": "1000000000000000000000"
    },
    "converter1Params": {
        "fee": 0,
        "ratio1": 100000,
        "reserve1": "13000000000000000"
    },
    "converter2Params": {
        "fee": 0,
        "ratio1": 500000,
        "reserve1": "300000000000000000"
    },
    "converter3Params": {
        "fee": 1000,
        "ratio1": 500000,
        "reserve1": "400000000000000000",
        "ratio2": 500000,
        "reserve2": "520000000000000000"
    },
    "converter4Params": {
        "fee": 1000,
        "ratio1": 500000,
        "reserve1": "250000000000000000",
        "ratio2": 500000,
        "reserve2": "1300000000000000000"
    },
    "priceLimitParams": {
        "value": "6000000000"
    }
}
```
