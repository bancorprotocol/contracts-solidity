// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;
import "../converter/types/standard-pool/StandardPoolConverter.sol";

contract TestStandardPoolConverter is StandardPoolConverter {
    uint256 public currentTime = 1;
    uint256[2] public reserveAmountsRemoved;

    constructor(
        IDSToken _token,
        IContractRegistry _registry,
        uint32 _maxConversionFee
    ) public StandardPoolConverter(_token, _registry, _maxConversionFee) {}

    function time() internal view override returns (uint256) {
        return currentTime;
    }

    function setTime(uint256 _currentTime) public {
        currentTime = _currentTime;
    }

    function removeLiquidityTest(
        uint256 _amount,
        IERC20Token[2] memory _reserveTokens,
        uint256[2] memory _reserveMinReturnAmounts
    ) public {
        reserveAmountsRemoved = removeLiquidity(_amount, _reserveTokens, _reserveMinReturnAmounts);
    }
}
