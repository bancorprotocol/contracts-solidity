# Bancor Protocol Contracts v0.6 (alpha)

Bancor is a **smart-contract-based token conversion protocol**, which enables a single party to convert any 
token to another, without requiring a second party to exchange with. It achieves this through the use of 
reserve-tokens, which provide liquidity through autonomous algorithmic price discovery, regardless of trade volume.

## Overview
The Bancor protocol represents the first technological solution for the classic problem in economics known as the “Double Coincidence of Wants”, in the domain of asset exchange. For barter, the coincidence of wants problem was solved through money. For money, exchanges still rely on labor, via bid/ask orders and trade between external agents, to make markets and supply liquidity. 

Through the use of smart-contracts, Smart Tokens can be created that hold one or more other tokens in their reserve. Tokens may represent existing national currencies or other types of assets. By using a reserve token model and algorithmically-calculated conversion rates, the Bancor Protocol creates a new type of ecosystem for asset exchange, with no central control. This decentralized hierarchical monetary system lays the foundation for an autonomous decentralized global exchange with numerous and substantial advantages.

## Warning

Bancor is a work in progress. Make sure you understand the risks before using it.

# The Bancor Standards

Bancor protocol is implemented using multiple contracts. The main ones are SmartToken and BancorChanger.
BancorChanger implements the token changer standard (See https://github.com/ethereum/EIPs/issues/228) and is responsible for converting between a token and its reserves.
SmartToken represents a changer aware ERC-20 compliant token.

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

# The Bancor Changer Standard

The following section describes standard functions a bancor changer can implement.

## Motivation

Those will allow dapps and wallets to buy and sell the token.

The most important here is `change`.

## Specification

### BancorToken

First and foremost, a Bancor Changer is also an EIP-228 compliant changer.
As such, it implements both the standard changer methods and the standard changer events.

### Methods

**reserveTokenCount**
```cs
function reserveTokenCount() public constant returns (uint16 count)
```
Gets the number of reserve tokens defined for the token.
<br>
<br>
<br>
**reserveTokens**
```cs
function reserveTokens() public constant returns (address[] reserveTokens)
```
Gets an array of the reserve token contract addresses.
<br>
<br>
<br>
**reserves**
```cs
function reserves(address _reserveToken) public constant
```
Gets the reserve token details.
<br>
<br>
<br>
**change**
```cs
function change(address _fromToken, address _toToken, uint256 _amount, uint256 _minReturn)
```
changes a specific amount of _fromToken to _toToken
The change will only take place if it returns a value greater or equal to `_minReturn`.
<br>
<br>
<br>

### Events

**Change**
```cs
event Change(address indexed _fromToken, address indexed _toToken, address indexed _trader, uint256 _amount, uint256 _return);
```
Triggered when a change between one of the changeable tokens takes place.

## Testing
Tests are included and can be run using truffle.

### Prerequisites
* Node.js v7.6.0+
* truffle v3.2.2+
* testrpc v3.0.5+

To run the test, execute the following commands from the project's root folder -
* npm run testrpc
* npm test

## Collaborators

* **[Yudi Levi](https://github.com/yudilevi)**
* **[Ilana Pinhas](https://github.com/ilanapi)**
* **[Barak Manos](https://github.com/barakman)**
* **[Martin Holst Swende](https://github.com/holiman)**


## License

Bancor Protocol is open source and distributed under the Apache License v2.0
