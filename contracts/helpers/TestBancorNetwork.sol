// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "../BancorNetwork.sol";

contract ConverterV27OrLowerWithoutFallback {
    receive() external payable {
        revert();
    }
}

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
    constructor(IContractRegistry registry) public BancorNetwork(registry) {}

    function isV28OrHigherConverterExternal(IConverter converter) external view returns (bool) {
        return super._isV28OrHigherConverter(converter);
    }
}
