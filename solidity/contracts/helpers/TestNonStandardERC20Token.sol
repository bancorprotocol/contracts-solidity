pragma solidity 0.4.26;
import '../utility/Utils.sol';
import '../utility/SafeMath.sol';

/**
  * ERC20 Non-Standard Token implementation
*/
contract TestNonStandardERC20Token is Utils {
    using SafeMath for uint256;

    string public name;
    string public symbol;
    uint8 public decimals;
    uint256 public totalSupply;
    mapping (address => uint256) public balanceOf;
    mapping (address => mapping (address => uint256)) public allowance;

    event Transfer(address indexed _from, address indexed _to, uint256 _value);
    event Approval(address indexed _owner, address indexed _spender, uint256 _value);

    /**
      * @dev initializes a new TestNonStandardERC20Token instance
      * 
      * @param _name        token name
      * @param _symbol      token symbol
      * @param _decimals    decimal points
      * @param _supply      initial supply
    */
    constructor(string _name, string _symbol, uint8 _decimals, uint256 _supply)
        internal
    {
        name = _name;
        symbol = _symbol;
        decimals = _decimals;
        totalSupply = _supply;
        balanceOf[msg.sender] = _supply;
    }

    /**
      * @dev send coins
      * throws on any error rather then return a false flag to minimize user errors
      * 
      * @param _to      target address
      * @param _value   transfer amount
      * 
      * @return true if the transfer was successful, false if it wasn't
    */
    function _transfer(address _to, uint256 _value)
        internal
        validAddress(_to)
    {
        balanceOf[msg.sender] = balanceOf[msg.sender].sub(_value);
        balanceOf[_to] = balanceOf[_to].add(_value);
        emit Transfer(msg.sender, _to, _value);
    }

    /**
      * @dev an account/contract attempts to get the coins
      * throws on any error rather then return a false flag to minimize user errors
      * 
      * @param _from    source address
      * @param _to      target address
      * @param _value   transfer amount
      * 
      * @return true if the transfer was successful, false if it wasn't
    */
    function _transferFrom(address _from, address _to, uint256 _value)
        internal
        validAddress(_from)
        validAddress(_to)
    {
        allowance[_from][msg.sender] = allowance[_from][msg.sender].sub(_value);
        balanceOf[_from] = balanceOf[_from].sub(_value);
        balanceOf[_to] = balanceOf[_to].add(_value);
        emit Transfer(_from, _to, _value);
    }

    /**
      * @dev allow another account/contract to spend some tokens on your behalf
      * throws on any error rather then return a false flag to minimize user errors
      * 
      * also, to minimize the risk of the approve/transferFrom attack vector
      * (see https://docs.google.com/document/d/1YLPtQxZu1UAvO9cZ1O2RPXBbT0mooh4DYKjA_jp-RLM/), approve has to be called twice
      * in 2 separate transactions - once to change the allowance to 0 and secondly to change it to the new allowance value
      * 
      * @param _spender approved address
      * @param _value   allowance amount
      * 
      * @return true if the approval was successful, false if it wasn't
    */
    function _approve(address _spender, uint256 _value)
        internal
        validAddress(_spender)
    {
        // if the allowance isn't 0, it can only be updated to 0 to prevent an allowance change immediately after withdrawal
        require(_value == 0 || allowance[msg.sender][_spender] == 0);

        allowance[msg.sender][_spender] = _value;
        emit Approval(msg.sender, _spender, _value);
    }
}

contract TestNonStandardToken is TestNonStandardERC20Token {
    bool public ok;

    constructor(string _name, string _symbol, uint8 _decimals, uint256 _supply) public
        TestNonStandardERC20Token(_name, _symbol, _decimals, _supply) {
        set(true);
    }

    function set(bool _ok) public {
        ok = _ok;
    }

    function approve(address _spender, uint256 _value) public {
        _approve(_spender, _value);
        require(ok);
    }

    function transfer(address _to, uint256 _value) public {
        _transfer(_to, _value);
        require(ok);
    }

    function transferFrom(address _from, address _to, uint256 _value) public {
        _transferFrom(_from, _to, _value);
        require(ok);
    }
}

contract TestStandardToken is TestNonStandardERC20Token {
    bool public ok;
    bool public ret;

    constructor(string _name, string _symbol, uint8 _decimals, uint256 _supply) public
        TestNonStandardERC20Token(_name, _symbol, _decimals, _supply) {
        set(true, true);
    }

    function set(bool _ok, bool _ret) public {
        ok = _ok;
        ret = _ret;
    }

    function approve(address _spender, uint256 _value) public returns (bool) {
        _approve(_spender, _value);
        require(ok);
        return ret;
    }

    function transfer(address _to, uint256 _value) public returns (bool) {
        _transfer(_to, _value);
        require(ok);
        return ret;
    }

    function transferFrom(address _from, address _to, uint256 _value) public returns (bool) {
        _transferFrom(_from, _to, _value);
        require(ok);
        return ret;
    }
}
