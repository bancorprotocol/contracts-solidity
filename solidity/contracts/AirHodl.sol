pragma solidity ^0.4.24;
import './utility/Owned.sol';
import './utility/SafeMath.sol';
import './token/interfaces/ISmartToken.sol';

contract AirHodl is Owned {
    using SafeMath for uint256;

    string public version = '0.1';

    ISmartToken public relayToken;
    uint256 public vestingPoint;
    uint256 public totalSupply;
    mapping (address => uint256) public balanceOf;

    uint256 public constant VESTING_PERIOD = 60 * 60 * 24 * 365 * 2; // number of seconds in two years

    constructor(ISmartToken _relayToken) public {
        relayToken = _relayToken;
        vestingPoint = now;
    }

    function mint(address[] _to, uint256[] _value) external ownerOnly {
        uint256 length = _to.length;
        require(length == _value.length, "list lengths are not equal");
        for (uint256 i = 0; i < length; i++) {
            require(balanceOf[_to[i]] == 0, "user already exists");
            balanceOf[_to[i]] = _value[i];
            totalSupply = totalSupply.add(_value[i]);
        }
    }

    function claim(uint256 _value) external {
        require(_value <= balanceOf[msg.sender], "insufficient balance");
        uint256 vestingPeriod = now - vestingPoint;
        if (vestingPeriod > VESTING_PERIOD)
            vestingPeriod = VESTING_PERIOD;
        uint256 totalReserve = relayToken.balanceOf(address(this));
        uint256 n = vestingPeriod.mul(totalReserve);
        uint256 d = VESTING_PERIOD.mul(totalSupply);
        bool success = relayToken.transfer(msg.sender, _value.mul(n).div(d));
        require(success, "transfer failure");
        balanceOf[msg.sender] -= _value;
        totalSupply -= _value;
    }
}
