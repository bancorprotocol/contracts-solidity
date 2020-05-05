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
    "reserves": [
        {
            "name": "XXX Standard Token",
            "symbol": "XXX",
            "decimals": 18,
            "supply": "1000000000000000000000"
        },
        {
            "name": "YYY Standard Token",
            "symbol": "YYY",
            "decimals": 18,
            "supply": "36000000000000000000"
        },
        {
            "name": "Bancor Network Token",
            "symbol": "BNT",
            "decimals": 18,
            "supply": "69100000000000000000"
        }
    ],
    "converters": [
        {
            "name": "ETH/BNT Relay Token",
            "symbol": "ETHBNT",
            "decimals": 18,
            "fee": 1000,
            "reserves": [
                {
                    "id": -1,
                    "weight": 500000,
                    "balance": "7950000000000000000"
                },
                {
                    "id": 2,
                    "weight": 500000,
                    "balance": "12700000000000000"
                }
            ]
        },
        {
            "name": "XXX/BNT Relay Token",
            "symbol": "XXXBNT",
            "decimals": 18,
            "fee": 1000,
            "reserves": [
                {
                    "id": 0,
                    "weight": 500000,
                    "balance": "340000000000000000"
                },
                {
                    "id": 2,
                    "weight": 500000,
                    "balance": "1040000000000000000"
                }
            ]
        },
        {
            "name": "YYY/BNT Relay Token",
            "symbol": "YYYBNT",
            "decimals": 18,
            "fee": 2000,
            "reserves": [
                {
                    "id": 1,
                    "weight": 500000,
                    "balance": "369000000000000000"
                },
                {
                    "id": 2,
                    "weight": 500000,
                    "balance": "84800000000000000"
                }
            ]
        },
        {
            "name": "Smart Token Of Chayot",
            "symbol": "STC",
            "decimals": 18,
            "fee": 3000,
            "reserves": [
                {
                    "id": 2,
                    "weight": 100000,
                    "balance": "41100000000000000"
                }
            ]
        }
    ]
}
```
