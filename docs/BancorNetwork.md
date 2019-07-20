# Contract `BancorNetwork`



#### Functions:
- `constructor(contract IContractRegistry _registry)`
- `setRegistry(contract IContractRegistry _registry)`
- `setSignerAddress(address _signerAddress)`
- `registerEtherToken(contract IEtherToken _token, bool _register)`
- `convertFor(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn, address _for)`
- `convertForPrioritized3(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn, address _for, uint256 _customVal, uint256 _block, uint8 _v, bytes32 _r, bytes32 _s)`
- `xConvert(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn, bytes32 _toBlockchain, bytes32 _to, uint256 _conversionId)`
- `xConvertPrioritized(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn, bytes32 _toBlockchain, bytes32 _to, uint256 _conversionId, uint256 _block, uint8 _v, bytes32 _r, bytes32 _s)`
- `getReturn(address _dest, address _fromToken, address _toToken, uint256 _amount)`
- `getReturnByPath(contract IERC20Token[] _path, uint256 _amount)`
- `claimAndConvertFor(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn, address _for)`
- `convert(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn)`
- `claimAndConvert(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn)`
- `convertForPrioritized2(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn, address _for, uint256 _block, uint8 _v, bytes32 _r, bytes32 _s)`
- `convertForPrioritized(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn, address _for, uint256 _block, uint256 _nonce, uint8 _v, bytes32 _r, bytes32 _s)`


---

#### Function `constructor(contract IContractRegistry _registry)`
constructor

###### Parameters:
- `_registry`:    address of a contract registry contract
#### Function `setRegistry(contract IContractRegistry _registry)`
No description
#### Function `setSignerAddress(address _signerAddress)`
No description
#### Function `registerEtherToken(contract IEtherToken _token, bool _register)`
allows the owner to register/unregister ether tokens

###### Parameters:
- `_token`:       ether token contract address

- `_register`:    true to register, false to unregister
#### Function `convertFor(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn, address _for) → uint256`
converts the token to any other token in the bancor network by following
a predefined conversion path and transfers the result tokens to a target account
note that the converter should already own the source tokens

###### Parameters:
- `_path`:        conversion path, see conversion path format above

- `_amount`:      amount to convert from (in the initial source token)

- `_minReturn`:   if the conversion results in an amount smaller than the minimum return - it is cancelled, must be nonzero

- `_for`:         account that will receive the conversion result

#### Function `convertForPrioritized3(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn, address _for, uint256 _customVal, uint256 _block, uint8 _v, bytes32 _r, bytes32 _s) → uint256`
converts the token to any other token in the bancor network
by following a predefined conversion path and transfers the result
tokens to a target account.
this version of the function also allows the verified signer
to bypass the universal gas price limit.
note that the converter should already own the source tokens

###### Parameters:
- `_path`:        conversion path, see conversion path format above

- `_amount`:      amount to convert from (in the initial source token)

- `_minReturn`:   if the conversion results in an amount smaller than the minimum return - it is cancelled, must be nonzero

- `_for`:         account that will receive the conversion result

- `_customVal`:   custom value that was signed for prioritized conversion

- `_block`:       if the current block exceeded the given parameter - it is cancelled

- `_v`:           (signature[128:130]) associated with the signer address and helps to validate if the signature is legit

- `_r`:           (signature[0:64]) associated with the signer address and helps to validate if the signature is legit

- `_s`:           (signature[64:128]) associated with the signer address and helps to validate if the signature is legit

#### Function `xConvert(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn, bytes32 _toBlockchain, bytes32 _to, uint256 _conversionId) → uint256`
converts any other token to BNT in the bancor network
by following a predefined conversion path and transfers the resulting
tokens to BancorX.
note that the network should already have been given allowance of the source token (if not ETH)

###### Parameters:
- `_path`:             conversion path, see conversion path format above

- `_amount`:           amount to convert from (in the initial source token)

- `_minReturn`:        if the conversion results in an amount smaller than the minimum return - it is cancelled, must be nonzero

- `_toBlockchain`:     blockchain BNT will be issued on

- `_to`:               address/account on _toBlockchain to send the BNT to

- `_conversionId`:     pre-determined unique (if non zero) id which refers to this transaction 

#### Function `xConvertPrioritized(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn, bytes32 _toBlockchain, bytes32 _to, uint256 _conversionId, uint256 _block, uint8 _v, bytes32 _r, bytes32 _s) → uint256`
converts any other token to BNT in the bancor network
by following a predefined conversion path and transfers the resulting
tokens to BancorX.
this version of the function also allows the verified signer
to bypass the universal gas price limit.
note that the network should already have been given allowance of the source token (if not ETH)

###### Parameters:
- `_path`:            conversion path, see conversion path format above

- `_amount`:          amount to convert from (in the initial source token)

- `_minReturn`:       if the conversion results in an amount smaller than the minimum return - it is cancelled, must be nonzero

- `_toBlockchain`:    blockchain BNT will be issued on

- `_to`:              address/account on _toBlockchain to send the BNT to

- `_conversionId`:    pre-determined unique (if non zero) id which refers to this transaction 

- `_block`:           if the current block exceeded the given parameter - it is cancelled

- `_v`:               (signature[128:130]) associated with the signer address and helps to validate if the signature is legit

- `_r`:               (signature[0:64]) associated with the signer address and helps to validate if the signature is legit

- `_s`:               (signature[64:128]) associated with the signer address and helps to validate if the signature is legit

#### Function `getReturn(address _dest, address _fromToken, address _toToken, uint256 _amount) → uint256, uint256`
No description
#### Function `getReturnByPath(contract IERC20Token[] _path, uint256 _amount) → uint256, uint256`
returns the expected return amount for converting a specific amount by following
a given conversion path.
notice that there is no support for circular paths.

###### Parameters:
- `_path`:        conversion path, see conversion path format above

- `_amount`:      amount to convert from (in the initial source token)

#### Function `claimAndConvertFor(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn, address _for) → uint256`
claims the caller&#x27;s tokens, converts them to any other token in the bancor network
by following a predefined conversion path and transfers the result tokens to a target account
note that allowance must be set beforehand

###### Parameters:
- `_path`:        conversion path, see conversion path format above

- `_amount`:      amount to convert from (in the initial source token)

- `_minReturn`:   if the conversion results in an amount smaller than the minimum return - it is cancelled, must be nonzero

- `_for`:         account that will receive the conversion result

#### Function `convert(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn) → uint256`
converts the token to any other token in the bancor network by following
a predefined conversion path and transfers the result tokens back to the sender
note that the converter should already own the source tokens

###### Parameters:
- `_path`:        conversion path, see conversion path format above

- `_amount`:      amount to convert from (in the initial source token)

- `_minReturn`:   if the conversion results in an amount smaller than the minimum return - it is cancelled, must be nonzero

#### Function `claimAndConvert(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn) → uint256`
claims the caller&#x27;s tokens, converts them to any other token in the bancor network
by following a predefined conversion path and transfers the result tokens back to the sender
note that allowance must be set beforehand

###### Parameters:
- `_path`:        conversion path, see conversion path format above

- `_amount`:      amount to convert from (in the initial source token)

- `_minReturn`:   if the conversion results in an amount smaller than the minimum return - it is cancelled, must be nonzero

#### Function `convertForPrioritized2(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn, address _for, uint256 _block, uint8 _v, bytes32 _r, bytes32 _s) → uint256`
No description
#### Function `convertForPrioritized(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn, address _for, uint256 _block, uint256 _nonce, uint8 _v, bytes32 _r, bytes32 _s) → uint256`
No description



