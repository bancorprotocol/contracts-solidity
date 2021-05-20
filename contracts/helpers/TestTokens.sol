// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";

import "../utility/Utils.sol";

/**
 * @dev ERC20 Non-Standard Token implementation
 */
contract NonStandardToken is Utils {
    using SafeMath for uint256;

    uint256 private _totalSupply;
    mapping(address => uint256) private _balanceOf;
    mapping(address => mapping(address => uint256)) private _allowances;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(uint256 initialTotalSupply) internal {
        _totalSupply = initialTotalSupply;
        _balanceOf[msg.sender] = initialTotalSupply;
    }

    function totalSupply() external view returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address owner) external view returns (uint256) {
        return _balanceOf[owner];
    }

    function allowance(address owner, address spender) external view returns (uint256) {
        return _allowances[owner][spender];
    }

    function _transfer(address to, uint256 value) internal validAddress(to) {
        _balanceOf[msg.sender] = _balanceOf[msg.sender].sub(value);
        _balanceOf[to] = _balanceOf[to].add(value);

        emit Transfer(msg.sender, to, value);
    }

    function _transferFrom(
        address from,
        address to,
        uint256 value
    ) internal validAddress(from) validAddress(to) {
        _allowances[from][msg.sender] = _allowances[from][msg.sender].sub(value);
        _balanceOf[from] = _balanceOf[from].sub(value);
        _balanceOf[to] = _balanceOf[to].add(value);

        emit Transfer(from, to, value);
    }

    function _approve(address spender, uint256 value) internal validAddress(spender) {
        // if the allowance isn't 0, it can only be updated to 0 to prevent an allowance change immediately after withdrawal
        require(value == 0 || _allowances[msg.sender][spender] == 0, "ERR_ALREADY_APPROVED");

        _allowances[msg.sender][spender] = value;

        emit Approval(msg.sender, spender, value);
    }
}

contract NonStandardTokenDetailed is NonStandardToken {
    string private _name;
    string private _symbol;
    uint8 private _decimals;

    /**
     * @dev initializes a new NonStandardToken instance
     *
     * @param initialName token tokenName
     * @param initialSymbol token symbol
     * @param initialDecimals decimal points
     * @param initialTotalSupply initial supply
     */
    constructor(
        string memory initialName,
        string memory initialSymbol,
        uint8 initialDecimals,
        uint256 initialTotalSupply
    ) internal NonStandardToken(initialTotalSupply) {
        _name = initialName;
        _symbol = initialSymbol;
        _decimals = initialDecimals;
    }

    function name() external view returns (string memory) {
        return _name;
    }

    function symbol() external view returns (string memory) {
        return _symbol;
    }

    function decimals() external view returns (uint8) {
        return _decimals;
    }
}

contract TestNonStandardToken is NonStandardTokenDetailed {
    bool private _ok;

    constructor(
        string memory name,
        string memory symbol,
        uint8 decimals,
        uint256 initialTotalSupply
    ) public NonStandardTokenDetailed(name, symbol, decimals, initialTotalSupply) {
        set(true);
    }

    function set(bool status) public {
        _ok = status;
    }

    function approve(address spender, uint256 value) external {
        _approve(spender, value);

        require(_ok, "ERR_NOT_OK");
    }

    function transfer(address to, uint256 value) external {
        _transfer(to, value);

        require(_ok, "ERR_NOT_OK");
    }

    function transferFrom(
        address from,
        address to,
        uint256 value
    ) public {
        _transferFrom(from, to, value);

        require(_ok, "ERR_NOT_OK");
    }
}

contract TestStandardToken is NonStandardTokenDetailed {
    bool private _ok;
    bool private _ret;

    constructor(
        string memory name,
        string memory symbol,
        uint8 decimals,
        uint256 supply
    ) public NonStandardTokenDetailed(name, symbol, decimals, supply) {
        set(true, true);
    }

    function set(bool status, bool retValue) public {
        _ok = status;
        _ret = retValue;
    }

    function approve(address spender, uint256 value) public returns (bool) {
        require(_ok, "ERR_NOT_OK");

        _approve(spender, value);

        return _ret;
    }

    function transfer(address to, uint256 value) public returns (bool) {
        require(_ok, "ERR_NOT_OK");

        _transfer(to, value);

        return _ret;
    }

    function transferFrom(
        address from,
        address to,
        uint256 value
    ) public returns (bool) {
        require(_ok, "ERR_NOT_OK");

        _transferFrom(from, to, value);

        return _ret;
    }
}
