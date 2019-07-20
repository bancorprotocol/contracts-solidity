

# Functions:
- [`constructor(uint256 _gasPrice)`](#BancorGasPriceLimit-constructor-uint256-)
- [`setGasPrice(uint256 _gasPrice)`](#BancorGasPriceLimit-setGasPrice-uint256-)
- [`validateGasPrice(uint256 _gasPrice)`](#BancorGasPriceLimit-validateGasPrice-uint256-)


# Function `constructor(uint256 _gasPrice)` {#BancorGasPriceLimit-constructor-uint256-}
initializes a new BancorGasPriceLimit instance

## Parameters:
- `_gasPrice`:    gas price limit
# Function `setGasPrice(uint256 _gasPrice)` {#BancorGasPriceLimit-setGasPrice-uint256-}
allows the owner to update the gas price limit

## Parameters:
- `_gasPrice`:    new gas price limit
# Function `validateGasPrice(uint256 _gasPrice)` {#BancorGasPriceLimit-validateGasPrice-uint256-}
validate that the given gas price is equal to the current network gas price

## Parameters:
- `_gasPrice`:    tested gas price

