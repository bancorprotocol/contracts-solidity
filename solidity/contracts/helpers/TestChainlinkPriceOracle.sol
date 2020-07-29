pragma solidity 0.4.26;
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

    function latestAnswer() external view returns (int256) {
        return answer;
    }

    function latestTimestamp() external view returns (uint256) {
        return timestamp;
    }
}
