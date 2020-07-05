## Utilities

### [Prerequisites](../../README.md#prerequisites)

### [Installation](../../README.md#installation)

### Test Deployment

Deploys a set of contracts for testing purpose; can be used on both private and public networks:
```bash
node test_deployment.js
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
            "symbol": "XXX",
            "decimals": 18,
            "supply": "1000"
        },
        {
            "symbol": "YYY",
            "decimals": 18,
            "supply": "36"
        },
        {
            "symbol": "BNT",
            "decimals": 18,
            "supply": "69.1"
        }
    ],
    "converters": [
        {
            "symbol": "ETHBNT",
            "decimals": 18,
            "fee": "0.1%",
            "reserves": [
                {
                    "symbol": "ETH",
                    "weight": "50%",
                    "balance": "7.95"
                },
                {
                    "symbol": "BNT",
                    "weight": "50%",
                    "balance": "0.0127"
                }
            ]
        },
        {
            "symbol": "XXXBNT",
            "decimals": 18,
            "fee": "0.1%",
            "reserves": [
                {
                    "symbol": "XXX",
                    "weight": "50%",
                    "balance": "0.34"
                },
                {
                    "symbol": "BNT",
                    "weight": "50%",
                    "balance": "1.04"
                }
            ]
        },
        {
            "symbol": "YYYBNT",
            "decimals": 18,
            "fee": "0.2%",
            "reserves": [
                {
                    "symbol": "YYY",
                    "weight": "50%",
                    "balance": "0.369"
                },
                {
                    "symbol": "BNT",
                    "weight": "50%",
                    "balance": "0.0848"
                }
            ]
        },
        {
            "symbol": "ZZZ",
            "decimals": 18,
            "fee": "0.3%",
            "reserves": [
                {
                    "symbol": "BNT",
                    "weight": "10%",
                    "balance": "0.0411"
                }
            ]
        }
    ]
}
```
