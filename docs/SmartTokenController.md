# Contract `SmartTokenController`



#### Functions:
- `constructor(contract ISmartToken _token)`
- `transferTokenOwnership(address _newOwner)`
- `acceptTokenOwnership()`
- `disableTokenTransfers(bool _disable)`
- `withdrawFromToken(contract IERC20Token _token, address _to, uint256 _amount)`


---

#### Function `constructor(contract ISmartToken _token)`
constructor
#### Function `transferTokenOwnership(address _newOwner)`
allows transferring the token ownership
the new owner needs to accept the transfer
can only be called by the contract owner

###### Parameters:
- `_newOwner`:    new token owner
#### Function `acceptTokenOwnership()`
used by a new owner to accept a token ownership transfer
can only be called by the contract owner
#### Function `disableTokenTransfers(bool _disable)`
disables/enables token transfers
can only be called by the contract owner

###### Parameters:
- `_disable`:    true to disable transfers, false to enable them
#### Function `withdrawFromToken(contract IERC20Token _token, address _to, uint256 _amount)`
withdraws tokens held by the controller and sends them to an account
can only be called by the owner

###### Parameters:
- `_token`:   ERC20 token contract address

- `_to`:      account to receive the new amount

- `_amount`:  amount to withdraw



