## 🎉🎉 *Work on Bancor V3 is in progress and future changes will be incrementally merged into this repo. Stay tuned!* 🎉🎉 ##

# Bancor Protocol Contracts v0.7 (beta)

[![Docs](https://img.shields.io/badge/docs-%F0%9F%93%84-blue)](https://docs.bancor.network/)
[![NPM Package](https://img.shields.io/npm/v/@bancor/contracts-solidity.svg)](https://www.npmjs.org/package/@bancor/contracts-solidity)
[![Build Status](https://github.com/bancorprotocol/contracts-solidity/actions/workflows/workflow.yml/badge.svg)](https://github.com/bancorprotocol/contracts-solidity/actions/workflows/workflow.yml)

## Overview

The solidity version of the Bancor smart contracts is composed of many different components that work together to create the Bancor Network deployment.

The main contracts are the BancorNetwork contract (entry point to the system) and the different converter contracts (implementation of liquidity pools and their reserves).

## Config

In order to use some plugins, API keys or custom network with secret config we need a config.json file. You can check `hardhat.config.js` for more details.

```json
{
    "apiKeys": {
        "etherscan": ""
    },

    "networks": {
        "mainnet": {
            "url": ""
        }
    }
}
```

## Upgradeability

All smart contract functions are public and all upgrades are opt-in. If significant improvements are made to the system a new version will be released. Token owners can choose between moving to the new system or staying in the old one. If possible, new versions will be backwards compatible and able to interact with the old versions.

## Language

The terms “reserves” and “connectors” have the same meaning throughout Bancor’s smart contract code and documentation. “Reserve ratio” and “connector weight” are also used interchangeably. “Connector balance” refers to the token inventories held in a liquidity pool's reserves.

## Warning

Bancor is a work in progress. Make sure you understand the risks before using it.

## Testing

### Prerequisites

-   node 12.20.0
-   yarn 1.22.0

### Installation

-   `yarn install`

### Verification

-   Verifying all the contracts:
    -   `yarn test` (quick testing)
    -   `yarn coverage` (full coverage)

### [Utilities](utils/README.md)

## Collaborators

-   **[Yudi Levi](https://github.com/yudilevi)**
-   **[Barak Manos](https://github.com/barakman)**
-   **[Leonid Beder](https://github.com/lbeder)**
-   **[Ilana Pinhas](https://github.com/ilanapi)**
-   **[David Benchimol](https://github.com/davidbancor)**
-   **[Or Dadosh](https://github.com/ordd)**
-   **[Martin Holst Swende](https://github.com/holiman)**

## License

Bancor Protocol is open source and distributed under the Apache License v2.0
