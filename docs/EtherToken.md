# Contract `EtherToken`



#### Functions:
- `constructor()`
- `deposit()`
- `withdraw(uint256 _amount)`
- `withdrawTo(address _to, uint256 _amount)`
- `transfer(address _to, uint256 _value)`
- `transferFrom(address _from, address _to, uint256 _value)`
- `fallback()`

#### Events:
- `Issuance(uint256 _amount)`
- `Destruction(uint256 _amount)`

---

#### Function `constructor()`
constructor
#### Function `deposit()`
deposit ether in the account
#### Function `withdraw(uint256 _amount)`
withdraw ether from the account

###### Parameters:
- `_amount`:  amount of ether to withdraw
#### Function `withdrawTo(address _to, uint256 _amount)`
withdraw ether from the account to a target account

###### Parameters:
- `_to`:      account to receive the ether

- `_amount`:  amount of ether to withdraw
#### Function `transfer(address _to, uint256 _value) → bool success`
send coins
throws on any error rather then return a false flag to minimize user errors

###### Parameters:
- `_to`:      target address

- `_value`:   transfer amount

#### Function `transferFrom(address _from, address _to, uint256 _value) → bool success`
an account/contract attempts to get the coins
throws on any error rather then return a false flag to minimize user errors

###### Parameters:
- `_from`:    source address

- `_to`:      target address

- `_value`:   transfer amount

#### Function `fallback()`
deposit ether in the account

#### Event `Issuance(uint256 _amount)`
No description
#### Event `Destruction(uint256 _amount)`
No description


