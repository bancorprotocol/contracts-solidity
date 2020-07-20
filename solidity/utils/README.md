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
            "supply": "1829101"
        },
        {
            "symbol": "YYY",
            "decimals": 18,
            "supply": "3603801"
        },
        {
            "symbol": "XYZ",
            "decimals": 18,
            "supply": "3782823"
        },
        {
            "symbol": "BNT",
            "decimals": 18,
            "supply": "6914855"
        }
    ],
    "converters": [
        {
            "type": 1,
            "symbol": "ETHBNT",
            "decimals": 18,
            "fee": "0.1%",
            "reserves": [
                {
                    "symbol": "ETH",
                    "weight": "50%",
                    "balance": "21"
                },
                {
                    "symbol": "BNT",
                    "weight": "50%",
                    "balance": "3092"
                }
            ]
        },
        {
            "type": 1,
            "symbol": "XXXBNT",
            "decimals": 18,
            "fee": "0.1%",
            "reserves": [
                {
                    "symbol": "XXX",
                    "weight": "50%",
                    "balance": "582"
                },
                {
                    "symbol": "BNT",
                    "weight": "50%",
                    "balance": "2817"
                }
            ]
        },
        {
            "type": 1,
            "symbol": "YYYBNT",
            "decimals": 18,
            "fee": "0.2%",
            "reserves": [
                {
                    "symbol": "YYY",
                    "weight": "50%",
                    "balance": "312"
                },
                {
                    "symbol": "BNT",
                    "weight": "50%",
                    "balance": "270"
                }
            ]
        },
        {
            "type": 2,
            "symbol": "XYZBNT",
            "decimals": 18,
            "fee": "0.2%",
            "reserves": [
                {
                    "symbol": "YYY",
                    "weight": "50%",
                    "balance": "920",
                    "oracle": "0xaaa...."
                },
                {
                    "symbol": "BNT",
                    "weight": "50%",
                    "balance": "6552",
                    "oracle": "0xbbb...."
                }
            ]
        },
        {
            "type": 0,
            "symbol": "ZZZ",
            "decimals": 18,
            "fee": "0.3%",
            "reserves": [
                {
                    "symbol": "BNT",
                    "weight": "10%",
                    "balance": "920"
                }
            ]
        }
    ]
}

```
