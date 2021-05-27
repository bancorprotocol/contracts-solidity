// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";

contract TestNonStandardToken {
    using SafeMath for uint256;

    mapping(address => uint256) private balances_;

    mapping(address => mapping(address => uint256)) private allowances_;

    uint256 private totalSupply_;

    string private name_;
    string private symbol_;
    uint8 private decimals_;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(
        string memory name,
        string memory symbol,
        uint256 totalSupply
    ) public {
        name_ = name;
        symbol_ = symbol;
        decimals_ = 18;

        _mint(msg.sender, totalSupply);
    }

    function name() public view returns (string memory) {
        return name_;
    }

    function symbol() public view returns (string memory) {
        return symbol_;
    }

    function decimals() public view returns (uint8) {
        return decimals_;
    }

    function totalSupply() public view returns (uint256) {
        return totalSupply_;
    }

    function balanceOf(address account) public view returns (uint256) {
        return balances_[account];
    }

    function transfer(address recipient, uint256 amount) public {
        _transfer(msg.sender, recipient, amount);
    }

    function allowance(address owner, address spender) public view returns (uint256) {
        return allowances_[owner][spender];
    }

    function approve(address spender, uint256 amount) public {
        _approve(msg.sender, spender, amount);
    }

    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) public {
        _transfer(sender, recipient, amount);
        _approve(
            sender,
            msg.sender,
            allowances_[sender][msg.sender].sub(amount, "ERC20: transfer amount exceeds allowance")
        );
    }

    function _transfer(
        address sender,
        address recipient,
        uint256 amount
    ) internal {
        // solhint-disable reason-string
        require(sender != address(0), "ERC20: transfer from the zero address");
        require(recipient != address(0), "ERC20: transfer to the zero address");
        // solhint-enable reason-string

        balances_[sender] = balances_[sender].sub(amount, "ERC20: transfer amount exceeds balance");
        balances_[recipient] = balances_[recipient].add(amount);
        emit Transfer(sender, recipient, amount);
    }

    function _mint(address account, uint256 amount) internal {
        require(account != address(0), "ERC20: mint to the zero address");

        totalSupply_ = totalSupply_.add(amount);
        balances_[account] = balances_[account].add(amount);

        emit Transfer(address(0), account, amount);
    }

    function _approve(
        address owner,
        address spender,
        uint256 amount
    ) internal {
        // solhint-disable reason-string
        require(owner != address(0), "ERC20: approve from the zero address");
        require(spender != address(0), "ERC20: approve to the zero address");
        // solhint-enable reason-string

        allowances_[owner][spender] = amount;

        emit Approval(owner, spender, amount);
    }
}
