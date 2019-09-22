pragma solidity 0.4.26;
import './interfaces/IContractFeatures.sol';

/**
  * @dev Contract Features
  * 
  * Generic contract that allows every contract on the blockchain to define which features it supports.
  * Other contracts can query this contract to find out whether a given contract on the
  * blockchain supports a certain feature.
  * Each contract type can define its own list of feature flags.
  * Features can be only enabled/disabled by the contract they are defined for.
  * 
  * Features should be defined by each contract type as bit flags, e.g. -
  * uint256 public constant FEATURE1 = 1 << 0;
  * uint256 public constant FEATURE2 = 1 << 1;
  * uint256 public constant FEATURE3 = 1 << 2;
  * ...
*/
contract ContractFeatures is IContractFeatures {
    mapping (address => uint256) private featureFlags;

    /**
      * @dev triggered when a contract notifies of features it supports
      * 
      * @param _address     contract address
      * @param _features    features supported
    */
    event FeaturesAddition(address indexed _address, uint256 _features);

    /**
      * @dev triggered when a contract notifies of features it no longer supports
      * 
      * @param _address     contract address
      * @param _features    features no longer supported
    */
    event FeaturesRemoval(address indexed _address, uint256 _features);

    /**
      * @dev initializes a new ContractFeatures instance
    */
    constructor() public {
    }

    /**
      * @dev returns true if a given contract supports the given feature(s), false if not
      * 
      * @param _contract    contract address to check support for
      * @param _features    feature(s) to check for
      * 
      * @return true if the contract supports the feature(s), false if not
    */
    function isSupported(address _contract, uint256 _features) public view returns (bool) {
        return (featureFlags[_contract] & _features) == _features;
    }

    /**
      * @dev allows a contract to enable/disable certain feature(s)
      * 
      * @param _features    feature(s) to enable/disable
      * @param _enable      true to enable the feature(s), false to disabled them
    */
    function enableFeatures(uint256 _features, bool _enable) public {
        if (_enable) {
            if (isSupported(msg.sender, _features))
                return;

            featureFlags[msg.sender] |= _features;

            emit FeaturesAddition(msg.sender, _features);
        } else {
            if (!isSupported(msg.sender, _features))
                return;

            featureFlags[msg.sender] &= ~_features;

            emit FeaturesRemoval(msg.sender, _features);
        }
    }
}
