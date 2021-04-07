// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;
import "../converter/interfaces/ITypedConverterCustomFactory.sol";

contract TestTypedConverterCustomFactory is ITypedConverterCustomFactory {
    function converterType() external pure override returns (uint16) {
        return 9;
    }
}
