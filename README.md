# Bancor Network Contracts (alpha v0.2)

Bancor is a **smart-contract-based token conversion protocol**, which enables a single party to convert any token to another, without requiring a second party to exchange with.  
It achieves this through the use of reserve-tokens, which provide liquidity through autonomous algorithmic price discovery, regardless of trade volume.

## Warning

Bancor is a work in progress. Make sure you understand the risks before using it.

# The Bancor Enabled Token Standard

The following section describes standard functions a bancor enabled token can implement.

## Motivation

Those will allow dapps and wallets to buy and sell the token.

The most important here are `buy` and `sell`.

## Specification

### BancorEnabledToken

First and foremost, a Bancor Enabled Token is also an ERC-20 compliant token.  
As such, it implements both the standard token methods and the standard token events.

### Methods

**stage**
```cs
function stage() public constant returns (uint8 stage)
```
Gets the token stage. Possible return values are 0 (Managed), 1 (Crowdsale) or 2 (Traded).
<br>
<br>
<br>
**reserveTokens**
```cs
function reserveTokens() public constant returns (address[] reserveTokens)
```
Gets an array of reserve token contract addresses.
<br>
<br>
<br>
**reserveRatioOf**
```cs
function reserveRatioOf(address _reserveToken) public constant returns (uint8)
```
Gets the constant reserve ratio (CRR) of a reserve token.
<br>
<br>
<br>
**buy**
```cs
function buy(address _reserveToken, uint256 _depositAmount, uint256 _minimumValue) public returns (uint256 value)
```
Buys the token by depositing in one of its reserve tokens.  
The conversion will only take place if it returns a value greater or equal to `_minimumValue`.
<br>
<br>
<br>
**sell**
```cs
function sell(address _reserveToken, uint256 _sellAmount, uint256 _minimumValue) public returns (uint256 value)
```
Sells the token for one of its reserve tokens.  
The conversion will only take place if it returns a value greater or equal to `_minimumValue`.

### Events

**Update**
```cs
event Update();
```
Triggered when a reserve is defined, the total supply is issued/destroyed and when the stage changes.
<br>
<br>
<br>
**Conversion**
```cs
event Conversion(address indexed _reserveToken, address indexed _trader, bool _isPurchase,
                 uint256 _totalSupply, uint256 _reserveBalance, uint256 _tokenAmount, uint256 _reserveAmount);
```
Triggered when a conversion between the token and one of the reserve tokens takes place.

## License

Bancor is open source and distributed under...
