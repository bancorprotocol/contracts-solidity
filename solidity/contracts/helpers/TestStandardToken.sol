pragma solidity 0.4.26;

contract TestStandardToken {
    bool private ok;
    bool private ret;
    mapping (address => uint256) private dummy;

    function set(bool _ok, bool _ret) public {
        ok = _ok;
        ret = _ret;
    }

    function approve(address _spender, uint256 _value) public returns (bool) {
        require(ok);
        dummy[_spender] = _value;
        return ret;
    }

    function transfer(address _to, uint256 _value) public returns (bool) {
        require(ok);
        dummy[_to] = _value;
        return ret;
    }

    function transferFrom(address _from, address _to, uint256 _value) public returns (bool) {
        require(ok);
        dummy[_from] = _value;
        dummy[_to] = _value;
        return ret;
    }
}
