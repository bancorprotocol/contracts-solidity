The smart token controller is an upgradable part of the smart token that allows
more functionality as well as fixes for bugs/exploits.
Once it accepts ownership of the token, it becomes the token's sole controller
that can execute any of its functions.

To upgrade the controller, ownership must be transferred to a new controller, along with
any relevant data.

The smart token must be set on construction and cannot be changed afterwards.
Wrappers are provided (as opposed to a single 'execute' function) for each of the token's functions, for easier access.

Note that the controller can transfer token ownership to a new controller that
doesn't allow executing any function on the token, for a trustless solution.
Doing that will also remove the owner's ability to upgrade the controller.

# Functions:
- [`constructor(contract ISmartToken _token)`](#SmartTokenController-constructor-contract-ISmartToken-)
- [`transferTokenOwnership(address _newOwner)`](#SmartTokenController-transferTokenOwnership-address-)
- [`acceptTokenOwnership()`](#SmartTokenController-acceptTokenOwnership--)
- [`disableTokenTransfers(bool _disable)`](#SmartTokenController-disableTokenTransfers-bool-)
- [`withdrawFromToken(contract IERC20Token _token, address _to, uint256 _amount)`](#SmartTokenController-withdrawFromToken-contract-IERC20Token-address-uint256-)
- [`claimTokens(address _from, uint256 _amount)`](#SmartTokenController-claimTokens-address-uint256-)
- [`setBancorX(address _bancorX)`](#SmartTokenController-setBancorX-address-)



# Function `constructor(contract ISmartToken _token)` {#SmartTokenController-constructor-contract-ISmartToken-}
initializes a new SmartTokenController instance


## Parameters:
- `_token`:      smart token governed by the controller


# Function `transferTokenOwnership(address _newOwner)` {#SmartTokenController-transferTokenOwnership-address-}
allows transferring the token ownership
the new owner needs to accept the transfer
can only be called by the contract owner


## Parameters:
- `_newOwner`:    new token owner


# Function `acceptTokenOwnership()` {#SmartTokenController-acceptTokenOwnership--}
used by a new owner to accept a token ownership transfer
can only be called by the contract owner


# Function `disableTokenTransfers(bool _disable)` {#SmartTokenController-disableTokenTransfers-bool-}
disables/enables token transfers
can only be called by the contract owner


## Parameters:
- `_disable`:    true to disable transfers, false to enable them


# Function `withdrawFromToken(contract IERC20Token _token, address _to, uint256 _amount)` {#SmartTokenController-withdrawFromToken-contract-IERC20Token-address-uint256-}
withdraws tokens held by the controller and sends them to an account
can only be called by the owner


## Parameters:
- `_token`:   ERC20 token contract address

- `_to`:      account to receive the new amount

- `_amount`:  amount to withdraw


# Function `claimTokens(address _from, uint256 _amount)` {#SmartTokenController-claimTokens-address-uint256-}
allows the associated BancorX contract to claim tokens from any address (so that users
dont have to first give allowance when calling BancorX)


## Parameters:
- `_from`:      address to claim the tokens from

- `_amount`:    the amount of tokens to claim


# Function `setBancorX(address _bancorX)` {#SmartTokenController-setBancorX-address-}
allows the owner to set the associated BancorX contract

## Parameters:
- `_bancorX`:    BancorX contract


