// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "@openzeppelin/contracts/drafts/ERC20Permit.sol";

/**
 * @dev ERC20 token supports Permit
 */
contract TestERC20PermitToken is ERC20Permit {
    constructor() public ERC20("PermitTestToken", "PermitTestToken") ERC20Permit("PermitTestToken"){}

    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }
}
