# Contract `BancorConverterRegistry`



#### Functions:
- `constructor()`
- `tokenCount()`
- `converterCount(address _token)`
- `converterAddress(address _token, uint32 _index)`
- `tokenAddress(address _converter)`
- `registerConverter(address _token, address _converter)`
- `unregisterConverter(address _token, uint32 _index)`

#### Events:
- `ConverterAddition(address _token, address _address)`
- `ConverterRemoval(address _token, address _address)`

---

#### Function `constructor()`
constructor
#### Function `tokenCount() → uint256`
returns the number of tokens in the registry

#### Function `converterCount(address _token) → uint256`
returns the number of converters associated with the given token
or 0 if the token isn&#x27;t registered

###### Parameters:
- `_token`:   token address

#### Function `converterAddress(address _token, uint32 _index) → address`
returns the converter address associated with the given token
or zero address if no such converter exists

###### Parameters:
- `_token`:   token address

- `_index`:   converter index

#### Function `tokenAddress(address _converter) → address`
returns the token address associated with the given converter
or zero address if no such converter exists

###### Parameters:
- `_converter`:   converter address

#### Function `registerConverter(address _token, address _converter)`
adds a new converter address for a given token to the registry
throws if the converter is already registered

###### Parameters:
- `_token`:       token address

- `_converter`:   converter address
#### Function `unregisterConverter(address _token, uint32 _index)`
removes an existing converter from the registry
note that the function doesn&#x27;t scale and might be needed to be called
multiple times when removing an older converter from a large converter list

###### Parameters:
- `_token`:   token address

- `_index`:   converter index

#### Event `ConverterAddition(address _token, address _address)`
No description
#### Event `ConverterRemoval(address _token, address _address)`
No description


