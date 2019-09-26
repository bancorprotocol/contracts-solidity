Bancor Converter Registry

The Bancor Converter Registry keeps converter addresses by token addresses and vice versa. The owner can update converter addresses so that the token address always points to the updated list of converters for each token. 

The contract is also able to iterate through all the tokens in the network. 

Note that converter addresses for each token are returned in ascending order (from oldest to newest).


# Functions:
- [`constructor()`](#BancorConverterRegistry-constructor--)
- [`tokenCount()`](#BancorConverterRegistry-tokenCount--)
- [`converterCount(address _token)`](#BancorConverterRegistry-converterCount-address-)
- [`converterAddress(address _token, uint32 _index)`](#BancorConverterRegistry-converterAddress-address-uint32-)
- [`tokenAddress(address _converter)`](#BancorConverterRegistry-tokenAddress-address-)
- [`registerConverter(address _token, address _converter)`](#BancorConverterRegistry-registerConverter-address-address-)
- [`unregisterConverter(address _token, uint32 _index)`](#BancorConverterRegistry-unregisterConverter-address-uint32-)

# Events:
- [`ConverterAddition(address _token, address _address)`](#BancorConverterRegistry-ConverterAddition-address-address-)
- [`ConverterRemoval(address _token, address _address)`](#BancorConverterRegistry-ConverterRemoval-address-address-)


# Function `constructor()` {#BancorConverterRegistry-constructor--}
initializes a new BancorConverterRegistry instance


# Function `tokenCount() → uint256` {#BancorConverterRegistry-tokenCount--}
returns the number of tokens in the registry




# Function `converterCount(address _token) → uint256` {#BancorConverterRegistry-converterCount-address-}
returns the number of converters associated with the given token
or 0 if the token isn't registered


## Parameters:
- `_token`:   token address




# Function `converterAddress(address _token, uint32 _index) → address` {#BancorConverterRegistry-converterAddress-address-uint32-}
returns the converter address associated with the given token
or zero address if no such converter exists


## Parameters:
- `_token`:   token address

- `_index`:   converter index




# Function `tokenAddress(address _converter) → address` {#BancorConverterRegistry-tokenAddress-address-}
returns the token address associated with the given converter
or zero address if no such converter exists


## Parameters:
- `_converter`:   converter address




# Function `registerConverter(address _token, address _converter)` {#BancorConverterRegistry-registerConverter-address-address-}
adds a new converter address for a given token to the registry
throws if the converter is already registered


## Parameters:
- `_token`:       token address

- `_converter`:   converter address


# Function `unregisterConverter(address _token, uint32 _index)` {#BancorConverterRegistry-unregisterConverter-address-uint32-}
removes an existing converter from the registry
note that the function doesn't scale and might be needed to be called
multiple times when removing an older converter from a large converter list


## Parameters:
- `_token`:   token address

- `_index`:   converter index



# Event `ConverterAddition(address _token, address _address)` {#BancorConverterRegistry-ConverterAddition-address-address-}
triggered when a converter is added to the registry


## Parameters:
- `_token`:   token

- `_address`: converter


# Event `ConverterRemoval(address _token, address _address)` {#BancorConverterRegistry-ConverterRemoval-address-address-}
triggered when a converter is removed from the registry


## Parameters:
- `_token`:   token

- `_address`: converter

