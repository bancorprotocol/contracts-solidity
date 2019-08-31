

# Functions:
- [`constructor(string _name, string _symbol, uint8 _decimals)`](#NonStandardSmartToken-constructor-string-string-uint8-)
- [`disableTransfers(bool _disable)`](#NonStandardSmartToken-disableTransfers-bool-)
- [`issue(address _to, uint256 _amount)`](#NonStandardSmartToken-issue-address-uint256-)
- [`destroy(address _from, uint256 _amount)`](#NonStandardSmartToken-destroy-address-uint256-)
- [`transfer(address _to, uint256 _value)`](#NonStandardSmartToken-transfer-address-uint256-)
- [`transferFrom(address _from, address _to, uint256 _value)`](#NonStandardSmartToken-transferFrom-address-address-uint256-)

# Events:
- [`NewSmartToken(address _token)`](#NonStandardSmartToken-NewSmartToken-address-)
- [`Issuance(uint256 _amount)`](#NonStandardSmartToken-Issuance-uint256-)
- [`Destruction(uint256 _amount)`](#NonStandardSmartToken-Destruction-uint256-)

# Function `constructor(string _name, string _symbol, uint8 _decimals)` {#NonStandardSmartToken-constructor-string-string-uint8-}
initializes a new NonStandardSmartToken instance


## Parameters:
- `_name`:       token name

- `_symbol`:     token short symbol, minimum 1 character

- `_decimals`:   for display purposes only
# Function `disableTransfers(bool _disable)` {#NonStandardSmartToken-disableTransfers-bool-}
disables/enables transfers
can only be called by the contract owner


## Parameters:
- `_disable`:    true to disable transfers, false to enable them
# Function `issue(address _to, uint256 _amount)` {#NonStandardSmartToken-issue-address-uint256-}
increases the token supply and sends the new tokens to an account
can only be called by the contract owner


## Parameters:
- `_to`:         account to receive the new amount

- `_amount`:     amount to increase the supply by
# Function `destroy(address _from, uint256 _amount)` {#NonStandardSmartToken-destroy-address-uint256-}
removes tokens from an account and decreases the token supply
can be called by the contract owner to destroy tokens from any account or by any holder to destroy tokens from his/her own account


## Parameters:
- `_from`:       account to remove the amount from

- `_amount`:     amount to decrease the supply by
# Function `transfer(address _to, uint256 _value)` {#NonStandardSmartToken-transfer-address-uint256-}
send coins
throws on any error rather then return a false flag to minimize user errors
in addition to the standard checks, the function throws if transfers are disabled


## Parameters:
- `_to`:      target address

- `_value`:   transfer amount
# Function `transferFrom(address _from, address _to, uint256 _value)` {#NonStandardSmartToken-transferFrom-address-address-uint256-}
an account/contract attempts to get the coins
throws on any error rather then return a false flag to minimize user errors
in addition to the standard checks, the function throws if transfers are disabled


## Parameters:
- `_from`:    source address

- `_to`:      target address

- `_value`:   transfer amount

# Event `NewSmartToken(address _token)` {#NonStandardSmartToken-NewSmartToken-address-}
No description
# Event `Issuance(uint256 _amount)` {#NonStandardSmartToken-Issuance-uint256-}
No description
# Event `Destruction(uint256 _amount)` {#NonStandardSmartToken-Destruction-uint256-}
No description
