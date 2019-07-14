# Contract `SmartTokenController`



#### Functions:
- [`constructor(contract ISmartToken _token)`](#SmartTokenController-constructor-contract-ISmartToken)
- [`transferTokenOwnership(address _newOwner)`](#SmartTokenController-transferTokenOwnership-address)
- [`acceptTokenOwnership()`](#SmartTokenController-acceptTokenOwnership)
- [`disableTokenTransfers(bool _disable)`](#SmartTokenController-disableTokenTransfers-bool)
- [`withdrawFromToken(contract IERC20Token _token, address _to, uint256 _amount)`](#SmartTokenController-withdrawFromToken-contract-IERC20Token-address-uint256)


---

#### Function `constructor(contract ISmartToken _token)` {#SmartTokenController-constructor-contract-ISmartToken}
constructor
#### Function `transferTokenOwnership(address _newOwner)` {#SmartTokenController-transferTokenOwnership-address}
allows transferring the token ownership
the new owner needs to accept the transfer
can only be called by the contract owner

###### Parameters:
- `_newOwner`:    new token owner
#### Function `acceptTokenOwnership()` {#SmartTokenController-acceptTokenOwnership}
used by a new owner to accept a token ownership transfer
can only be called by the contract owner
#### Function `disableTokenTransfers(bool _disable)` {#SmartTokenController-disableTokenTransfers-bool}
disables/enables token transfers
can only be called by the contract owner

###### Parameters:
- `_disable`:    true to disable transfers, false to enable them
#### Function `withdrawFromToken(contract IERC20Token _token, address _to, uint256 _amount)` {#SmartTokenController-withdrawFromToken-contract-IERC20Token-address-uint256}
withdraws tokens held by the controller and sends them to an account
can only be called by the owner

###### Parameters:
- `_token`:   ERC20 token contract address

- `_to`:      account to receive the new amount

- `_amount`:  amount to withdraw

