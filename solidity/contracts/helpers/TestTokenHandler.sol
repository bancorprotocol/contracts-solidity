// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;
import "../utility/TokenHandler.sol";

/*
    Utils test helper that exposes the token handler functions
*/
contract TestTokenHandler is TokenHandler {
    function testSafeApprove(IERC20Token _token, address _spender, uint256 _value) public {
        safeApprove(_token, _spender, _value);
    }

    function testSafeTransfer(IERC20Token _token, address _to, uint256 _value) public {
        safeTransfer(_token, _to, _value);
    }

    function testSafeTransferFrom(IERC20Token _token, address _from, address _to, uint256 _value) public {
        safeTransferFrom(_token, _from, _to, _value);
    }
}
