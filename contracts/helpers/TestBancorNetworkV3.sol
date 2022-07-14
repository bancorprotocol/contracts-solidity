// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../BancorNetwork.sol";

contract TestBancorNetworkV3 is BancorNetwork {
    IERC20 private _networkToken;
    address private _bancorVault;

    constructor(IContractRegistry registry) public BancorNetwork(registry) {}

    function setNetworkToken(IERC20 networkToken) external {
        _networkToken = networkToken;
    }

    function setBancorVault(address bancorVault) external {
        _bancorVault = bancorVault;
    }

    function depositFor(
        address, /* provider */
        address, /* pool */
        uint256 tokenAmount
    ) external payable returns (uint256) {
        _networkToken.transferFrom(msg.sender, _bancorVault, tokenAmount);
    }

    function migrateLiquidity(
        IReserveToken reserveToken,
        address, /* provider */
        uint256, /* amount */
        uint256 availableAmount,
        uint256 /* originalAmount */
    ) external payable {
        if (reserveToken.isNativeToken()) {
            assert(msg.value == availableAmount);
            reserveToken.safeTransfer(_bancorVault, availableAmount);
        } else {
            require(msg.value == 0);
            reserveToken.safeTransferFrom(msg.sender, _bancorVault, availableAmount);
        }
    }

    function tradeBySourceAmount(
        IERC20 sourceToken,
        IERC20 targetToken,
        uint256 sourceAmount,
        uint256 minReturnAmount,
        uint256 deadline,
        address /* beneficiary */
    ) external payable returns (uint256) {
        require(sourceToken != targetToken);
        require(sourceAmount > 0);
        require(minReturnAmount > 0);
        require(deadline >= block.timestamp);

        // transfer the source tokens from the caller
        sourceToken.safeTransferFrom(msg.sender, address(this), sourceAmount);

        // requires that the contract hold sufficient target tokens
        targetToken.transfer(msg.sender, sourceAmount * 2);
    }
}
