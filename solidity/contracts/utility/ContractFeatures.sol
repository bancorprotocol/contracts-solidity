pragma solidity ^0.4.21;
import './interfaces/IContractFeatures.sol';

/**
    Contract Features

    Generic contract that allows every contract on the blockchain to define which features it supports.
    Other contracts can query this contract to find out whether a given contract on the
    blockchain supports a certain feature.
    Each contract type can define its own list of feature flags.
    Features can be only enabled/disabled by the contract they are defined for.

    Features should be defined by each contract type as bit flags, e.g. -
    let FEATURE1 = 1 << 0;
    let FEATURE2 = 1 << 1;
    let FEATURE3 = 1 << 2;
    ...
*/
contract ContractFeatures is IContractFeatures {
    mapping (address => uint256) private featureFlags;

    /**
        @dev constructor
    */
    function ContractFeatures() public {
    }

    /**
        @dev returns true if a given contract supports the given feature, false if not

        @param _contract    contract address to check support for
        @param _feature     feature to check for

        @return true if the contract supports the feature, false if not
    */
    function isSupported(address _contract, uint256 _feature) public returns (bool) {
        return (featureFlags[_contract] & _feature) == _feature;
    }

    /**
        @dev allows a contract to enable/disable a certain feature

        @param _feature feature to enable/disable
        @param _enable  true to enable the feature, false to disabled it
    */
    function enableFeature(uint256 _feature, bool _enable) public {
        if (_enable) {
            if (isSupported(msg.sender, _feature))
                return;

            featureFlags[msg.sender] |= _feature;
        } else {
            if (!isSupported(msg.sender, _feature))
                return;

            featureFlags[msg.sender] &= ~_feature;
        }
    }
}
