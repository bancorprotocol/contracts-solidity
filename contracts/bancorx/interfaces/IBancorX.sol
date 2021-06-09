// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @dev Bancor X interface
 */
interface IBancorX {
    function token() external view returns (IERC20);

    function xTransfer(
        bytes32 toBlockchain,
        bytes32 to,
        uint256 amount,
        uint256 id
    ) external;

    function getXTransferAmount(uint256 xTransferId, address receiver) external view returns (uint256);
}
