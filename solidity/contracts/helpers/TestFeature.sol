pragma solidity ^0.4.21;
import '../utility/interfaces/IContractFeatures.sol';

/*
    Test helper that uses the ContractFeatures contract
*/
contract TestFeatures {
    IContractFeatures public features;

    function TestFeatures(IContractFeatures _features) public {
        features = _features;
    }

    function enableFeature(uint256 _feature, bool _enable) public {
        features.enableFeature(_feature, _enable);
    }
}
