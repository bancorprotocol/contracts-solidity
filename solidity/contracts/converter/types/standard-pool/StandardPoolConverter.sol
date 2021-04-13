// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";

import "../../ConverterVersion.sol";
import "../../interfaces/IConverter.sol";
import "../../interfaces/IConverterAnchor.sol";
import "../../interfaces/IConverterUpgrader.sol";

import "../../../utility/MathEx.sol";
import "../../../utility/ContractRegistryClient.sol";
import "../../../utility/ReentrancyGuard.sol";
import "../../../utility/Time.sol";

import "../../../token/interfaces/IDSToken.sol";
import "../../../token/ReserveToken.sol";

import "../../../INetworkSettings.sol";

/**
 * @dev This contract is a specialized version of the converter, which is
 * optimized for a liquidity pool that has 2 reserves with 50%/50% weights.
 */
contract StandardPoolConverter is ConverterVersion, IConverter, ContractRegistryClient, ReentrancyGuard, Time {
    using SafeMath for uint256;
    using ReserveToken for IReserveToken;
    using SafeERC20 for IERC20;
    using MathEx for *;

    uint256 private constant MAX_UINT128 = 2**128 - 1;
    uint256 private constant MAX_UINT112 = 2**112 - 1;
    uint256 private constant MAX_UINT32 = 2**32 - 1;
    uint256 private constant AVERAGE_RATE_PERIOD = 10 minutes;

    uint256 private _reserveBalances;
    uint256 private _reserveBalancesProduct;
    IReserveToken[] private _reserveTokens;
    mapping(IReserveToken => uint256) private _reserveIds;

    IConverterAnchor private _anchor; // converter anchor contract
    uint32 private _maxConversionFee; // maximum conversion fee, represented in ppm, 0...1000000
    uint32 private _conversionFee; // current conversion fee, represented in ppm, 0...maxConversionFee

    // average rate details:
    // bits 0...111 represent the numerator of the rate between reserve token 0 and reserve token 1
    // bits 111...223 represent the denominator of the rate between reserve token 0 and reserve token 1
    // bits 224...255 represent the update-time of the rate between reserve token 0 and reserve token 1
    // where `numerator / denominator` gives the worth of one reserve token 0 in units of reserve token 1
    uint256 private _averageRateInfo;

    /**
     * @dev triggered after liquidity is added
     *
     * @param provider liquidity provider
     * @param reserveToken reserve token address
     * @param amount reserve token amount
     * @param newBalance reserve token new balance
     * @param newSupply pool token new supply
     */
    event LiquidityAdded(
        address indexed provider,
        IReserveToken indexed reserveToken,
        uint256 amount,
        uint256 newBalance,
        uint256 newSupply
    );

    /**
     * @dev triggered after liquidity is removed
     *
     * @param provider liquidity provider
     * @param reserveToken reserve token address
     * @param amount reserve token amount
     * @param newBalance reserve token new balance
     * @param newSupply pool token new supply
     */
    event LiquidityRemoved(
        address indexed provider,
        IReserveToken indexed reserveToken,
        uint256 amount,
        uint256 newBalance,
        uint256 newSupply
    );

    /**
     * @dev initializes a new StandardPoolConverter instance
     *
     * @param anchor anchor governed by the converter
     * @param registry address of a contract registry contract
     * @param maxConversionFee  maximum conversion fee, represented in ppm
     */
    constructor(
        IConverterAnchor anchor,
        IContractRegistry registry,
        uint32 maxConversionFee
    ) public ContractRegistryClient(registry) validAddress(address(anchor)) validConversionFee(maxConversionFee) {
        _anchor = anchor;
        _maxConversionFee = maxConversionFee;
    }

    // ensures that the converter is active
    modifier active() {
        _active();

        _;
    }

    // error message binary size optimization
    function _active() internal view {
        require(isActive(), "ERR_INACTIVE");
    }

    // ensures that the converter is not active
    modifier inactive() {
        _inactive();

        _;
    }

    // error message binary size optimization
    function _inactive() internal view {
        require(!isActive(), "ERR_ACTIVE");
    }

    // validates a reserve token address - verifies that the address belongs to one of the reserve tokens
    modifier validReserve(IReserveToken reserveToken) {
        _validReserve(reserveToken);

        _;
    }

    // error message binary size optimization
    function _validReserve(IReserveToken reserveToken) internal view {
        require(_reserveIds[reserveToken] != 0, "ERR_INVALID_RESERVE");
    }

    // validates conversion fee
    modifier validConversionFee(uint32 fee) {
        _validConversionFee(fee);

        _;
    }

    // error message binary size optimization
    function _validConversionFee(uint32 fee) internal pure {
        require(fee <= PPM_RESOLUTION, "ERR_INVALID_CONVERSION_FEE");
    }

    // validates reserve weight
    modifier validReserveWeight(uint32 weight) {
        _validReserveWeight(weight);

        _;
    }

    // error message binary size optimization
    function _validReserveWeight(uint32 weight) internal pure {
        require(weight == PPM_RESOLUTION / 2, "ERR_INVALID_RESERVE_WEIGHT");
    }

    /**
     * @dev returns the converter type
     *
     * @return see the converter types in the the main contract doc
     */
    function converterType() public pure virtual override returns (uint16) {
        return 3;
    }

    /**
     * @dev checks whether or not the converter version is 28 or higher
     *
     * @return true, since the converter version is 28 or higher
     */
    function isV28OrHigher() external pure returns (bool) {
        return true;
    }

    /**
     * @dev returns the converter anchor
     *
     * @return the converter anchor
     */
    function anchor() external view override returns (IConverterAnchor) {
        return _anchor;
    }

    /**
     * @dev returns the maximum conversion fee (in units of PPM)
     *
     * @return the maximum conversion fee (in units of PPM)
     */
    function maxConversionFee() external view override returns (uint32) {
        return _maxConversionFee;
    }

    /**
     * @dev returns the current conversion fee (in units of PPM)
     *
     * @return the current conversion fee (in units of PPM)
     */
    function conversionFee() external view override returns (uint32) {
        return _conversionFee;
    }

    /**
     * @dev returns the average rate info
     *
     * @return the average rate info
     */
    function averageRateInfo() external view returns (uint256) {
        return _averageRateInfo;
    }

    /**
     * @dev deposits ether
     * can only be called if the converter has an ETH reserve
     */
    receive() external payable override(IConverter) validReserve(ReserveToken.NATIVE_TOKEN_ADDRESS) {}

    /**
     * @dev returns true if the converter is active, false otherwise
     *
     * @return true if the converter is active, false otherwise
     */
    function isActive() public view virtual override returns (bool) {
        return _anchor.owner() == address(this);
    }

    /**
     * @dev transfers the anchor ownership
     * the new owner needs to accept the transfer
     * can only be called by the converter upgrader while the upgrader is the owner
     * note that prior to version 28, you should use 'transferAnchorOwnership' instead
     *
     * @param newOwner new token owner
     */
    function transferAnchorOwnership(address newOwner) public override ownerOnly only(CONVERTER_UPGRADER) {
        _anchor.transferOwnership(newOwner);
    }

    /**
     * @dev accepts ownership of the anchor after an ownership transfer
     * most converters are also activated as soon as they accept the anchor ownership
     * can only be called by the contract owner
     * note that prior to version 28, you should use 'acceptTokenOwnership' instead
     */
    function acceptAnchorOwnership() public virtual override ownerOnly {
        // verify the the converter has exactly two reserves
        require(_reserveTokens.length == 2, "ERR_INVALID_RESERVE_COUNT");

        _anchor.acceptOwnership();
        syncReserveBalances(0);

        emit Activation(converterType(), _anchor, true);
    }

    /**
     * @dev updates the current conversion fee
     * can only be called by the contract owner
     *
     * @param fee new conversion fee, represented in ppm
     */
    function setConversionFee(uint32 fee) external override ownerOnly {
        require(fee <= _maxConversionFee, "ERR_INVALID_CONVERSION_FEE");

        emit ConversionFeeUpdate(_conversionFee, fee);
        _conversionFee = fee;
    }

    /**
     * @dev transfers reserve balances to a new converter during an upgrade
     * can only be called by the converter upgraded which should be set at its owner
     *
     * @param newConverter address of the converter to receive the new amount
     */
    function transferReservesOnUpgrade(address newConverter)
        external
        override
        protected
        ownerOnly
        only(CONVERTER_UPGRADER)
    {
        uint256 reserveCount = _reserveTokens.length;
        for (uint256 i = 0; i < reserveCount; ++i) {
            IReserveToken reserveToken = _reserveTokens[i];

            reserveToken.safeTransfer(newConverter, reserveToken.balanceOf(address(this)));

            syncReserveBalance(reserveToken);
        }
    }

    /**
     * @dev upgrades the converter to the latest version
     * can only be called by the owner
     * note that the owner needs to call acceptOwnership on the new converter after the upgrade
     */
    function upgrade() external ownerOnly {
        IConverterUpgrader converterUpgrader = IConverterUpgrader(addressOf(CONVERTER_UPGRADER));

        // trigger de-activation event
        emit Activation(converterType(), _anchor, false);

        transferOwnership(address(converterUpgrader));
        converterUpgrader.upgrade(version);
        acceptOwnership();
    }

    /**
     * @dev executed by the upgrader at the end of the upgrade process to handle custom pool logic
     */
    function onUpgradeComplete() external override protected ownerOnly only(CONVERTER_UPGRADER) {
        (uint256 reserveBalance0, uint256 reserveBalance1) = reserveBalances(1, 2);
        _reserveBalancesProduct = reserveBalance0 * reserveBalance1;
    }

    /**
     * @dev returns the number of reserve tokens
     * note that prior to version 17, you should use 'connectorTokenCount' instead
     *
     * @return number of reserve tokens
     */
    function reserveTokenCount() external view override returns (uint16) {
        return uint16(_reserveTokens.length);
    }

    /**
     * @dev returns the array of reserve tokens
     *
     * @return array of reserve tokens
     */
    function reserveTokens() external view override returns (IReserveToken[] memory) {
        return _reserveTokens;
    }

    /**
     * @dev defines a new reserve token for the converter
     * can only be called by the owner while the converter is inactive
     *
     * @param token address of the reserve token
     * @param weight reserve weight, represented in ppm, 1-1000000
     */
    function addReserve(IReserveToken token, uint32 weight)
        external
        virtual
        override
        ownerOnly
        inactive
        validExternalAddress(address(token))
        validReserveWeight(weight)
    {
        // validate input
        require(address(token) != address(_anchor) && _reserveIds[token] == 0, "ERR_INVALID_RESERVE");
        require(_reserveTokens.length < 2, "ERR_INVALID_RESERVE_COUNT");

        _reserveTokens.push(token);
        _reserveIds[token] = _reserveTokens.length;
    }

    /**
     * @dev returns the reserve's weight
     * added in version 28
     *
     * @param reserveToken reserve token contract address
     *
     * @return reserve weight
     */
    function reserveWeight(IReserveToken reserveToken) external view validReserve(reserveToken) returns (uint32) {
        return PPM_RESOLUTION / 2;
    }

    /**
     * @dev returns the balance of a given reserve token
     *
     * @param reserveToken reserve token contract address
     *
     * @return the balance of the given reserve token
     */
    function reserveBalance(IReserveToken reserveToken) public view override returns (uint256) {
        uint256 reserveId = _reserveIds[reserveToken];
        require(reserveId != 0, "ERR_INVALID_RESERVE");

        return reserveBalance(reserveId);
    }

    /**
     * @dev returns the balances of both reserve tokens
     *
     * @return the balances of both reserve tokens
     */
    function reserveBalances() public view returns (uint256, uint256) {
        return reserveBalances(1, 2);
    }

    /**
     * @dev syncs all stored reserve balances
     */
    function syncReserveBalances() external {
        syncReserveBalances(0);
    }

    /**
     * @dev calculates the accumulated network fee and transfers it to the network fee wallet
     */
    function processNetworkFees() external protected {
        (uint256 reserveBalance0, uint256 reserveBalance1) = processNetworkFees(0);
        _reserveBalancesProduct = reserveBalance0 * reserveBalance1;
    }

    /**
     * @dev calculates the accumulated network fee and transfers it to the network fee wallet
     *
     * @param value amount of ether to exclude from the ether reserve balance (if relevant)
     *
     * @return new reserve balances
     */
    function processNetworkFees(uint256 value) internal returns (uint256, uint256) {
        syncReserveBalances(value);
        (uint256 reserveBalance0, uint256 reserveBalance1) = reserveBalances(1, 2);
        (ITokenHolder wallet, uint256 fee0, uint256 fee1) = networkWalletAndFees(reserveBalance0, reserveBalance1);
        reserveBalance0 -= fee0;
        reserveBalance1 -= fee1;

        setReserveBalances(1, 2, reserveBalance0, reserveBalance1);

        _reserveTokens[0].safeTransfer(address(wallet), fee0);
        _reserveTokens[1].safeTransfer(address(wallet), fee1);

        return (reserveBalance0, reserveBalance1);
    }

    /**
     * @dev returns the reserve balances of the given reserve tokens minus their corresponding fees
     *
     * @param baseReserveTokens reserve tokens
     *
     * @return reserve balances minus their corresponding fees
     */
    function baseReserveBalances(IReserveToken[] memory baseReserveTokens) internal view returns (uint256[2] memory) {
        uint256 reserveId0 = _reserveIds[baseReserveTokens[0]];
        uint256 reserveId1 = _reserveIds[baseReserveTokens[1]];
        (uint256 reserveBalance0, uint256 reserveBalance1) = reserveBalances(reserveId0, reserveId1);
        (, uint256 fee0, uint256 fee1) = networkWalletAndFees(reserveBalance0, reserveBalance1);

        return [reserveBalance0 - fee0, reserveBalance1 - fee1];
    }

    /**
     * @dev converts a specific amount of source tokens to target tokens
     * can only be called by the bancor network contract
     *
     * @param sourceToken source reserve token
     * @param targetToken target reserve token
     * @param amount amount of tokens to convert (in units of the source token)
     * @param trader address of the caller who executed the conversion
     * @param beneficiary wallet to receive the conversion result
     *
     * @return amount of tokens received (in units of the target token)
     */
    function convert(
        IReserveToken sourceToken,
        IReserveToken targetToken,
        uint256 amount,
        address trader,
        address payable beneficiary
    ) external payable override protected only(BANCOR_NETWORK) returns (uint256) {
        require(sourceToken != targetToken, "ERR_SAME_SOURCE_TARGET");

        return doConvert(sourceToken, targetToken, amount, trader, beneficiary);
    }

    /**
     * @dev returns the conversion fee for a given target amount
     *
     * @param targetAmount target amount
     *
     * @return conversion fee
     */
    function calculateFee(uint256 targetAmount) internal view returns (uint256) {
        return targetAmount.mul(_conversionFee) / PPM_RESOLUTION;
    }

    /**
     * @dev returns the conversion fee taken from a given target amount
     *
     * @param targetAmount  target amount
     *
     * @return conversion fee
     */
    function calculateFeeInv(uint256 targetAmount) internal view returns (uint256) {
        return targetAmount.mul(_conversionFee).div(PPM_RESOLUTION - _conversionFee);
    }

    /**
     * @dev loads the stored reserve balance for a given reserve id
     *
     * @param reserveId reserve id
     */
    function reserveBalance(uint256 reserveId) internal view returns (uint256) {
        return decodeReserveBalance(_reserveBalances, reserveId);
    }

    /**
     * @dev loads the stored reserve balances
     *
     * @param sourceId source reserve id
     * @param targetId target reserve id
     */
    function reserveBalances(uint256 sourceId, uint256 targetId) internal view returns (uint256, uint256) {
        require((sourceId == 1 && targetId == 2) || (sourceId == 2 && targetId == 1), "ERR_INVALID_RESERVES");

        return decodeReserveBalances(_reserveBalances, sourceId, targetId);
    }

    /**
     * @dev stores the stored reserve balance for a given reserve id
     *
     * @param reserveId reserve id
     * @param balance reserve balance
     */
    function setReserveBalance(uint256 reserveId, uint256 balance) internal {
        require(balance <= MAX_UINT128, "ERR_RESERVE_BALANCE_OVERFLOW");

        uint256 otherBalance = decodeReserveBalance(_reserveBalances, 3 - reserveId);
        _reserveBalances = encodeReserveBalances(balance, reserveId, otherBalance, 3 - reserveId);
    }

    /**
     * @dev stores the stored reserve balances
     *
     * @param sourceId source reserve id
     * @param targetId target reserve id
     * @param sourceBalance source reserve balance
     * @param targetBalance target reserve balance
     */
    function setReserveBalances(
        uint256 sourceId,
        uint256 targetId,
        uint256 sourceBalance,
        uint256 targetBalance
    ) internal {
        require(sourceBalance <= MAX_UINT128 && targetBalance <= MAX_UINT128, "ERR_RESERVE_BALANCE_OVERFLOW");

        _reserveBalances = encodeReserveBalances(sourceBalance, sourceId, targetBalance, targetId);
    }

    /**
     * @dev syncs the stored reserve balance for a given reserve with the real reserve balance
     *
     * @param reserveToken address of the reserve token
     */
    function syncReserveBalance(IReserveToken reserveToken) internal {
        uint256 reserveId = _reserveIds[reserveToken];

        setReserveBalance(reserveId, reserveToken.balanceOf(address(this)));
    }

    /**
     * @dev syncs all stored reserve balances, excluding a given amount of ether from the ether reserve balance (if relevant)
     *
     * @param value amount of ether to exclude from the ether reserve balance (if relevant)
     */
    function syncReserveBalances(uint256 value) internal {
        IReserveToken _reserveToken0 = _reserveTokens[0];
        IReserveToken _reserveToken1 = _reserveTokens[1];
        uint256 balance0 = _reserveToken0.balanceOf(address(this)) - (_reserveToken0.isNativeToken() ? value : 0);
        uint256 balance1 = _reserveToken1.balanceOf(address(this)) - (_reserveToken1.isNativeToken() ? value : 0);

        setReserveBalances(1, 2, balance0, balance1);
    }

    /**
     * @dev helper, dispatches the Conversion event
     *
     * @param sourceToken source ERC20 token
     * @param targetToken target ERC20 token
     * @param trader address of the caller who executed the conversion
     * @param amount amount purchased/sold (in the source token)
     * @param returnAmount amount returned (in the target token)
     * @param feeAmount the fee amount
     */
    function dispatchConversionEvent(
        IReserveToken sourceToken,
        IReserveToken targetToken,
        address trader,
        uint256 amount,
        uint256 returnAmount,
        uint256 feeAmount
    ) internal {
        emit Conversion(sourceToken, targetToken, trader, amount, returnAmount, int256(feeAmount));
    }

    /**
     * @dev returns the expected amount and expected fee for converting one reserve to another
     *
     * @param sourceToken address of the source reserve token contract
     * @param targetToken address of the target reserve token contract
     * @param amount amount of source reserve tokens converted
     *
     * @return expected amount in units of the target reserve token
     * @return expected fee in units of the target reserve token
     */
    function targetAmountAndFee(
        IReserveToken sourceToken,
        IReserveToken targetToken,
        uint256 amount
    ) public view virtual override active returns (uint256, uint256) {
        uint256 sourceId = _reserveIds[sourceToken];
        uint256 targetId = _reserveIds[targetToken];

        (uint256 sourceBalance, uint256 targetBalance) = reserveBalances(sourceId, targetId);

        return targetAmountAndFee(sourceToken, targetToken, sourceBalance, targetBalance, amount);
    }

    /**
     * @dev returns the expected amount and expected fee for converting one reserve to another
     *
     * @param sourceBalance balance in the source reserve token contract
     * @param targetBalance balance in the target reserve token contract
     * @param amount amount of source reserve tokens converted
     *
     * @return expected amount in units of the target reserve token
     * @return expected fee in units of the target reserve token
     */
    function targetAmountAndFee(
        IReserveToken, /* sourceToken */
        IReserveToken, /* targetToken */
        uint256 sourceBalance,
        uint256 targetBalance,
        uint256 amount
    ) internal view virtual returns (uint256, uint256) {
        uint256 targetAmount = crossReserveTargetAmount(sourceBalance, targetBalance, amount);

        uint256 fee = calculateFee(targetAmount);

        return (targetAmount - fee, fee);
    }

    /**
     * @dev returns the required amount and expected fee for converting one reserve to another
     *
     * @param sourceToken address of the source reserve token contract
     * @param targetToken address of the target reserve token contract
     * @param amount amount of target reserve tokens desired
     *
     * @return required amount in units of the source reserve token
     * @return expected fee in units of the target reserve token
     */
    function sourceAmountAndFee(
        IReserveToken sourceToken,
        IReserveToken targetToken,
        uint256 amount
    ) public view virtual active returns (uint256, uint256) {
        uint256 sourceId = _reserveIds[sourceToken];
        uint256 targetId = _reserveIds[targetToken];

        (uint256 sourceBalance, uint256 targetBalance) = reserveBalances(sourceId, targetId);

        uint256 fee = calculateFeeInv(amount);

        uint256 targetAmount = crossReserveSourceAmount(sourceBalance, targetBalance, amount.add(fee));

        return (targetAmount, fee);
    }

    /**
     * @dev converts a specific amount of source tokens to target tokens
     *
     * @param sourceToken source reserve token
     * @param targetToken target reserve token
     * @param amount amount of tokens to convert (in units of the source token)
     * @param trader address of the caller who executed the conversion
     * @param beneficiary wallet to receive the conversion result
     *
     * @return amount of tokens received (in units of the target token)
     */
    function doConvert(
        IReserveToken sourceToken,
        IReserveToken targetToken,
        uint256 amount,
        address trader,
        address payable beneficiary
    ) internal returns (uint256) {
        // update the recent average rate
        updateRecentAverageRate();

        uint256 sourceId = _reserveIds[sourceToken];
        uint256 targetId = _reserveIds[targetToken];

        (uint256 sourceBalance, uint256 targetBalance) = reserveBalances(sourceId, targetId);

        // get the target amount minus the conversion fee and the conversion fee
        (uint256 targetAmount, uint256 fee) =
            targetAmountAndFee(sourceToken, targetToken, sourceBalance, targetBalance, amount);

        // ensure that the trade gives something in return
        require(targetAmount != 0, "ERR_ZERO_TARGET_AMOUNT");

        // ensure that the trade won't deplete the reserve balance
        assert(targetAmount < targetBalance);

        // ensure that the input amount was already deposited
        uint256 actualSourceBalance = sourceToken.balanceOf(address(this));
        if (sourceToken.isNativeToken()) {
            require(msg.value == amount, "ERR_ETH_AMOUNT_MISMATCH");
        } else {
            require(msg.value == 0 && actualSourceBalance.sub(sourceBalance) >= amount, "ERR_INVALID_AMOUNT");
        }

        // sync the reserve balances
        setReserveBalances(sourceId, targetId, actualSourceBalance, targetBalance - targetAmount);

        // transfer funds to the beneficiary in the to reserve token
        targetToken.safeTransfer(beneficiary, targetAmount);

        // dispatch the conversion event
        dispatchConversionEvent(sourceToken, targetToken, trader, amount, targetAmount, fee);

        // dispatch rate updates
        dispatchTokenRateUpdateEvents(sourceToken, targetToken, actualSourceBalance, targetBalance - targetAmount);

        return targetAmount;
    }

    /**
     * @dev returns the recent average rate of 1 token in the other reserve token units
     *
     * @param token token to get the rate for
     *
     * @return recent average rate between the reserves (numerator)
     * @return recent average rate between the reserves (denominator)
     */
    function recentAverageRate(IReserveToken token) external view validReserve(token) returns (uint256, uint256) {
        // get the recent average rate of reserve 0
        uint256 rate = calcRecentAverageRate(_averageRateInfo);

        uint256 rateN = decodeAverageRateN(rate);
        uint256 rateD = decodeAverageRateD(rate);

        if (token == _reserveTokens[0]) {
            return (rateN, rateD);
        }

        return (rateD, rateN);
    }

    /**
     * @dev updates the recent average rate if needed
     */
    function updateRecentAverageRate() internal {
        uint256 averageRateInfo1 = _averageRateInfo;
        uint256 averageRateInfo2 = calcRecentAverageRate(averageRateInfo1);
        if (averageRateInfo1 != averageRateInfo2) {
            _averageRateInfo = averageRateInfo2;
        }
    }

    /**
     * @dev returns the recent average rate of 1 reserve token 0 in reserve token 1 units
     *
     * @param averageRateInfoData the average rate to use for the calculation
     *
     * @return recent average rate between the reserves
     */
    function calcRecentAverageRate(uint256 averageRateInfoData) internal view returns (uint256) {
        // get the previous average rate and its update-time
        uint256 prevAverageRateT = decodeAverageRateT(averageRateInfoData);
        uint256 prevAverageRateN = decodeAverageRateN(averageRateInfoData);
        uint256 prevAverageRateD = decodeAverageRateD(averageRateInfoData);

        // get the elapsed time since the previous average rate was calculated
        uint256 currentTime = time();
        uint256 timeElapsed = currentTime - prevAverageRateT;

        // if the previous average rate was calculated in the current block, the average rate remains unchanged
        if (timeElapsed == 0) {
            return averageRateInfoData;
        }

        // get the current rate between the reserves
        (uint256 currentRateD, uint256 currentRateN) = reserveBalances();

        // if the previous average rate was calculated a while ago or never, the average rate is equal to the current rate
        if (timeElapsed >= AVERAGE_RATE_PERIOD || prevAverageRateT == 0) {
            (currentRateN, currentRateD) = MathEx.reducedRatio(currentRateN, currentRateD, MAX_UINT112);
            return encodeAverageRateInfo(currentTime, currentRateN, currentRateD);
        }

        uint256 x = prevAverageRateD.mul(currentRateN);
        uint256 y = prevAverageRateN.mul(currentRateD);

        // since we know that timeElapsed < AVERAGE_RATE_PERIOD, we can avoid using SafeMath:
        uint256 newRateN = y.mul(AVERAGE_RATE_PERIOD - timeElapsed).add(x.mul(timeElapsed));
        uint256 newRateD = prevAverageRateD.mul(currentRateD).mul(AVERAGE_RATE_PERIOD);

        (newRateN, newRateD) = MathEx.reducedRatio(newRateN, newRateD, MAX_UINT112);

        return encodeAverageRateInfo(currentTime, newRateN, newRateD);
    }

    /**
     * @dev increases the pool's liquidity and mints new shares in the pool to the caller
     *
     * @param reserves address of each reserve token
     * @param reserveAmounts amount of each reserve token
     * @param minReturn token minimum return-amount
     *
     * @return amount of pool tokens issued
     */
    function addLiquidity(
        IReserveToken[] memory reserves,
        uint256[] memory reserveAmounts,
        uint256 minReturn
    ) external payable protected active returns (uint256) {
        // verify the user input
        verifyLiquidityInput(reserves, reserveAmounts, minReturn);

        // if one of the reserves is ETH, then verify that the input amount of ETH is equal to the input value of ETH
        require(
            (!reserves[0].isNativeToken() || reserveAmounts[0] == msg.value) &&
                (!reserves[1].isNativeToken() || reserveAmounts[1] == msg.value),
            "ERR_ETH_AMOUNT_MISMATCH"
        );

        // if the input value of ETH is larger than zero, then verify that one of the reserves is ETH
        if (msg.value > 0) {
            require(_reserveIds[ReserveToken.NATIVE_TOKEN_ADDRESS] != 0, "ERR_NO_ETH_RESERVE");
        }

        // save a local copy of the pool token
        IDSToken poolToken = IDSToken(address(_anchor));

        // get the total supply
        uint256 totalSupply = poolToken.totalSupply();

        uint256[2] memory prevReserveBalances;
        uint256[2] memory newReserveBalances;

        // process the network fees and get the reserve balances
        (prevReserveBalances[0], prevReserveBalances[1]) = processNetworkFees(msg.value);

        uint256 amount;
        uint256[2] memory newReserveAmounts;

        // calculate the amount of pool tokens to mint for the caller
        // and the amount of reserve tokens to transfer from the caller
        if (totalSupply == 0) {
            amount = MathEx.geometricMean(reserveAmounts);
            newReserveAmounts[0] = reserveAmounts[0];
            newReserveAmounts[1] = reserveAmounts[1];
        } else {
            (amount, newReserveAmounts) = addLiquidityAmounts(
                reserves,
                reserveAmounts,
                prevReserveBalances,
                totalSupply
            );
        }

        uint256 newPoolTokenSupply = totalSupply.add(amount);
        for (uint256 i = 0; i < 2; i++) {
            IReserveToken reserveToken = reserves[i];
            uint256 reserveAmount = newReserveAmounts[i];
            require(reserveAmount > 0, "ERR_ZERO_TARGET_AMOUNT");
            assert(reserveAmount <= reserveAmounts[i]);

            // transfer each one of the reserve amounts from the user to the pool
            if (!reserveToken.isNativeToken()) {
                // ETH has already been transferred as part of the transaction
                reserveToken.safeTransferFrom(msg.sender, address(this), reserveAmount);
            } else if (reserveAmounts[i] > reserveAmount) {
                // transfer the extra amount of ETH back to the user
                reserveToken.safeTransfer(msg.sender, reserveAmounts[i] - reserveAmount);
            }

            // save the new reserve balance
            newReserveBalances[i] = prevReserveBalances[i].add(reserveAmount);

            emit LiquidityAdded(msg.sender, reserveToken, reserveAmount, newReserveBalances[i], newPoolTokenSupply);

            // dispatch the `TokenRateUpdate` event for the pool token
            emit TokenRateUpdate(address(poolToken), address(reserveToken), newReserveBalances[i], newPoolTokenSupply);
        }

        // set the reserve balances
        setReserveBalances(1, 2, newReserveBalances[0], newReserveBalances[1]);

        // set the reserve balances product
        _reserveBalancesProduct = newReserveBalances[0] * newReserveBalances[1];

        // verify that the equivalent amount of tokens is equal to or larger than the user's expectation
        require(amount >= minReturn, "ERR_RETURN_TOO_LOW");

        // issue the tokens to the user
        poolToken.issue(msg.sender, amount);

        // return the amount of pool tokens issued
        return amount;
    }

    /**
     * @dev get the amount of pool tokens to mint for the caller
     * and the amount of reserve tokens to transfer from the caller
     *
     * @param amounts amount of each reserve token
     * @param balances balance of each reserve token
     * @param totalSupply total supply of pool tokens
     *
     * @return amount of pool tokens to mint for the caller
     * @return amount of reserve tokens to transfer from the caller
     */
    function addLiquidityAmounts(
        IReserveToken[] memory, /* reserves */
        uint256[] memory amounts,
        uint256[2] memory balances,
        uint256 totalSupply
    ) internal view virtual returns (uint256, uint256[2] memory) {
        this;

        uint256 index = amounts[0].mul(balances[1]) < amounts[1].mul(balances[0]) ? 0 : 1;
        uint256 amount = fundSupplyAmount(totalSupply, balances[index], amounts[index]);

        uint256[2] memory newAmounts =
            [fundCost(totalSupply, balances[0], amount), fundCost(totalSupply, balances[1], amount)];

        return (amount, newAmounts);
    }

    /**
     * @dev decreases the pool's liquidity and burns the caller's shares in the pool
     *
     * @param amount token amount
     * @param reserves address of each reserve token
     * @param minReturnAmounts minimum return-amount of each reserve token
     *
     * @return the amount of each reserve token granted for the given amount of pool tokens
     */
    function removeLiquidity(
        uint256 amount,
        IReserveToken[] memory reserves,
        uint256[] memory minReturnAmounts
    ) external protected active returns (uint256[] memory) {
        // verify the user input
        bool inputRearranged = verifyLiquidityInput(reserves, minReturnAmounts, amount);

        // save a local copy of the pool token
        IDSToken poolToken = IDSToken(address(_anchor));

        // get the total supply BEFORE destroying the user tokens
        uint256 totalSupply = poolToken.totalSupply();

        // destroy the user tokens
        poolToken.destroy(msg.sender, amount);

        uint256 newPoolTokenSupply = totalSupply.sub(amount);

        uint256[2] memory prevReserveBalances;
        uint256[2] memory newReserveBalances;

        // process the network fees and get the reserve balances
        (prevReserveBalances[0], prevReserveBalances[1]) = processNetworkFees(0);

        uint256[] memory reserveAmounts = removeLiquidityReserveAmounts(amount, totalSupply, prevReserveBalances);

        for (uint256 i = 0; i < 2; i++) {
            IReserveToken reserveToken = reserves[i];
            uint256 reserveAmount = reserveAmounts[i];
            require(reserveAmount >= minReturnAmounts[i], "ERR_ZERO_TARGET_AMOUNT");

            // save the new reserve balance
            newReserveBalances[i] = prevReserveBalances[i].sub(reserveAmount);

            // transfer each one of the reserve amounts from the pool to the user
            reserveToken.safeTransfer(msg.sender, reserveAmount);

            emit LiquidityRemoved(msg.sender, reserveToken, reserveAmount, newReserveBalances[i], newPoolTokenSupply);

            // dispatch the `TokenRateUpdate` event for the pool token
            emit TokenRateUpdate(address(poolToken), address(reserveToken), newReserveBalances[i], newPoolTokenSupply);
        }

        // set the reserve balances
        setReserveBalances(1, 2, newReserveBalances[0], newReserveBalances[1]);

        // set the reserve balances product
        _reserveBalancesProduct = newReserveBalances[0] * newReserveBalances[1];

        if (inputRearranged) {
            uint256 tempReserveAmount = reserveAmounts[0];
            reserveAmounts[0] = reserveAmounts[1];
            reserveAmounts[1] = tempReserveAmount;
        }

        // return the amount of each reserve token granted for the given amount of pool tokens
        return reserveAmounts;
    }

    /**
     * @dev given the amount of one of the reserve tokens to add liquidity of,
     * returns the required amount of each one of the other reserve tokens
     * since an empty pool can be funded with any list of non-zero input amounts,
     * this function assumes that the pool is not empty (has already been funded)
     *
     * @param reserves address of each reserve token
     * @param index index of the relevant reserve token
     * @param amount amount of the relevant reserve token
     *
     * @return the required amount of each one of the reserve tokens
     */
    function addLiquidityCost(
        IReserveToken[] memory reserves,
        uint256 index,
        uint256 amount
    ) external view returns (uint256[] memory) {
        uint256 totalSupply = IDSToken(address(_anchor)).totalSupply();
        uint256[2] memory baseBalances = baseReserveBalances(reserves);
        uint256 supplyAmount = fundSupplyAmount(totalSupply, baseBalances[index], amount);

        uint256[] memory reserveAmounts = new uint256[](2);
        reserveAmounts[0] = fundCost(totalSupply, baseBalances[0], supplyAmount);
        reserveAmounts[1] = fundCost(totalSupply, baseBalances[1], supplyAmount);

        return reserveAmounts;
    }

    /**
     * @dev returns the amount of pool tokens entitled for given amounts of reserve tokens
     * since an empty pool can be funded with any list of non-zero input amounts,
     * this function assumes that the pool is not empty (has already been funded)
     *
     * @param reserves address of each reserve token
     * @param amounts  amount of each reserve token
     *
     * @return the amount of pool tokens entitled for the given amounts of reserve tokens
     */
    function addLiquidityReturn(IReserveToken[] memory reserves, uint256[] memory amounts)
        external
        view
        returns (uint256)
    {
        uint256 totalSupply = IDSToken(address(_anchor)).totalSupply();
        uint256[2] memory baseBalances = baseReserveBalances(reserves);
        (uint256 amount, ) = addLiquidityAmounts(reserves, amounts, baseBalances, totalSupply);

        return amount;
    }

    /**
     * @dev returns the amount of each reserve token entitled for a given amount of pool tokens
     *
     * @param amount amount of pool tokens
     * @param reserves address of each reserve token
     *
     * @return the amount of each reserve token entitled for the given amount of pool tokens
     */
    function removeLiquidityReturn(uint256 amount, IReserveToken[] memory reserves)
        external
        view
        returns (uint256[] memory)
    {
        uint256 totalSupply = IDSToken(address(_anchor)).totalSupply();
        uint256[2] memory baseBalances = baseReserveBalances(reserves);

        return removeLiquidityReserveAmounts(amount, totalSupply, baseBalances);
    }

    /**
     * @dev verifies that a given array of tokens is identical to the converter's array of reserve tokens
     * we take this input in order to allow specifying the corresponding reserve amounts in any order
     * this function rearranges the input arrays according to the converter's array of reserve tokens
     *
     * @param reserves array of reserve tokens
     * @param amounts array of reserve amounts
     * @param amount token amount
     *
     * @return true if the function has rearranged the input arrays; false otherwise
     */
    function verifyLiquidityInput(
        IReserveToken[] memory reserves,
        uint256[] memory amounts,
        uint256 amount
    ) private view returns (bool) {
        require(validReserveAmounts(amounts) && amount > 0, "ERR_ZERO_AMOUNT");

        uint256 reserve0Id = _reserveIds[reserves[0]];
        uint256 reserve1Id = _reserveIds[reserves[1]];

        if (reserve0Id == 2 && reserve1Id == 1) {
            IReserveToken tempReserveToken = reserves[0];
            reserves[0] = reserves[1];
            reserves[1] = tempReserveToken;

            uint256 tempReserveAmount = amounts[0];
            amounts[0] = amounts[1];
            amounts[1] = tempReserveAmount;

            return true;
        }

        require(reserve0Id == 1 && reserve1Id == 2, "ERR_INVALID_RESERVE");

        return false;
    }

    /**
     * @dev checks whether or not both reserve amounts are larger than zero
     *
     * @param amounts  array of reserve amounts
     *
     * @return true if both reserve amounts are larger than zero; false otherwise
     */
    function validReserveAmounts(uint256[] memory amounts) internal pure virtual returns (bool) {
        return amounts[0] > 0 && amounts[1] > 0;
    }

    /**
     * @dev returns the amount of each reserve token entitled for a given amount of pool tokens
     *
     * @param amount amount of pool tokens
     * @param totalSupply total supply of pool tokens
     * @param balances balance of each reserve token
     *
     * @return the amount of each reserve token entitled for the given amount of pool tokens
     */
    function removeLiquidityReserveAmounts(
        uint256 amount,
        uint256 totalSupply,
        uint256[2] memory balances
    ) private pure returns (uint256[] memory) {
        uint256[] memory reserveAmounts = new uint256[](2);
        reserveAmounts[0] = liquidateReserveAmount(totalSupply, balances[0], amount);
        reserveAmounts[1] = liquidateReserveAmount(totalSupply, balances[1], amount);

        return reserveAmounts;
    }

    /**
     * @dev dispatches token rate update events for the reserve tokens and the pool token
     *
     * @param sourceToken address of the source reserve token
     * @param targetToken address of the target reserve token
     * @param sourceBalance balance of the source reserve token
     * @param targetBalance balance of the target reserve token
     */
    function dispatchTokenRateUpdateEvents(
        IReserveToken sourceToken,
        IReserveToken targetToken,
        uint256 sourceBalance,
        uint256 targetBalance
    ) private {
        // save a local copy of the pool token
        IDSToken poolToken = IDSToken(address(_anchor));

        // get the total supply of pool tokens
        uint256 poolTokenSupply = poolToken.totalSupply();

        // dispatch token rate update event for the reserve tokens
        emit TokenRateUpdate(address(sourceToken), address(targetToken), targetBalance, sourceBalance);

        // dispatch token rate update events for the pool token
        emit TokenRateUpdate(address(poolToken), address(sourceToken), sourceBalance, poolTokenSupply);
        emit TokenRateUpdate(address(poolToken), address(targetToken), targetBalance, poolTokenSupply);
    }

    function encodeReserveBalance(uint256 balance, uint256 id) private pure returns (uint256) {
        assert(balance <= MAX_UINT128 && (id == 1 || id == 2));
        return balance << ((id - 1) * 128);
    }

    function decodeReserveBalance(uint256 balances, uint256 id) private pure returns (uint256) {
        assert(id == 1 || id == 2);
        return (balances >> ((id - 1) * 128)) & MAX_UINT128;
    }

    function encodeReserveBalances(
        uint256 balance0,
        uint256 id0,
        uint256 balance1,
        uint256 id1
    ) private pure returns (uint256) {
        return encodeReserveBalance(balance0, id0) | encodeReserveBalance(balance1, id1);
    }

    function decodeReserveBalances(
        uint256 _balances,
        uint256 id0,
        uint256 id1
    ) private pure returns (uint256, uint256) {
        return (decodeReserveBalance(_balances, id0), decodeReserveBalance(_balances, id1));
    }

    function encodeAverageRateInfo(
        uint256 averageRateT,
        uint256 averageRateN,
        uint256 averageRateD
    ) private pure returns (uint256) {
        assert(averageRateT <= MAX_UINT32 && averageRateN <= MAX_UINT112 && averageRateD <= MAX_UINT112);
        return (averageRateT << 224) | (averageRateN << 112) | averageRateD;
    }

    function decodeAverageRateT(uint256 averageRateInfoData) private pure returns (uint256) {
        return averageRateInfoData >> 224;
    }

    function decodeAverageRateN(uint256 averageRateInfoData) private pure returns (uint256) {
        return (averageRateInfoData >> 112) & MAX_UINT112;
    }

    function decodeAverageRateD(uint256 averageRateInfoData) private pure returns (uint256) {
        return averageRateInfoData & MAX_UINT112;
    }

    /**
     * @dev returns the largest integer smaller than or equal to the square root of a given value
     *
     * @param x the given value
     *
     * @return the largest integer smaller than or equal to the square root of the given value
     */
    function floorSqrt(uint256 x) private pure returns (uint256) {
        return x > 0 ? MathEx.floorSqrt(x) : 0;
    }

    function crossReserveTargetAmount(
        uint256 sourceReserveBalance,
        uint256 targetReserveBalance,
        uint256 amount
    ) private pure returns (uint256) {
        // validate input
        require(sourceReserveBalance > 0 && targetReserveBalance > 0, "ERR_INVALID_RESERVE_BALANCE");

        return targetReserveBalance.mul(amount) / sourceReserveBalance.add(amount);
    }

    function crossReserveSourceAmount(
        uint256 sourceReserveBalance,
        uint256 targetReserveBalance,
        uint256 amount
    ) private pure returns (uint256) {
        require(sourceReserveBalance > 0, "ERR_INVALID_RESERVE_BALANCE");
        require(amount < targetReserveBalance, "ERR_INVALID_AMOUNT");

        if (amount == 0) {
            return 0;
        }

        return (sourceReserveBalance.mul(amount) - 1) / (targetReserveBalance - amount) + 1;
    }

    function fundCost(
        uint256 supply,
        uint256 balance,
        uint256 amount
    ) private pure returns (uint256) {
        require(supply > 0, "ERR_INVALID_SUPPLY");
        require(balance > 0, "ERR_INVALID_RESERVE_BALANCE");

        // special case for 0 amount
        if (amount == 0) {
            return 0;
        }

        return (amount.mul(balance) - 1) / supply + 1;
    }

    function fundSupplyAmount(
        uint256 supply,
        uint256 balance,
        uint256 amount
    ) private pure returns (uint256) {
        require(supply > 0, "ERR_INVALID_SUPPLY");
        require(balance > 0, "ERR_INVALID_RESERVE_BALANCE");

        // special case for 0 amount
        if (amount == 0) {
            return 0;
        }

        return amount.mul(supply) / balance;
    }

    function liquidateReserveAmount(
        uint256 supply,
        uint256 balance,
        uint256 amount
    ) private pure returns (uint256) {
        require(supply > 0, "ERR_INVALID_SUPPLY");
        require(balance > 0, "ERR_INVALID_RESERVE_BALANCE");
        require(amount <= supply, "ERR_INVALID_AMOUNT");

        // special case for 0 amount
        if (amount == 0) {
            return 0;
        }

        // special case for liquidating the entire supply
        if (amount == supply) {
            return balance;
        }

        return amount.mul(balance) / supply;
    }

    /**
     * @dev returns the network wallet and fees
     *
     * @param reserveBalance0 1st reserve balance
     * @param reserveBalance1 2nd reserve balance
     *
     * @return the network wallet
     * @return the network fee on the 1st reserve
     * @return the network fee on the 2nd reserve
     */
    function networkWalletAndFees(uint256 reserveBalance0, uint256 reserveBalance1)
        private
        view
        returns (
            ITokenHolder,
            uint256,
            uint256
        )
    {
        uint256 prevPoint = floorSqrt(_reserveBalancesProduct);
        uint256 currPoint = floorSqrt(reserveBalance0 * reserveBalance1);

        if (prevPoint >= currPoint) {
            return (ITokenHolder(address(0)), 0, 0);
        }

        (ITokenHolder networkFeeWallet, uint32 networkFee) =
            INetworkSettings(addressOf(NETWORK_SETTINGS)).networkFeeParams();
        uint256 n = (currPoint - prevPoint) * networkFee;
        uint256 d = currPoint * PPM_RESOLUTION;

        return (networkFeeWallet, reserveBalance0.mul(n).div(d), reserveBalance1.mul(n).div(d));
    }

    /**
     * @dev deprecated since version 28, backward compatibility - use only for earlier versions
     */
    function token() external view override returns (IConverterAnchor) {
        return _anchor;
    }

    /**
     * @dev deprecated, backward compatibility
     */
    function transferTokenOwnership(address newOwner) external override ownerOnly {
        transferAnchorOwnership(newOwner);
    }

    /**
     * @dev deprecated, backward compatibility
     */
    function acceptTokenOwnership() public override ownerOnly {
        acceptAnchorOwnership();
    }

    /**
     * @dev deprecated, backward compatibility
     */
    function connectors(IReserveToken reserveToken)
        external
        view
        override
        returns (
            uint256,
            uint32,
            bool,
            bool,
            bool
        )
    {
        uint256 reserveId = _reserveIds[reserveToken];
        if (reserveId != 0) {
            return (reserveBalance(reserveId), PPM_RESOLUTION / 2, false, false, true);
        }
        return (0, 0, false, false, false);
    }

    /**
     * @dev deprecated, backward compatibility
     */
    function connectorTokens(uint256 index) external view override returns (IReserveToken) {
        return _reserveTokens[index];
    }

    /**
     * @dev deprecated, backward compatibility
     */
    function connectorTokenCount() external view override returns (uint16) {
        return uint16(_reserveTokens.length);
    }

    /**
     * @dev deprecated, backward compatibility
     */
    function getConnectorBalance(IReserveToken reserveToken) external view override returns (uint256) {
        return reserveBalance(reserveToken);
    }

    /**
     * @dev deprecated, backward compatibility
     */
    function getReturn(
        IReserveToken sourceToken,
        IReserveToken targetToken,
        uint256 amount
    ) external view returns (uint256, uint256) {
        return targetAmountAndFee(sourceToken, targetToken, amount);
    }
}
