// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;
import "../utility/interfaces/IChainlinkPriceOracle.sol";

/*
    Chainlink price oracle mock
*/
contract TestChainlinkPriceOracle is IChainlinkPriceOracle {
    int256 private answer;
    uint256 private timestamp;

    function setAnswer(int256 _answer) public {
        answer = _answer;
    }

    function setTimestamp(uint256 _timestamp) public {
        timestamp = _timestamp;
    }

    function latestAnswer() external view override returns (int256) {
        return answer;
    }

    function latestTimestamp() external view override returns (uint256) {
        return timestamp;
    }
}
