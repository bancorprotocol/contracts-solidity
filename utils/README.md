# Utilities

## [Prerequisites](../../README.md#prerequisites)

## [Installation](../../README.md#installation)

Following installation, `yarn build` should be executed once.

## Test Deployment

Deploys a set of contracts for testing purposes and can be used on both private and public networks.

For example:

```bash
node test_deployment.js deploy --provider http://127.0.0.1:8545 --configPath ./local_config.json --key [TEST_KEY]

node test_deployment.js deploy --provider https://ropsten.infura.io/v3/[PROJECT_ID] --configPath ./ropsten_config.json --ledger
```

For more info, please run:

```bash
node test_deployment.js --help
```

The configuration file is updated during the process, in order to allow resuming a prematurely-terminated execution.

Here is an example of the initial configuration file which should be provided to the process:

```json
{
    "reserves": [
        {
            "symbol": "XXX",
            "decimals": 18,
            "supply": 1829101
        },
        {
            "symbol": "YYY",
            "decimals": 18,
            "supply": 3603801
        },
        {
            "symbol": "BNT",
            "decimals": 18,
            "supply": 6914855
        },
        {
            "symbol": "vBNT",
            "decimals": 18,
            "supply": 0
        },
        {
            "address": "0xBde8bB00A7eF67007A96945B3a3621177B615C44",
            "optional": "this is the already-deployed WBTC token"
        },
        {
            "address": "0x443Fd8D5766169416aE42B8E050fE9422f628419",
            "optional": "this is the already-deployed BAT token"
        },
        {
            "address": "0x20fE562d797A42Dcb3399062AE9546cd06f63280",
            "optional": "this is the already-deployed LINK token"
        }
    ],
    "converters": [
        {
            "type": 3,
            "symbol": "ETHBNT",
            "decimals": 18,
            "fee": "0.1%",
            "reserves": [
                {
                    "symbol": "ETH",
                    "balance": 21
                },
                {
                    "symbol": "BNT",
                    "balance": 3092
                }
            ]
        },
        {
            "type": 3,
            "symbol": "XXXBNT",
            "decimals": 18,
            "fee": "0.1%",
            "reserves": [
                {
                    "symbol": "XXX",
                    "balance": 582
                },
                {
                    "symbol": "BNT",
                    "balance": 2817
                }
            ]
        },
        {
            "type": 3,
            "symbol": "YYYBNT",
            "decimals": 18,
            "fee": "0.2%",
            "reserves": [
                {
                    "symbol": "YYY",
                    "balance": 312
                },
                {
                    "symbol": "BNT",
                    "balance": 270
                }
            ]
        }
    ],
    "liquidityProtectionParams": {
        "minNetworkTokenLiquidityForMinting": 100,
        "defaultNetworkTokenMintingLimit": 750,
        "minProtectionDelay": 600,
        "maxProtectionDelay": 3600,
        "lockDuration": 60,
        "converters": ["ETHBNT", "XXXBNT"]
    }
}
```
