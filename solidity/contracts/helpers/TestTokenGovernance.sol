// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "@bancor/token-governance/contracts/TokenGovernance.sol";

contract TestTokenGovernance is TokenGovernance {
    constructor(IMintableToken mintableToken) public TokenGovernance(mintableToken) {}
}
