pragma solidity 0.4.26;
import './TestNonStandardERC20Token.sol';

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
        require(ok);
        _approve(_spender, _value);
    }

    function transfer(address _to, uint256 _value) public {
        require(ok);
        _transfer(_to, _value);
    }

    function transferFrom(address _from, address _to, uint256 _value) public {
        require(ok);
        _transferFrom(_from, _to, _value);
    }
}
