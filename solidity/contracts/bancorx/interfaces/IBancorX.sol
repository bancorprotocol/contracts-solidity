// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;
import "../../token/interfaces/IERC20Token.sol";

interface IBancorX {
    function token() external view returns (IERC20Token);
    function xTransfer(bytes32 _toBlockchain, bytes32 _to, uint256 _amount, uint256 _id) external;
    function getXTransferAmount(uint256 _xTransferId, address _for) external view returns (uint256);
}
