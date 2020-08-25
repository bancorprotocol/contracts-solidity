// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;
import "../utility/ReentrancyGuard.sol";


contract TestReentrancyGuardAttacker {
    TestReentrancyGuard public target;
    bool public reentrancy;
    bool public callProtectedMethod;
    bool public attacking;

    constructor(TestReentrancyGuard _target) public {
        target = _target;
    }

    function setReentrancy(bool _reentrancy) external {
        reentrancy = _reentrancy;
    }

    function setCallProtectedMethod(bool _callProtectedMethod) external {
        callProtectedMethod = _callProtectedMethod;
    }

    function run() public {
        callProtectedMethod ? target.protectedMethod() : target.unprotectedMethod();
    }

    function callback() external {
        if (!reentrancy) {
            return;
        }

        if (!attacking) {
            attacking = true;

            run();
        }

        attacking = false;
    }
}

contract TestReentrancyGuard is ReentrancyGuard {
    uint256 public calls;

    function protectedMethod() external protected {
        run();
    }

    function unprotectedMethod() external {
        run();
    }

    function run() private {
        calls++;

        TestReentrancyGuardAttacker(msg.sender).callback();
    }
}
