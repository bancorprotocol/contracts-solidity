

# Functions:
- [`constructor()`](#TokenHolder-constructor)
- [`withdrawTokens(contract IERC20Token _token, address _to, uint256 _amount)`](#TokenHolder-withdrawTokens-contract-IERC20Token-address-uint256)


## Function `constructor()` {#TokenHolder-constructor}
constructor
## Function `withdrawTokens(contract IERC20Token _token, address _to, uint256 _amount)` {#TokenHolder-withdrawTokens-contract-IERC20Token-address-uint256}
withdraws tokens held by the contract and sends them to an account
can only be called by the owner

### Parameters:
- `_token`:   ERC20 token contract address

- `_to`:      account to receive the new amount

- `_amount`:  amount to withdraw

