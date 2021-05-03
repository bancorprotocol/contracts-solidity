// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

interface IBancorNetwork {
    function rateByPath(address[] memory path, uint256 sourceAmount) external view returns (uint256);

    function convertByPath(
        address[] memory path,
        uint256 sourceAmount,
        uint256 minReturn,
        address payable beneficiary,
        address affiliateAccount,
        uint256 affiliateFee
    ) external payable returns (uint256);
}
