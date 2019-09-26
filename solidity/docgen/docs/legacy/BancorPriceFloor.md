BancorPriceFloor

The bancor price floor contract is a simple contract that allows selling smart tokens for a constant ETH price

'Owned' is specified here for readability reasons

# Functions:
- [`constructor(contract ISmartToken _token)`](#BancorPriceFloor-constructor-contract-ISmartToken-)
- [`sell()`](#BancorPriceFloor-sell--)
- [`withdraw(uint256 _amount)`](#BancorPriceFloor-withdraw-uint256-)
- [`fallback()`](#BancorPriceFloor-fallback--)


# Function `constructor(contract ISmartToken _token)` {#BancorPriceFloor-constructor-contract-ISmartToken-}
initializes a new BancorPriceFloor instance


## Parameters:
- `_token`:   smart token the contract allows selling
# Function `sell() → uint256 amount` {#BancorPriceFloor-sell--}
sells the smart token for ETH
note that the function will sell the full allowance amount


# Function `withdraw(uint256 _amount)` {#BancorPriceFloor-withdraw-uint256-}
withdraws ETH from the contract


## Parameters:
- `_amount`:  amount of ETH to withdraw
# Function `fallback()` {#BancorPriceFloor-fallback--}
deposits ETH in the contract

