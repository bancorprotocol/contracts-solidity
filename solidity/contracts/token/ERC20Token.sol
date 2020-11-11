// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;
import "./interfaces/IERC20Token.sol";
import "../utility/Utils.sol";
import "../utility/SafeMath.sol";

/**
 * @dev ERC20 Standard Token implementation
 */
contract ERC20Token is IERC20Token, Utils {
    using SafeMath for uint256;

    string public override name;
    string public override symbol;
    uint8 public override decimals;
    uint256 public override totalSupply;
    mapping(address => uint256) public override balanceOf;
    mapping(address => mapping(address => uint256)) public override allowance;

    /**
     * @dev triggered when tokens are transferred between wallets
     *
     * @param _from    source address
     * @param _to      target address
     * @param _value   transfer amount
     */
    event Transfer(address indexed _from, address indexed _to, uint256 _value);

    /**
     * @dev triggered when a wallet allows another wallet to transfer tokens from on its behalf
     *
     * @param _owner   wallet that approves the allowance
     * @param _spender wallet that receives the allowance
     * @param _value   allowance amount
     */
    event Approval(address indexed _owner, address indexed _spender, uint256 _value);

    /**
     * @dev initializes a new ERC20Token instance
     *
     * @param _name        token name
     * @param _symbol      token symbol
     * @param _decimals    decimal points, for display purposes
     * @param _totalSupply total supply of token units
     */
    constructor(
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        uint256 _totalSupply
    ) public {
        // validate input
        require(bytes(_name).length > 0, "ERR_INVALID_NAME");
        require(bytes(_symbol).length > 0, "ERR_INVALID_SYMBOL");

        name = _name;
        symbol = _symbol;
        decimals = _decimals;
        totalSupply = _totalSupply;
        balanceOf[msg.sender] = _totalSupply;
    }

    /**
     * @dev transfers tokens to a given address
     * throws on any error rather then return a false flag to minimize user errors
     *
     * @param _to      target address
     * @param _value   transfer amount
     *
     * @return true if the transfer was successful, false if it wasn't
     */
    function transfer(address _to, uint256 _value) public virtual override validAddress(_to) returns (bool) {
        balanceOf[msg.sender] = balanceOf[msg.sender].sub(_value);
        balanceOf[_to] = balanceOf[_to].add(_value);
        emit Transfer(msg.sender, _to, _value);
        return true;
    }

    /**
     * @dev transfers tokens to a given address on behalf of another address
     * throws on any error rather then return a false flag to minimize user errors
     *
     * @param _from    source address
     * @param _to      target address
     * @param _value   transfer amount
     *
     * @return true if the transfer was successful, false if it wasn't
     */
    function transferFrom(
        address _from,
        address _to,
        uint256 _value
    ) public virtual override validAddress(_from) validAddress(_to) returns (bool) {
        allowance[_from][msg.sender] = allowance[_from][msg.sender].sub(_value);
        balanceOf[_from] = balanceOf[_from].sub(_value);
        balanceOf[_to] = balanceOf[_to].add(_value);
        emit Transfer(_from, _to, _value);
        return true;
    }

    /**
     * @dev allows another account/contract to transfers tokens on behalf of the caller
     * throws on any error rather then return a false flag to minimize user errors
     *
     * @param _spender approved address
     * @param _value   allowance amount
     *
     * @return true if the approval was successful, false if it wasn't
     */
    function approve(address _spender, uint256 _value) public virtual override validAddress(_spender) returns (bool) {
        allowance[msg.sender][_spender] = _value;
        emit Approval(msg.sender, _spender, _value);
        return true;
    }
}
