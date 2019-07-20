# Contract `BancorPriceFloor`



#### Functions:
- `constructor(contract ISmartToken _token)`
- `sell()`
- `withdraw(uint256 _amount)`
- `fallback()`


---

#### Function `constructor(contract ISmartToken _token)`
constructor

###### Parameters:
- `_token`:   smart token the contract allows selling
#### Function `sell() → uint256 amount`
sells the smart token for ETH
note that the function will sell the full allowance amount

#### Function `withdraw(uint256 _amount)`
withdraws ETH from the contract

###### Parameters:
- `_amount`:  amount of ETH to withdraw
#### Function `fallback()`
deposits ETH in the contract



