// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;
import "../BancorNetwork.sol";
import "./TestConverters.sol";

contract TestBancorNetwork is BancorNetwork {
    OldConverter private oldConverter;
    NewConverter private newConverter;

    constructor(uint256 _amount, uint256 _fee) public BancorNetwork(IContractRegistry(address(1))) {
        oldConverter = new OldConverter(_amount);
        newConverter = new NewConverter(_amount, _fee);
    }

    function isV28OrHigherConverterExternal(IConverter _converter) external view returns (bool) {
        return super.isV28OrHigherConverter(_converter);
    }

    function getReturnOld() external view returns (uint256, uint256) {
        return getReturn(IConverter(payable(address(oldConverter))), IERC20Token(0), IERC20Token(0), uint256(0));
    }

    function getReturnNew() external view returns (uint256, uint256) {
        return getReturn(IConverter(payable(address(newConverter))), IERC20Token(0), IERC20Token(0), uint256(0));
    }
}
