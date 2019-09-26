Non standard token registry

manages tokens who don't return true/false on transfer/transferFrom/approve but revert on failure instead 

# Functions:
- [`constructor()`](#NonStandardTokenRegistry-constructor--)
- [`setAddress(address token, bool register)`](#NonStandardTokenRegistry-setAddress-address-bool-)


# Function `constructor()` {#NonStandardTokenRegistry-constructor--}
initializes a new NonStandardTokenRegistry instance
# Function `setAddress(address token, bool register)` {#NonStandardTokenRegistry-setAddress-address-bool-}
registers/unregisters a new non standard ERC20 token in the registry


## Parameters:
- `token`:    token address

- `register`: true to register the token, false to remove it

