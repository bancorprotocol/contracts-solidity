# How To Deploy Series Of Contracts

### What contracts do we need to deploy
```
solidity
├── contracts
│   ├── converter
│   │   ├── BancorConverter.sol
│   │   ├── BancorFormula.sol
│   │   ├── BancorGasPriceLimit.sol
│   ├── token
│   │   ├── EtherToken.sol
│   │   ├── ERC223SmartToken.sol
│   └── utility
│       ├── ContractFeatures.sol
│       ├── ContractRegistry.sol
│       ├── Whitelist.sol
│   ├── BancorExchange.sol
│   ├── BancorNetwork.sol
│   ├── ContractIds.sol
└   └── FeatureIds.sol
```

### Order Of Deployment
1.  ContractFeatures.sol
    ContractIds.sol
    FeatureIds.sol
    BancorGasPriceLimit.sol
    Whitelist.sol
    ContractRegistry.sol
    EtherToken.sol
    ERC223SmartToken.sol
    BancorFormula.sol 
2.  BancorNetwork.sol
3.  BancorConverter.sol
4.  BancorExchange.sol

### Steps To Configure
1. register contracts mentioned in `ContractIds` in `ContractRegistry`
2. `ERC223SmartToken.issue(someAddress, amount)`, do this to make `SmartToken.totalSupply` > 0
3. `ERC223SmartToken.transferOwnerShip(address(bancorConverter))`
4. `bancorConverter.accecptTokenOwnerShip()`
5. `EtherToken.deposit()`
6. `EtherToken.transfer(address(bancorConverter), someAmount)`, do this to make connector balance > 0
7. `whiteList.addAddress(address(bancorExchange))`
8. `bancorConverter.setConversionWhitelist(address(whiteList))`
9. `bancorNetwork.registerEtherToken(address(etherToken), true)`
10. `bancorExchange.setQuickBuyPath(address(ethToken), address(ethToken), address(ERC223SmartToken))`
11. `bancorExchange.setQuickSellPath(address(ERC223SmartToken), address(ERC223SmartToken), address(ethToken))`

### How To Use
Stated In README.md
