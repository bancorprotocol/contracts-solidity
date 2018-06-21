pragma solidity ^0.4.23;
import '../utility/interfaces/IContractFeatures.sol';

/*
    Test helper that uses the ContractFeatures contract
*/
contract TestFeatures {
    IContractFeatures public features;

    function TestFeatures(IContractFeatures _features) public {
        features = _features;
    }

    function enableFeatures(uint256 _features, bool _enable) public {
        features.enableFeatures(_features, _enable);
    }
}
