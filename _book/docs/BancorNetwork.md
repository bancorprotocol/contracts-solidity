# Contract `BancorNetwork`



#### Functions:
- [`constructor(contract IContractRegistry _registry)`](#BancorNetwork-constructor-contract-IContractRegistry)
- [`setRegistry(contract IContractRegistry _registry)`](#BancorNetwork-setRegistry-contract-IContractRegistry)
- [`setSignerAddress(address _signerAddress)`](#BancorNetwork-setSignerAddress-address)
- [`registerEtherToken(contract IEtherToken _token, bool _register)`](#BancorNetwork-registerEtherToken-contract-IEtherToken-bool)
- [`convertFor(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn, address _for)`](#BancorNetwork-convertFor-contract-IERC20Token[]-uint256-uint256-address)
- [`convertForPrioritized3(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn, address _for, uint256 _customVal, uint256 _block, uint8 _v, bytes32 _r, bytes32 _s)`](#BancorNetwork-convertForPrioritized3-contract-IERC20Token[]-uint256-uint256-address-uint256-uint256-uint8-bytes32-bytes32)
- [`xConvert(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn, bytes32 _toBlockchain, bytes32 _to, uint256 _conversionId)`](#BancorNetwork-xConvert-contract-IERC20Token[]-uint256-uint256-bytes32-bytes32-uint256)
- [`xConvertPrioritized(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn, bytes32 _toBlockchain, bytes32 _to, uint256 _conversionId, uint256 _block, uint8 _v, bytes32 _r, bytes32 _s)`](#BancorNetwork-xConvertPrioritized-contract-IERC20Token[]-uint256-uint256-bytes32-bytes32-uint256-uint256-uint8-bytes32-bytes32)
- [`getReturn(address _dest, address _fromToken, address _toToken, uint256 _amount)`](#BancorNetwork-getReturn-address-address-address-uint256)
- [`getReturnByPath(contract IERC20Token[] _path, uint256 _amount)`](#BancorNetwork-getReturnByPath-contract-IERC20Token[]-uint256)
- [`claimAndConvertFor(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn, address _for)`](#BancorNetwork-claimAndConvertFor-contract-IERC20Token[]-uint256-uint256-address)
- [`convert(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn)`](#BancorNetwork-convert-contract-IERC20Token[]-uint256-uint256)
- [`claimAndConvert(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn)`](#BancorNetwork-claimAndConvert-contract-IERC20Token[]-uint256-uint256)
- [`convertForPrioritized2(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn, address _for, uint256 _block, uint8 _v, bytes32 _r, bytes32 _s)`](#BancorNetwork-convertForPrioritized2-contract-IERC20Token[]-uint256-uint256-address-uint256-uint8-bytes32-bytes32)
- [`convertForPrioritized(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn, address _for, uint256 _block, uint256 _nonce, uint8 _v, bytes32 _r, bytes32 _s)`](#BancorNetwork-convertForPrioritized-contract-IERC20Token[]-uint256-uint256-address-uint256-uint256-uint8-bytes32-bytes32)


---

#### Function `constructor(contract IContractRegistry _registry)` {#BancorNetwork-constructor-contract-IContractRegistry}
constructor

###### Parameters:
- `_registry`:    address of a contract registry contract
#### Function `setRegistry(contract IContractRegistry _registry)` {#BancorNetwork-setRegistry-contract-IContractRegistry}
No description
#### Function `setSignerAddress(address _signerAddress)` {#BancorNetwork-setSignerAddress-address}
No description
#### Function `registerEtherToken(contract IEtherToken _token, bool _register)` {#BancorNetwork-registerEtherToken-contract-IEtherToken-bool}
allows the owner to register/unregister ether tokens

###### Parameters:
- `_token`:       ether token contract address

- `_register`:    true to register, false to unregister
#### Function `convertFor(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn, address _for) → uint256` {#BancorNetwork-convertFor-contract-IERC20Token[]-uint256-uint256-address}
converts the token to any other token in the bancor network by following
a predefined conversion path and transfers the result tokens to a target account
note that the converter should already own the source tokens

###### Parameters:
- `_path`:        conversion path, see conversion path format above

- `_amount`:      amount to convert from (in the initial source token)

- `_minReturn`:   if the conversion results in an amount smaller than the minimum return - it is cancelled, must be nonzero

- `_for`:         account that will receive the conversion result

#### Function `convertForPrioritized3(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn, address _for, uint256 _customVal, uint256 _block, uint8 _v, bytes32 _r, bytes32 _s) → uint256` {#BancorNetwork-convertForPrioritized3-contract-IERC20Token[]-uint256-uint256-address-uint256-uint256-uint8-bytes32-bytes32}
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

#### Function `xConvert(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn, bytes32 _toBlockchain, bytes32 _to, uint256 _conversionId) → uint256` {#BancorNetwork-xConvert-contract-IERC20Token[]-uint256-uint256-bytes32-bytes32-uint256}
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

#### Function `xConvertPrioritized(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn, bytes32 _toBlockchain, bytes32 _to, uint256 _conversionId, uint256 _block, uint8 _v, bytes32 _r, bytes32 _s) → uint256` {#BancorNetwork-xConvertPrioritized-contract-IERC20Token[]-uint256-uint256-bytes32-bytes32-uint256-uint256-uint8-bytes32-bytes32}
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

#### Function `getReturn(address _dest, address _fromToken, address _toToken, uint256 _amount) → uint256, uint256` {#BancorNetwork-getReturn-address-address-address-uint256}
No description
#### Function `getReturnByPath(contract IERC20Token[] _path, uint256 _amount) → uint256, uint256` {#BancorNetwork-getReturnByPath-contract-IERC20Token[]-uint256}
returns the expected return amount for converting a specific amount by following
a given conversion path.
notice that there is no support for circular paths.

###### Parameters:
- `_path`:        conversion path, see conversion path format above

- `_amount`:      amount to convert from (in the initial source token)

#### Function `claimAndConvertFor(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn, address _for) → uint256` {#BancorNetwork-claimAndConvertFor-contract-IERC20Token[]-uint256-uint256-address}
claims the caller's tokens, converts them to any other token in the bancor network
by following a predefined conversion path and transfers the result tokens to a target account
note that allowance must be set beforehand

###### Parameters:
- `_path`:        conversion path, see conversion path format above

- `_amount`:      amount to convert from (in the initial source token)

- `_minReturn`:   if the conversion results in an amount smaller than the minimum return - it is cancelled, must be nonzero

- `_for`:         account that will receive the conversion result

#### Function `convert(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn) → uint256` {#BancorNetwork-convert-contract-IERC20Token[]-uint256-uint256}
converts the token to any other token in the bancor network by following
a predefined conversion path and transfers the result tokens back to the sender
note that the converter should already own the source tokens

###### Parameters:
- `_path`:        conversion path, see conversion path format above

- `_amount`:      amount to convert from (in the initial source token)

- `_minReturn`:   if the conversion results in an amount smaller than the minimum return - it is cancelled, must be nonzero

#### Function `claimAndConvert(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn) → uint256` {#BancorNetwork-claimAndConvert-contract-IERC20Token[]-uint256-uint256}
claims the caller's tokens, converts them to any other token in the bancor network
by following a predefined conversion path and transfers the result tokens back to the sender
note that allowance must be set beforehand

###### Parameters:
- `_path`:        conversion path, see conversion path format above

- `_amount`:      amount to convert from (in the initial source token)

- `_minReturn`:   if the conversion results in an amount smaller than the minimum return - it is cancelled, must be nonzero

#### Function `convertForPrioritized2(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn, address _for, uint256 _block, uint8 _v, bytes32 _r, bytes32 _s) → uint256` {#BancorNetwork-convertForPrioritized2-contract-IERC20Token[]-uint256-uint256-address-uint256-uint8-bytes32-bytes32}
No description
#### Function `convertForPrioritized(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn, address _for, uint256 _block, uint256 _nonce, uint8 _v, bytes32 _r, bytes32 _s) → uint256` {#BancorNetwork-convertForPrioritized-contract-IERC20Token[]-uint256-uint256-address-uint256-uint256-uint8-bytes32-bytes32}
No description

