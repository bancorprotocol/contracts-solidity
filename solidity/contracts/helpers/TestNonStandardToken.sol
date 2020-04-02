pragma solidity 0.4.26;

contract TestNonStandardToken {
    bool private ok;
    mapping (address => uint256) private dummy;

    function set(bool _ok) public {
        ok = _ok;
    }

    function approve(address _spender, uint256 _value) public {
        require(ok);
        dummy[_spender] = _value;
    }

    function transfer(address _to, uint256 _value) public {
        require(ok);
        dummy[_to] = _value;
    }

    function transferFrom(address _from, address _to, uint256 _value) public {
        require(ok);
        dummy[_from] = _value;
        dummy[_to] = _value;
    }
}
