// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract TokenHandler {
    bytes4 private constant APPROVE_FUNC_SELECTOR = bytes4(keccak256("approve(address,uint256)"));
    bytes4 private constant TRANSFER_FUNC_SELECTOR = bytes4(keccak256("transfer(address,uint256)"));
    bytes4 private constant TRANSFER_FROM_FUNC_SELECTOR = bytes4(keccak256("transferFrom(address,address,uint256)"));

    /**
     * @dev executes the ERC20 token's `approve` function and reverts upon failure
     * the main purpose of this function is to prevent a non standard ERC20 token
     * from failing silently
     *
     * @param _token   ERC20 token address
     * @param _spender approved address
     * @param _value   allowance amount
     */
    function safeApprove(
        IERC20 _token,
        address _spender,
        uint256 _value
    ) internal {
        (bool success, bytes memory data) =
            address(_token).call(abi.encodeWithSelector(APPROVE_FUNC_SELECTOR, _spender, _value));
        require(success && (data.length == 0 || abi.decode(data, (bool))), "ERR_APPROVE_FAILED");
    }

    /**
     * @dev executes the ERC20 token's `transfer` function and reverts upon failure
     * the main purpose of this function is to prevent a non standard ERC20 token
     * from failing silently
     *
     * @param _token   ERC20 token address
     * @param _to      target address
     * @param _value   transfer amount
     */
    function safeTransfer(
        IERC20 _token,
        address _to,
        uint256 _value
    ) internal {
        (bool success, bytes memory data) =
            address(_token).call(abi.encodeWithSelector(TRANSFER_FUNC_SELECTOR, _to, _value));
        require(success && (data.length == 0 || abi.decode(data, (bool))), "ERR_TRANSFER_FAILED");
    }

    /**
     * @dev executes the ERC20 token's `transferFrom` function and reverts upon failure
     * the main purpose of this function is to prevent a non standard ERC20 token
     * from failing silently
     *
     * @param _token   ERC20 token address
     * @param _from    source address
     * @param _to      target address
     * @param _value   transfer amount
     */
    function safeTransferFrom(
        IERC20 _token,
        address _from,
        address _to,
        uint256 _value
    ) internal {
        (bool success, bytes memory data) =
            address(_token).call(abi.encodeWithSelector(TRANSFER_FROM_FUNC_SELECTOR, _from, _to, _value));
        require(success && (data.length == 0 || abi.decode(data, (bool))), "ERR_TRANSFER_FROM_FAILED");
    }
}
