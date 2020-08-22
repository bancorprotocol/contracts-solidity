// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity >=0.6.12 <0.7.0;
import "../../token/interfaces/IERC20Token.sol";

contract IBancorX {
    function token() public view returns (IERC20Token) {this;}
    function xTransfer(bytes32 _toBlockchain, bytes32 _to, uint256 _amount, uint256 _id) public;
    function getXTransferAmount(uint256 _xTransferId, address _for) public view returns (uint256);
}
