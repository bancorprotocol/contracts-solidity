// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "../standard-pool/StandardPoolConverter.sol";

/**
 * @dev This contract is a specialized version of the converter, which implements
 * a constant conversion-rate (configurable by the owner of the converter).
 */
contract FixedRatePoolConverter is StandardPoolConverter {
    mapping(IERC20 => uint256) private _rate;

    /**
     * @dev initializes a new FixedRatePoolConverter instance
     *
     * @param  _anchor             anchor governed by the converter
     * @param  _registry           address of a contract registry contract
     * @param  _maxConversionFee   maximum conversion fee, represented in ppm
     */
    constructor(
        IConverterAnchor _anchor,
        IContractRegistry _registry,
        uint32 _maxConversionFee
    ) public StandardPoolConverter(_anchor, _registry, _maxConversionFee) {}

    /**
     * @dev returns the converter type
     *
     * @return see the converter types in the the main contract doc
     */
    function converterType() public pure override returns (uint16) {
        return 4;
    }

    /**
     * @dev returns the worth of the 1st reserve token in units of the 2nd reserve token
     *
     * @return the numerator of the rate between the 1st reserve token and the 2nd reserve token
     * @return the denominator of the rate between the 1st reserve token and the 2nd reserve token
     */
    function rate() public view returns (uint256, uint256) {
        IERC20[] memory _reserveTokens = reserveTokens();
        return (_rate[_reserveTokens[0]], _rate[_reserveTokens[1]]);
    }

    /**
     * @dev sets the worth of the 1st reserve token in units of the 2nd reserve token
     * can be executed only by the owner of the converter
     *
     * @param rateN the numerator of the rate between the 1st reserve token and the 2nd reserve token
     * @param rateD the denominator of the rate between the 1st reserve token and the 2nd reserve token
     */
    function setRate(uint256 rateN, uint256 rateD) public ownerOnly {
        require(rateN > 0 && rateD > 0, "ERR_INVALID_RATE");
        IERC20[] memory _reserveTokens = reserveTokens();
        _rate[_reserveTokens[0]] = rateN;
        _rate[_reserveTokens[1]] = rateD;
    }

    /**
     * @dev returns the expected amount and expected fee for converting one reserve to another
     *
     * @param _sourceToken address of the source reserve token contract
     * @param _targetToken address of the target reserve token contract
     * @param _amount      amount of source reserve tokens converted
     *
     * @return expected amount in units of the target reserve token
     * @return expected fee in units of the target reserve token
     */
    function targetAmountAndFee(
        IERC20 _sourceToken,
        IERC20 _targetToken,
        uint256 _amount
    ) public view override active returns (uint256, uint256) {
        return targetAmountAndFee(_sourceToken, _targetToken, 0, 0, _amount);
    }

    /**
     * @dev returns the expected amount and expected fee for converting one reserve to another
     *
     * @param _sourceToken  address of the source reserve token contract
     * @param _targetToken  address of the target reserve token contract
     * @param _amount       amount of source reserve tokens converted
     *
     * @return expected amount in units of the target reserve token
     * @return expected fee in units of the target reserve token
     */
    function targetAmountAndFee(
        IERC20 _sourceToken,
        IERC20 _targetToken,
        uint256, /* _sourceBalance */
        uint256, /* _targetBalance */
        uint256 _amount
    ) internal view override returns (uint256, uint256) {
        IERC20[] memory _reserveTokens = reserveTokens();
        require(
            (_sourceToken == _reserveTokens[0] && _targetToken == _reserveTokens[1]) ||
                (_sourceToken == _reserveTokens[1] && _targetToken == _reserveTokens[0]),
            "ERR_INVALID_RESERVES"
        );

        uint256 rateN = _rate[_sourceToken];
        uint256 rateD = _rate[_targetToken];

        uint256 amount = _amount.mul(rateN).div(rateD);

        uint256 fee = calculateFee(amount);

        return (amount - fee, fee);
    }

    /**
     * @dev returns the required amount and expected fee for converting one reserve to another
     *
     * @param _sourceToken address of the source reserve token contract
     * @param _targetToken address of the target reserve token contract
     * @param _amount      amount of target reserve tokens desired
     *
     * @return required amount in units of the source reserve token
     * @return expected fee in units of the target reserve token
     */
    function sourceAmountAndFee(
        IERC20 _sourceToken,
        IERC20 _targetToken,
        uint256 _amount
    ) public view override active returns (uint256, uint256) {
        uint256 rateN = _rate[_sourceToken];
        uint256 rateD = _rate[_targetToken];

        uint256 fee = calculateFeeInv(_amount);

        uint256 amount = _amount.add(fee).mul(rateD).div(rateN);

        return (amount, fee);
    }

    /**
     * @dev get the amount of pool tokens to mint for the caller
     * and the amount of reserve tokens to transfer from the caller
     *
     * @param _reserveTokens    address of each reserve token
     * @param _reserveAmounts   amount of each reserve token
     * @param _reserveBalances  balance of each reserve token
     * @param _totalSupply      total supply of pool tokens
     *
     * @return amount of pool tokens to mint for the caller
     * @return amount of reserve tokens to transfer from the caller
     */
    function addLiquidityAmounts(
        IERC20[] memory _reserveTokens,
        uint256[] memory _reserveAmounts,
        uint256[2] memory _reserveBalances,
        uint256 _totalSupply
    ) internal view override returns (uint256, uint256[2] memory) {
        uint256 rateN = _rate[_reserveTokens[0]];
        uint256 rateD = _rate[_reserveTokens[1]];
        uint256 n = _reserveAmounts[0].mul(rateN).add(_reserveAmounts[1]).mul(rateD);
        uint256 d = _reserveBalances[0].mul(rateN).add(_reserveBalances[1]).mul(rateD);
        uint256 amount = _totalSupply.mul(n).div(d);

        uint256[2] memory reserveAmounts;
        for (uint256 i = 0; i < 2; i++) {
            reserveAmounts[i] = _reserveAmounts[i];
        }

        return (amount, reserveAmounts);
    }

    /**
     * @dev checks whether or not at least one reserve amount is larger than zero
     *
     * @param _reserveAmounts  array of reserve amounts
     *
     * @return true if at least one of the reserve amounts is larger than zero; false otherwise
     */
    function validReserveAmounts(uint256[] memory _reserveAmounts) internal pure override returns (bool) {
        return _reserveAmounts[0] > 0 || _reserveAmounts[1] > 0;
    }
}
