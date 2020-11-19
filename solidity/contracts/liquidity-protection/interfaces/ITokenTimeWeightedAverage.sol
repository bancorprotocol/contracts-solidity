// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "../../token/interfaces/IERC20Token.sol";

/*
    Token Time-Weighted Average interface
*/
interface ITokenTimeWeightedAverage {
    function initialize(IERC20Token _token, uint256 _startTime) external;

    function addSample(
        IERC20Token _token,
        uint256 _n,
        uint256 _d
    ) external;

    function addPastSample(
        IERC20Token _token,
        uint256 _n,
        uint256 _d,
        uint256 _time
    ) external;

    function timeWeightedAverage(IERC20Token _token, uint256 _startTime) external view returns (uint256, uint256);

    function timeWeightedAverage(
        IERC20Token _token,
        uint256 _startTime,
        uint256 _endTime
    ) external view returns (uint256, uint256);

    function accumulator(IERC20Token _token, uint256 _time) external view returns (uint256, uint256);

    function sampleExists(IERC20Token _token, uint256 _time) external view returns (bool);

    function sampleRange(IERC20Token _token) external view returns (uint256, uint256);
}
