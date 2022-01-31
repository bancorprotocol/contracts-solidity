// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "../BancorNetwork.sol";

contract OldConverter {
    uint256 private _returnAmount;

    constructor(uint256 initialAmount) public {
        _returnAmount = initialAmount;
    }

    function getReturn(
        IReserveToken, /* sourceToken */
        IReserveToken, /* targetToken */
        uint256 /* amount */
    ) external view returns (uint256) {
        return (_returnAmount);
    }
}

contract NewConverter {
    uint256 private _returnAmount;
    uint256 private _fee;

    constructor(uint256 amount, uint256 fee) public {
        _returnAmount = amount;
        _fee = fee;
    }

    function getReturn(
        IReserveToken, /* sourceToken */
        IReserveToken, /* targetToken */
        uint256 /* amount */
    ) external view returns (uint256, uint256) {
        return (_returnAmount, _fee);
    }
}

contract ConverterV27OrLowerWithoutFallback {}

contract ConverterV27OrLowerWithFallback {
    receive() external payable {}
}

contract ConverterV28OrHigherWithoutFallback {
    function isV28OrHigher() public pure returns (bool) {
        return true;
    }
}

contract ConverterV28OrHigherWithFallback {
    function isV28OrHigher() public pure returns (bool) {
        return true;
    }

    receive() external payable {
        revert("ERR_REVERT");
    }
}

contract TestBancorNetwork is BancorNetwork {
    OldConverter private _oldConverter;
    NewConverter private _newConverter;
    address private _networkToken;
    address private _bancorVault;

    constructor(
        IContractRegistry registry,
        uint256 amount,
        uint256 fee
    ) public BancorNetwork(registry) {
        _oldConverter = new OldConverter(amount);
        _newConverter = new NewConverter(amount, fee);
    }

    function isV28OrHigherConverterExternal(IConverter converter) external view returns (bool) {
        return super._isV28OrHigherConverter(converter);
    }

    function getReturnOld() external view returns (uint256, uint256) {
        return _getReturn(IConverter(payable(address(_oldConverter))), IReserveToken(0), IReserveToken(0), uint256(0));
    }

    function getReturnNew() external view returns (uint256, uint256) {
        return _getReturn(IConverter(payable(address(_newConverter))), IReserveToken(0), IReserveToken(0), uint256(0));
    }

    function setNetworkToken(address networkToken) external {
        _networkToken = networkToken;
    }

    function setBancorVault(address bancorVault) external {
        _bancorVault = bancorVault;
    }

    function migrateLiquidity(
        IReserveToken reserveToken,
        address, /* provider */
        uint256, /* amount */
        uint256 availableAmount,
        uint256 originalAmount
    ) external payable {
        uint256 amountToTransfer = address(reserveToken) == _networkToken ? originalAmount : availableAmount;
        if (reserveToken.isNativeToken()) {
            assert(msg.value == amountToTransfer);
            reserveToken.safeTransfer(_bancorVault, amountToTransfer);
        } else {
            require(msg.value == 0);
            reserveToken.safeTransferFrom(msg.sender, _bancorVault, amountToTransfer);
        }
    }
}
