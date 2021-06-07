// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "../converter/interfaces/IConverterAnchor.sol";
import "../converter/interfaces/ITypedConverterAnchorFactory.sol";

import "../token/DSToken.sol";

contract TestTypedConverterAnchorFactory is ITypedConverterAnchorFactory {
    string private _name;

    constructor(string memory initialName) public {
        _name = initialName;
    }

    function converterType() external pure override returns (uint16) {
        return 8;
    }

    function name() external view override returns (string memory) {
        return _name;
    }

    function createAnchor(
        string memory, /*anchorName */
        string memory symbol,
        uint8 decimals
    ) external override returns (IConverterAnchor) {
        IConverterAnchor anchor = new DSToken(_name, symbol, decimals);
        anchor.transferOwnership(msg.sender);

        return anchor;
    }
}
