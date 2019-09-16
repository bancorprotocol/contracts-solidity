pragma solidity 0.4.26;
import '../BancorNetwork.sol';

contract OldBancorConverter {
    uint256 private amount;

    constructor(uint256 _amount) public {
        amount = _amount;
    }

    function getReturn(IERC20Token _fromToken, IERC20Token _toToken, uint256 _amount) external view returns (uint256) {
        _fromToken;
        _toToken;
        _amount;
        return (amount);
    }
}

contract NewBancorConverter {
    uint256 private amount;
    uint256 private fee;

    constructor(uint256 _amount, uint256 _fee) public {
        amount = _amount;
        fee = _fee;
    }

    function getReturn(IERC20Token _fromToken, IERC20Token _toToken, uint256 _amount) external view returns (uint256, uint256) {
        _fromToken;
        _toToken;
        _amount;
        return (amount, fee);
    }
}

contract TestBancorNetwork is BancorNetwork {
    OldBancorConverter private oldBancorConverter;
    NewBancorConverter private newBancorConverter;

    constructor(uint256 _amount, uint256 _fee) public BancorNetwork(IContractRegistry(address(1))) {
        oldBancorConverter = new OldBancorConverter(_amount);
        newBancorConverter = new NewBancorConverter(_amount, _fee);
    }

    function getReturnOld() external view returns (uint256, uint256) {
        return getReturn(address(oldBancorConverter), IERC20Token(0), IERC20Token(0), uint256(0));
    }

    function getReturnNew() external view returns (uint256, uint256) {
        return getReturn(address(newBancorConverter), IERC20Token(0), IERC20Token(0), uint256(0));
    }
}
