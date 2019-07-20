# Contract `IBancorConverterExtended`



#### Functions:
- `token()`
- `maxConversionFee()`
- `conversionFee()`
- `connectorTokenCount()`
- `reserveTokenCount()`
- `connectorTokens(uint256 _index)`
- `reserveTokens(uint256 _index)`
- `setConversionWhitelist(contract IWhitelist _whitelist)`
- `transferTokenOwnership(address _newOwner)`
- `withdrawTokens(contract IERC20Token _token, address _to, uint256 _amount)`
- `acceptTokenOwnership()`
- `transferManagement(address _newManager)`
- `acceptManagement()`
- `setConversionFee(uint32 _conversionFee)`
- `addConnector(contract IERC20Token _token, uint32 _weight, bool _enableVirtualBalance)`
- `updateConnector(contract IERC20Token _connectorToken, uint32 _weight, bool _enableVirtualBalance, uint256 _virtualBalance)`
- `getConnectorBalance(contract IERC20Token _connectorToken)`
- `getReserveBalance(contract IERC20Token _reserveToken)`
- `reserves(address _address)`


---

#### Function `token() → contract ISmartToken`
No description
#### Function `maxConversionFee() → uint32`
No description
#### Function `conversionFee() → uint32`
No description
#### Function `connectorTokenCount() → uint16`
No description
#### Function `reserveTokenCount() → uint16`
No description
#### Function `connectorTokens(uint256 _index) → contract IERC20Token`
No description
#### Function `reserveTokens(uint256 _index) → contract IERC20Token`
No description
#### Function `setConversionWhitelist(contract IWhitelist _whitelist)`
No description
#### Function `transferTokenOwnership(address _newOwner)`
No description
#### Function `withdrawTokens(contract IERC20Token _token, address _to, uint256 _amount)`
No description
#### Function `acceptTokenOwnership()`
No description
#### Function `transferManagement(address _newManager)`
No description
#### Function `acceptManagement()`
No description
#### Function `setConversionFee(uint32 _conversionFee)`
No description
#### Function `addConnector(contract IERC20Token _token, uint32 _weight, bool _enableVirtualBalance)`
No description
#### Function `updateConnector(contract IERC20Token _connectorToken, uint32 _weight, bool _enableVirtualBalance, uint256 _virtualBalance)`
No description
#### Function `getConnectorBalance(contract IERC20Token _connectorToken) → uint256`
No description
#### Function `getReserveBalance(contract IERC20Token _reserveToken) → uint256`
No description
#### Function `reserves(address _address) → uint256 virtualBalance, uint32 weight, bool isVirtualBalanceEnabled, bool isSaleEnabled, bool isSet`
No description



