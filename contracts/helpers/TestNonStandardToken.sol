// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TestNonStandardToken is ERC20 {
    constructor(
        string memory name,
        string memory symbol,
        uint256 totalSupply
    ) public ERC20(name, symbol) {
        _mint(msg.sender, totalSupply);
    }

    function approve(address spender, uint256 value) public override returns (bool) {
        super.approve(spender, value);
    }

    function transfer(address to, uint256 value) public override returns (bool) {
        super.transfer(to, value);
    }

    function transferFrom(
        address from,
        address to,
        uint256 value
    ) public override returns (bool) {
        super.transferFrom(from, to, value);
    }
}
