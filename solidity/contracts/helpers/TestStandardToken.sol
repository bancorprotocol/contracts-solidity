pragma solidity 0.4.26;
import './TestNonStandardERC20Token.sol';

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
        require(ok);
        _approve(_spender, _value);
        return ret;
    }

    function transfer(address _to, uint256 _value) public returns (bool) {
        require(ok);
        _transfer(_to, _value);
        return ret;
    }

    function transferFrom(address _from, address _to, uint256 _value) public returns (bool) {
        require(ok);
        _transferFrom(_from, _to, _value);
        return ret;
    }
}
