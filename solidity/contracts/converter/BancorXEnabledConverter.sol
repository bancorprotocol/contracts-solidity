pragma solidity ^0.4.24;

import './BancorConverter.sol';
import './interfaces/IBancorXEnabledConverter.sol';

contract BancorXEnabledConverter is BancorConverter, IBancorXEnabledConverter {
    
    /**
        @dev constructor

        @param  _token              smart token governed by the converter
        @param  _registry           address of a contract registry contract
        @param  _maxConversionFee   maximum conversion fee, represented in ppm
        @param  _connectorToken     optional, initial connector, allows defining the first connector at deployment time
        @param  _connectorWeight    optional, weight for the initial connector
    */
    constructor(
        ISmartToken _token,
        IContractRegistry _registry,
        uint32 _maxConversionFee,
        IERC20Token _connectorToken,
        uint32 _connectorWeight
    ) BancorConverter(
        _token,
        _registry,
        _maxConversionFee,
        _connectorToken,
        _connectorWeight
    ) public {}

    /**
        @dev allows the BancorX contract to claim BNT from any address (so that users
        dont have to first give allowance when calling BancorX)

        @param _from      address to claim the BNT from
        @param _amount    the amount to claim
     */
    function claimTokens(address _from, uint256 _amount) public {
        address bancorX = registry.addressOf(ContractIds.BANCOR_X);

        // only the bancorX contract may call this method
        require(msg.sender == bancorX);

        // destroy the tokens belonging to _from, and issue the same amount to bancorX contract
        token.destroy(_from, _amount);
        token.issue(bancorX, _amount);
    }
}
