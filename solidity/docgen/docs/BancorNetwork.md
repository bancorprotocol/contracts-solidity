The BancorNetwork contract is the main entry point for Bancor token conversions. It also allows for the conversion of any token in the Bancor Network to any other token in a single transaction by providing a conversion path. 

A note on Conversion Path: Conversion path is a data structure that is used when converting a token to another token in the Bancor Network when the conversion cannot necessarily be done by a single converter and might require multiple 'hops'. The path defines which converters should be used and what kind of conversion should be done in each step. 

The path format doesn't include complex structure; instead, it is represented by a single array in which each 'hop' is represented by a 2-tuple - smart token & to token. In addition, the first element is always the source token. The smart token is only used as a pointer to a converter (since converter addresses are more likely to change as opposed to smart token addresses).

Format:

[source token, smart token, to token, smart token, to token...]

# Functions:

- [`constructor(contract IContractRegistry _registry)`](#BancorNetwork-constructor-contract-IContractRegistry-)

- [`setMaxAffiliateFee(uint256 _maxAffiliateFee)`](#BancorNetwork-setMaxAffiliateFee-uint256-)

- [`setRegistry(contract IContractRegistry _registry)`](#BancorNetwork-setRegistry-contract-IContractRegistry-)

- [`setSignerAddress(address _signerAddress)`](#BancorNetwork-setSignerAddress-address-)

- [`registerEtherToken(contract IEtherToken _token, bool _register)`](#BancorNetwork-registerEtherToken-contract-IEtherToken-bool-)

- [`convertFor2(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn, address _for, address _affiliateAccount, uint256 _affiliateFee)`](#BancorNetwork-convertFor2-contract-IERC20Token---uint256-uint256-address-address-uint256-)

- [`convertForPrioritized4(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn, address _for, uint256[] _signature, address _affiliateAccount, uint256 _affiliateFee)`](#BancorNetwork-convertForPrioritized4-contract-IERC20Token---uint256-uint256-address-uint256---address-uint256-)

- [`xConvert(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn, bytes32 _toBlockchain, bytes32 _to, uint256 _conversionId)`](#BancorNetwork-xConvert-contract-IERC20Token---uint256-uint256-bytes32-bytes32-uint256-)

- [`xConvertPrioritized2(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn, bytes32 _toBlockchain, bytes32 _to, uint256 _conversionId, uint256[] _signature)`](#BancorNetwork-xConvertPrioritized2-contract-IERC20Token---uint256-uint256-bytes32-bytes32-uint256-uint256---)

- [`getReturnByPath(contract IERC20Token[] _path, uint256 _amount)`](#BancorNetwork-getReturnByPath-contract-IERC20Token---uint256-)

- [`claimAndConvertFor2(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn, address _for, address _affiliateAccount, uint256 _affiliateFee)`](#BancorNetwork-claimAndConvertFor2-contract-IERC20Token---uint256-uint256-address-address-uint256-)

- [`convert2(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn, address _affiliateAccount, uint256 _affiliateFee)`](#BancorNetwork-convert2-contract-IERC20Token---uint256-uint256-address-uint256-)

- [`claimAndConvert2(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn, address _affiliateAccount, uint256 _affiliateFee)`](#BancorNetwork-claimAndConvert2-contract-IERC20Token---uint256-uint256-address-uint256-)

- [`convert(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn)`](#BancorNetwork-convert-contract-IERC20Token---uint256-uint256-)

- [`claimAndConvert(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn)`](#BancorNetwork-claimAndConvert-contract-IERC20Token---uint256-uint256-)

- [`convertFor(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn, address _for)`](#BancorNetwork-convertFor-contract-IERC20Token---uint256-uint256-address-)

- [`claimAndConvertFor(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn, address _for)`](#BancorNetwork-claimAndConvertFor-contract-IERC20Token---uint256-uint256-address-)

- [`xConvertPrioritized(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn, bytes32 _toBlockchain, bytes32 _to, uint256 _conversionId, uint256 _block, uint8 _v, bytes32 _r, bytes32 _s)`](#BancorNetwork-xConvertPrioritized-contract-IERC20Token---uint256-uint256-bytes32-bytes32-uint256-uint256-uint8-bytes32-bytes32-)

- [`convertForPrioritized3(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn, address _for, uint256 _customVal, uint256 _block, uint8 _v, bytes32 _r, bytes32 _s)`](#BancorNetwork-convertForPrioritized3-contract-IERC20Token---uint256-uint256-address-uint256-uint256-uint8-bytes32-bytes32-)

- [`convertForPrioritized2(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn, address _for, uint256 _block, uint8 _v, bytes32 _r, bytes32 _s)`](#BancorNetwork-convertForPrioritized2-contract-IERC20Token---uint256-uint256-address-uint256-uint8-bytes32-bytes32-)

- [`convertForPrioritized(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn, address _for, uint256 _block, uint256 _nonce, uint8 _v, bytes32 _r, bytes32 _s)`](#BancorNetwork-convertForPrioritized-contract-IERC20Token---uint256-uint256-address-uint256-uint256-uint8-bytes32-bytes32-)

# Function `constructor(contract IContractRegistry _registry)` {#BancorNetwork-constructor-contract-IContractRegistry-}

initializes a new BancorNetwork instance

## Parameters:

- `_registry`:    address of a contract registry contract

# Function `setMaxAffiliateFee(uint256 _maxAffiliateFee)` {#BancorNetwork-setMaxAffiliateFee-uint256-}

allows the owner to update the maximum affiliate-fee

## Parameters:

- `_maxAffiliateFee`:   maximum affiliate-fee

# Function `setRegistry(contract IContractRegistry _registry)` {#BancorNetwork-setRegistry-contract-IContractRegistry-}

allows the owner to update the contract registry contract address

## Parameters:

- `_registry`:   address of a contract registry contract

# Function `setSignerAddress(address _signerAddress)` {#BancorNetwork-setSignerAddress-address-}

allows the owner to update the signer address

## Parameters:

- `_signerAddress`:    new signer address

# Function `registerEtherToken(contract IEtherToken _token, bool _register)` {#BancorNetwork-registerEtherToken-contract-IEtherToken-bool-}

allows the owner to register/unregister ether tokens

## Parameters:

- `_token`:       ether token contract address

- `_register`:    true to register, false to unregister

# Function `convertFor2(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn, address _for, address _affiliateAccount, uint256 _affiliateFee) → uint256` {#BancorNetwork-convertFor2-contract-IERC20Token---uint256-uint256-address-address-uint256-}

converts the token to any other token in the bancor network by following

a predefined conversion path and transfers the result tokens to a target account

note that the converter should already own the source tokens

## Parameters:

- `_path`:                conversion path, see conversion path format above

- `_amount`:              amount to convert from (in the initial source token)

- `_minReturn`:           if the conversion results in an amount smaller than the minimum return - it is cancelled, must be nonzero

- `_for`:                 account that will receive the conversion result

- `_affiliateAccount`:    affiliate account

- `_affiliateFee`:        affiliate fee in PPM

# Function `convertForPrioritized4(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn, address _for, uint256[] _signature, address _affiliateAccount, uint256 _affiliateFee) → uint256` {#BancorNetwork-convertForPrioritized4-contract-IERC20Token---uint256-uint256-address-uint256---address-uint256-}

converts the token to any other token in the bancor network

by following a predefined conversion path and transfers the result

tokens to a target account.

this version of the function also allows the verified signer

to bypass the universal gas price limit.

note that the converter should already own the source tokens

## Parameters:

- `_path`:                conversion path, see conversion path format above

- `_amount`:              amount to convert from (in the initial source token)

- `_minReturn`:           if the conversion results in an amount smaller than the minimum return - it is cancelled, must be nonzero

- `_for`:                 account that will receive the conversion result

- `_signature`:           an array of the following elements:

[0] uint256     custom value that was signed for prioritized conversion

[1] uint256     if the current block exceeded the given parameter - it is cancelled

[2] uint8       (signature[128:130]) associated with the signer address and helps to validate if the signature is legit

[3] bytes32     (signature[0:64]) associated with the signer address and helps to validate if the signature is legit

[4] bytes32     (signature[64:128]) associated with the signer address and helps to validate if the signature is legit

if the array is empty (length == 0), then the gas-price limit is verified instead of the signature

- `_affiliateAccount`:    affiliate account

- `_affiliateFee`:        affiliate fee in PPM

# Function `xConvert(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn, bytes32 _toBlockchain, bytes32 _to, uint256 _conversionId) → uint256` {#BancorNetwork-xConvert-contract-IERC20Token---uint256-uint256-bytes32-bytes32-uint256-}

converts any other token to BNT in the bancor network

by following a predefined conversion path and transfers the resulting

tokens to BancorX.

note that the network should already have been given allowance of the source token (if not ETH)

## Parameters:

- `_path`:             conversion path, see conversion path format above

- `_amount`:           amount to convert from (in the initial source token)

- `_minReturn`:        if the conversion results in an amount smaller than the minimum return - it is cancelled, must be nonzero

- `_toBlockchain`:     blockchain BNT will be issued on

- `_to`:               address/account on _toBlockchain to send the BNT to

- `_conversionId`:     pre-determined unique (if non zero) id which refers to this transaction 

# Function `xConvertPrioritized2(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn, bytes32 _toBlockchain, bytes32 _to, uint256 _conversionId, uint256[] _signature) → uint256` {#BancorNetwork-xConvertPrioritized2-contract-IERC20Token---uint256-uint256-bytes32-bytes32-uint256-uint256---}

converts any other token to BNT in the bancor network

by following a predefined conversion path and transfers the resulting

tokens to BancorX.

this version of the function also allows the verified signer

to bypass the universal gas price limit.

note that the network should already have been given allowance of the source token (if not ETH)

## Parameters:

- `_path`:            conversion path, see conversion path format above

- `_amount`:          amount to convert from (in the initial source token)

- `_minReturn`:       if the conversion results in an amount smaller than the minimum return - it is cancelled, must be nonzero

- `_toBlockchain`:    blockchain BNT will be issued on

- `_to`:              address/account on _toBlockchain to send the BNT to

- `_conversionId`:    pre-determined unique (if non zero) id which refers to this transaction 

- `_signature`:       an array of the following elements:

[0] uint256     custom value that was signed for prioritized conversion; must be equal to _amount

[1] uint256     if the current block exceeded the given parameter - it is cancelled

[2] uint8       (signature[128:130]) associated with the signer address and helps to validate if the signature is legit

[3] bytes32     (signature[0:64]) associated with the signer address and helps to validate if the signature is legit

[4] bytes32     (signature[64:128]) associated with the signer address and helps to validate if the signature is legit

if the array is empty (length == 0), then the gas-price limit is verified instead of the signature

# Function `getReturnByPath(contract IERC20Token[] _path, uint256 _amount) → uint256, uint256` {#BancorNetwork-getReturnByPath-contract-IERC20Token---uint256-}

returns the expected return amount for converting a specific amount by following

a given conversion path.

notice that there is no support for circular paths.

## Parameters:

- `_path`:        conversion path, see conversion path format above

- `_amount`:      amount to convert from (in the initial source token)

# Function `claimAndConvertFor2(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn, address _for, address _affiliateAccount, uint256 _affiliateFee) → uint256` {#BancorNetwork-claimAndConvertFor2-contract-IERC20Token---uint256-uint256-address-address-uint256-}

claims the caller's tokens, converts them to any other token in the bancor network

by following a predefined conversion path and transfers the result tokens to a target account

note that allowance must be set beforehand

## Parameters:

- `_path`:                conversion path, see conversion path format above

- `_amount`:              amount to convert from (in the initial source token)

- `_minReturn`:           if the conversion results in an amount smaller than the minimum return - it is cancelled, must be nonzero

- `_for`:                 account that will receive the conversion result

- `_affiliateAccount`:    affiliate account

- `_affiliateFee`:        affiliate fee in PPM

# Function `convert2(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn, address _affiliateAccount, uint256 _affiliateFee) → uint256` {#BancorNetwork-convert2-contract-IERC20Token---uint256-uint256-address-uint256-}

converts the token to any other token in the bancor network by following

a predefined conversion path and transfers the result tokens back to the sender

note that the converter should already own the source tokens

## Parameters:

- `_path`:                conversion path, see conversion path format above

- `_amount`:              amount to convert from (in the initial source token)

- `_minReturn`:           if the conversion results in an amount smaller than the minimum return - it is cancelled, must be nonzero

- `_affiliateAccount`:    affiliate account

- `_affiliateFee`:        affiliate fee in PPM

# Function `claimAndConvert2(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn, address _affiliateAccount, uint256 _affiliateFee) → uint256` {#BancorNetwork-claimAndConvert2-contract-IERC20Token---uint256-uint256-address-uint256-}

claims the caller's tokens, converts them to any other token in the bancor network

by following a predefined conversion path and transfers the result tokens back to the sender

note that allowance must be set beforehand

## Parameters:

- `_path`:                conversion path, see conversion path format above

- `_amount`:              amount to convert from (in the initial source token)

- `_minReturn`:           if the conversion results in an amount smaller than the minimum return - it is cancelled, must be nonzero

- `_affiliateAccount`:    affiliate account

- `_affiliateFee`:        affiliate fee in PPM

# Function `convert(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn) → uint256` {#BancorNetwork-convert-contract-IERC20Token---uint256-uint256-}

deprecated, backward compatibility

# Function `claimAndConvert(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn) → uint256` {#BancorNetwork-claimAndConvert-contract-IERC20Token---uint256-uint256-}

deprecated, backward compatibility

# Function `convertFor(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn, address _for) → uint256` {#BancorNetwork-convertFor-contract-IERC20Token---uint256-uint256-address-}

deprecated, backward compatibility

# Function `claimAndConvertFor(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn, address _for) → uint256` {#BancorNetwork-claimAndConvertFor-contract-IERC20Token---uint256-uint256-address-}

deprecated, backward compatibility

# Function `xConvertPrioritized(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn, bytes32 _toBlockchain, bytes32 _to, uint256 _conversionId, uint256 _block, uint8 _v, bytes32 _r, bytes32 _s) → uint256` {#BancorNetwork-xConvertPrioritized-contract-IERC20Token---uint256-uint256-bytes32-bytes32-uint256-uint256-uint8-bytes32-bytes32-}

deprecated, backward compatibility

# Function `convertForPrioritized3(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn, address _for, uint256 _customVal, uint256 _block, uint8 _v, bytes32 _r, bytes32 _s) → uint256` {#BancorNetwork-convertForPrioritized3-contract-IERC20Token---uint256-uint256-address-uint256-uint256-uint8-bytes32-bytes32-}

deprecated, backward compatibility

# Function `convertForPrioritized2(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn, address _for, uint256 _block, uint8 _v, bytes32 _r, bytes32 _s) → uint256` {#BancorNetwork-convertForPrioritized2-contract-IERC20Token---uint256-uint256-address-uint256-uint8-bytes32-bytes32-}

deprecated, backward compatibility

# Function `convertForPrioritized(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn, address _for, uint256 _block, uint256 _nonce, uint8 _v, bytes32 _r, bytes32 _s) → uint256` {#BancorNetwork-convertForPrioritized-contract-IERC20Token---uint256-uint256-address-uint256-uint256-uint8-bytes32-bytes32-}

deprecated, backward compatibility
