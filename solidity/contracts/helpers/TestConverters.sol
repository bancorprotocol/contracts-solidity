// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

contract OldConverter {
    uint256 private amount;

    constructor(uint256 _amount) public {
        amount = _amount;
    }

    function getReturn(
        IERC20 _sourceToken,
        IERC20 _targetToken,
        uint256 _amount
    ) external view returns (uint256) {
        _sourceToken;
        _targetToken;
        _amount;
        return (amount);
    }
}

contract NewConverter {
    uint256 private amount;
    uint256 private fee;

    constructor(uint256 _amount, uint256 _fee) public {
        amount = _amount;
        fee = _fee;
    }

    function getReturn(
        IERC20 _sourceToken,
        IERC20 _targetToken,
        uint256 _amount
    ) external view returns (uint256, uint256) {
        _sourceToken;
        _targetToken;
        _amount;
        return (amount, fee);
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
        revert();
    }
}
