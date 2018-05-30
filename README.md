# Bancor Protocol Contracts v0.4 (alpha)

Bancor is a decentralized liquidity network that provides users with a simple, low-cost way to buy and sell tokens. Bancor’s open-source protocol empowers tokens with built-in convertibility directly through their smart contracts, allowing integrated tokens to be instantly converted for one another, without needing to match buyers and sellers in an exchange. The Bancor Wallet enables automated token conversions directly from within the wallet, at prices that are more predictable than exchanges and resistant to manipulation. To convert tokens instantly, including ETH, EOS, DAI and more, visit the [Bancor Web App](https://www.bancor.network/communities/5a780b3a287443a5cdea2477?utm_source=social&utm_medium=github&utm_content=readme), join the [Bancor Telegram group](https://t.me/bancor) or read the Bancor Protocol™ [Whitepaper](https://www.bancor.network/whitepaper) for more information.

## Overview
The Bancor protocol represents the first technological solution for the classic problem in economics known as the “Double Coincidence of Wants”, in the domain of asset exchange. For barter, the coincidence of wants problem was solved through money. For money, exchanges still rely on labor, via bid/ask orders and trade between external agents, to make markets and supply liquidity. 

Through the use of smart-contracts, Smart Tokens can be created that hold one or more other tokens as connectors. Tokens may represent existing national currencies or other types of assets. By using a connector token model and algorithmically-calculated conversion rates, the Bancor Protocol creates a new type of ecosystem for asset exchange, with no central control. This decentralized hierarchical monetary system lays the foundation for an autonomous decentralized global exchange with numerous and substantial advantages.

## Warning

Bancor is a work in progress. Make sure you understand the risks before using it.

# The Bancor Standards

Bancor protocol is implemented using multiple contracts. The main ones are SmartToken and BancorConverter.
BancorConverter is responsible for converting between a token and its connectors.
SmartToken represents a converter aware ERC-20 compliant token.

# The Smart Token Standard

## Motivation

Those will allow creating a Bancor compliant token while keeping dependencies at a minimum.
In addition, it allows an owning contract to extend its functionality by giving the owner full control.

## Specification

### SmartToken

First and foremost, a Smart Token is also an ERC-20 compliant token.
As such, it implements both the standard token methods and the standard token events.

### Methods

Note that these methods can only be executed by the token owner.

**issue**
```cs
function issue(address _to, uint256 _amount)
```
Increases the token supply and sends the new tokens to an account.
<br>
<br>
<br>
**destroy**
```cs
function destroy(address _from, uint256 _amount)
```
Removes tokens from an account and decreases the token supply.
<br>
<br>
<br>
**disableTransfers**
```cs
function disableTransfers(bool _disable)
```
Disables transfer/transferFrom functionality.
<br>
<br>
<br>
### Events

**NewSmartToken**
```cs
event NewSmartToken(address _token)
```
Triggered when a smart token is deployed.
<br>
<br>
<br>
**Issuance**
```cs
event Issuance(uint256 _amount)
```
Triggered when the total supply is increased.
<br>
<br>
<br>
**Destruction**
```cs
event Destruction(uint256 _amount)
```
Triggered when the total supply is decreased.
<br>
<br>
<br>

# The Bancor Converter Standard

The following section describes standard functions a bancor converter can implement.

## Motivation

Those will allow dapps and wallets to buy and sell the token.

The most important here is `convert`.

## Specification

### Methods

**connectorTokenCount**
```cs
function connectorTokenCount() public constant returns (uint16 count)
```
Gets the number of connector tokens defined for the token.
<br>
<br>
<br>
**connectorTokens**
```cs
function connectorTokens() public constant returns (address[] connectorTokens)
```
Gets an array of the connector token contract addresses.
<br>
<br>
<br>
**connectors**
```cs
function connectors(address _connectorToken) public constant
```
Gets the connector token details.
<br>
<br>
<br>
**convert**
```cs
function convert(address _fromToken, address _toToken, uint256 _amount, uint256 _minReturn)
```
converts a specific amount of _fromToken to _toToken
The conversion will only take place if it returns a value greater or equal to `_minReturn`.
<br>
<br>
<br>

### Events

**Conversion**
```cs
event Conversion(address indexed _fromToken, address indexed _toToken, address indexed _trader, uint256 _amount, uint256 _return, uint256 _currentPriceN, uint256 _currentPriceD);
```
Triggered when a conversion between one of the convertible tokens takes place.

## Testing
Tests are included and can be run using truffle & ganache

### Prerequisites
* Node.js v7.6.0+
* truffle v4.1.5+
* ganache v1.1.0+

To run the test, first start ganache and then execute the following command from the project's root folder -
* npm test

## Collaborators

* **[Yudi Levi](https://github.com/yudilevi)**
* **[Ilana Pinhas](https://github.com/ilanapi)**
* **[Or Dadosh](https://github.com/ordd)**
* **[Barak Manos](https://github.com/barakman)**
* **[Martin Holst Swende](https://github.com/holiman)**


## License

Bancor Protocol is open source and distributed under the Apache License v2.0
