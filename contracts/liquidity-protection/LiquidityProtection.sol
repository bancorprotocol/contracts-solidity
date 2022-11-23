// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/Math.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "@bancor/token-governance/contracts/ITokenGovernance.sol";

import "../utility/MathEx.sol";
import "../utility/Types.sol";
import "../utility/Time.sol";
import "../utility/Utils.sol";
import "../utility/Owned.sol";

import "../token/interfaces/IDSToken.sol";
import "../token/ReserveToken.sol";

import "../converter/interfaces/IConverterAnchor.sol";
import "../converter/interfaces/IConverter.sol";
import "../converter/interfaces/IConverterRegistry.sol";

import "./interfaces/ILiquidityProtection.sol";

interface ILiquidityPoolConverter is IConverter {
    function addLiquidity(
        IReserveToken[] memory reserveTokens,
        uint256[] memory reserveAmounts,
        uint256 minReturn
    ) external payable;

    function removeLiquidity(
        uint256 amount,
        IReserveToken[] memory reserveTokens,
        uint256[] memory reserveMinReturnAmounts
    ) external returns (uint256[] memory);

    function recentAverageRate(IReserveToken reserveToken) external view returns (uint256, uint256);
}

/**
 * @dev This contract implements the liquidity protection mechanism.
 */
contract LiquidityProtection is ILiquidityProtection, Utils, Owned, ReentrancyGuard, Time {
    using Math for uint256;
    using SafeMath for uint256;
    using ReserveToken for IReserveToken;
    using SafeERC20 for IERC20;
    using SafeERC20 for IDSToken;
    using SafeERC20Ex for IERC20;
    using Address for address payable;

    struct Position {
        address provider; // liquidity provider
        IDSToken poolToken; // pool token address
        IReserveToken reserveToken; // reserve token address
        uint256 poolAmount; // pool token amount
        uint256 reserveAmount; // reserve token amount
        uint256 reserveRateN; // rate of 1 protected reserve token in units of the other reserve token (numerator)
        uint256 reserveRateD; // rate of 1 protected reserve token in units of the other reserve token (denominator)
        uint256 timestamp; // timestamp
    }

    // various rates between the two reserve tokens. the rate is of 1 unit of the protected reserve token in units of the other reserve token
    struct PackedRates {
        uint128 addSpotRateN; // spot rate of 1 A in units of B when liquidity was added (numerator)
        uint128 addSpotRateD; // spot rate of 1 A in units of B when liquidity was added (denominator)
        uint128 removeSpotRateN; // spot rate of 1 A in units of B when liquidity is removed (numerator)
        uint128 removeSpotRateD; // spot rate of 1 A in units of B when liquidity is removed (denominator)
        uint128 removeAverageRateN; // average rate of 1 A in units of B when liquidity is removed (numerator)
        uint128 removeAverageRateD; // average rate of 1 A in units of B when liquidity is removed (denominator)
    }

    uint256 internal constant MAX_UINT128 = 2**128 - 1;
    uint256 internal constant MAX_UINT256 = uint256(-1);

    address payable private immutable _vaultV3;
    ILiquidityProtectionSettings private immutable _settings;
    ILiquidityProtectionStore private immutable _store;
    ILiquidityProtectionStats private immutable _stats;
    ILiquidityProtectionSystemStore private immutable _systemStore;
    ITokenHolder private immutable _wallet;
    IERC20 private immutable _networkToken;
    ITokenGovernance private immutable _networkTokenGovernance;
    IERC20 private immutable _govToken;
    ITokenGovernance private immutable _govTokenGovernance;

    /**
     * @dev maps a pool anchor to the total value of its positions
     * if this value is greater than the total protected liquidity,
     * the pool is in deficit, and withdrawing from this pool will
     * be decreased by an amount proportional to the deficit
     * the value is expected to be set manually
     */
    mapping(IConverterAnchor => uint256) private _totalPositionsValue;

    bool private _addingEnabled = false;
    bool private _removingEnabled = false;

    /**
     * @dev initializes a new LiquidityProtection contract
     */
    constructor(
        address payable vaultV3,
        ILiquidityProtectionSettings settings,
        ILiquidityProtectionStore store,
        ILiquidityProtectionStats stats,
        ILiquidityProtectionSystemStore systemStore,
        ITokenHolder wallet,
        ITokenGovernance networkTokenGovernance,
        ITokenGovernance govTokenGovernance
    ) public {
        _validAddress(address(vaultV3));
        _validAddress(address(settings));
        _validAddress(address(store));
        _validAddress(address(stats));
        _validAddress(address(systemStore));
        _validAddress(address(wallet));

        _vaultV3 = vaultV3;
        _settings = settings;
        _store = store;
        _stats = stats;
        _systemStore = systemStore;
        _wallet = wallet;
        _networkTokenGovernance = networkTokenGovernance;
        _govTokenGovernance = govTokenGovernance;

        _networkToken = networkTokenGovernance.token();
        _govToken = govTokenGovernance.token();
    }

    // ensures that the pool is supported and whitelisted
    modifier poolSupportedAndWhitelisted(IConverterAnchor poolAnchor) {
        _poolSupported(poolAnchor);
        _poolWhitelisted(poolAnchor);

        _;
    }

    // ensures that add liquidity is enabled
    modifier addLiquidityEnabled(IConverterAnchor poolAnchor, IReserveToken reserveToken) {
        _addLiquidityEnabled(poolAnchor, reserveToken);

        _;
    }

    // ensures that remove liquidity is enabled
    modifier removeLiquidityEnabled() {
        _removeLiquidityEnabled();

        _;
    }

    // error message binary size optimization
    function _poolSupported(IConverterAnchor poolAnchor) internal view {
        require(_settings.isPoolSupported(poolAnchor), "ERR_POOL_NOT_SUPPORTED");
    }

    // error message binary size optimization
    function _poolWhitelisted(IConverterAnchor poolAnchor) internal view {
        require(_settings.isPoolWhitelisted(poolAnchor), "ERR_POOL_NOT_WHITELISTED");
    }

    // error message binary size optimization
    function _addLiquidityEnabled(IConverterAnchor poolAnchor, IReserveToken reserveToken) internal view {
        require(
            _addingEnabled && !_settings.addLiquidityDisabled(poolAnchor, reserveToken),
            "ERR_ADD_LIQUIDITY_DISABLED"
        );
    }

    // error message binary size optimization
    function _removeLiquidityEnabled() internal view {
        require(_removingEnabled);
    }

    // error message binary size optimization
    function _verifyEthAmount(uint256 value) internal view {
        require(msg.value == value, "ERR_ETH_AMOUNT_MISMATCH");
    }

    /**
     * @dev returns the LP store
     */
    function store() external view override returns (ILiquidityProtectionStore) {
        return _store;
    }

    /**
     * @dev returns the LP stats
     */
    function stats() external view override returns (ILiquidityProtectionStats) {
        return _stats;
    }

    /**
     * @dev returns the LP settings
     */
    function settings() external view override returns (ILiquidityProtectionSettings) {
        return _settings;
    }

    /**
     * @dev accept ETH
     */
    receive() external payable {}

    /**
     * @dev transfers the ownership of the store
     *
     * Requirements:
     *
     * - the caller must be the owner of the contract
     */
    function transferStoreOwnership(address newOwner) external ownerOnly {
        _store.transferOwnership(newOwner);
    }

    /**
     * @dev accepts the ownership of the store
     *
     * Requirements:
     *
     * - the caller must be the owner of the contract
     */
    function acceptStoreOwnership() external ownerOnly {
        _store.acceptOwnership();
    }

    /**
     * @dev transfers the ownership of the wallet
     *
     * Requirements:
     *
     * - the caller must be the owner of the contract
     */
    function transferWalletOwnership(address newOwner) external ownerOnly {
        _wallet.transferOwnership(newOwner);
    }

    /**
     * @dev accepts the ownership of the wallet
     *
     * Requirements:
     *
     * - the caller must be the owner of the contract
     */
    function acceptWalletOwnership() external ownerOnly {
        _wallet.acceptOwnership();
    }

    /**
     * @dev adds protected liquidity to a pool for a specific recipient, mints new governance tokens for the caller
     * if the caller adds network tokens, and returns the new position id
     */
    function addLiquidityFor(
        address owner,
        IConverterAnchor poolAnchor,
        IReserveToken reserveToken,
        uint256 amount
    )
        external
        payable
        override
        nonReentrant
        validAddress(owner)
        poolSupportedAndWhitelisted(poolAnchor)
        addLiquidityEnabled(poolAnchor, reserveToken)
        greaterThanZero(amount)
        returns (uint256)
    {
        return _addLiquidity(owner, poolAnchor, reserveToken, amount);
    }

    /**
     * @dev adds protected liquidity to a pool, mints new governance tokens for the caller if the caller adds network
     * tokens, and returns the new position id
     */
    function addLiquidity(
        IConverterAnchor poolAnchor,
        IReserveToken reserveToken,
        uint256 amount
    )
        external
        payable
        override
        nonReentrant
        poolSupportedAndWhitelisted(poolAnchor)
        addLiquidityEnabled(poolAnchor, reserveToken)
        greaterThanZero(amount)
        returns (uint256)
    {
        return _addLiquidity(msg.sender, poolAnchor, reserveToken, amount);
    }

    /**
     * @dev adds protected liquidity to a pool for a specific recipient, mints new governance tokens for the caller if
     * the caller adds network tokens, and returns the new position id
     */
    function _addLiquidity(
        address owner,
        IConverterAnchor poolAnchor,
        IReserveToken reserveToken,
        uint256 amount
    ) private returns (uint256) {
        if (_isNetworkToken(reserveToken)) {
            _verifyEthAmount(0);

            return _addNetworkTokenLiquidity(owner, poolAnchor, amount);
        }

        // verify that ETH was passed with the call if needed
        _verifyEthAmount(reserveToken.isNativeToken() ? amount : 0);

        return _addBaseTokenLiquidity(owner, poolAnchor, reserveToken, amount);
    }

    /**
     * @dev adds network token liquidity to a pool, mints new governance tokens for the caller, and returns the new ]
     * position id
     */
    function _addNetworkTokenLiquidity(
        address owner,
        IConverterAnchor poolAnchor,
        uint256 amount
    ) internal returns (uint256) {
        IDSToken poolToken = IDSToken(address(poolAnchor));
        IReserveToken networkToken = IReserveToken(address(_networkToken));

        // get the rate between the pool token and the reserve
        Fraction memory poolRate = _poolTokenRate(poolToken, networkToken);

        // calculate the amount of pool tokens based on the amount of reserve tokens
        uint256 poolTokenAmount = _mulDivF(amount, poolRate.d, poolRate.n);

        // remove the pool tokens from the system's ownership (will revert if not enough tokens are available)
        _systemStore.decSystemBalance(poolToken, poolTokenAmount);

        // add the position for the recipient
        uint256 id = _addPosition(owner, poolToken, networkToken, poolTokenAmount, amount, _time());

        // burns the network tokens from the caller. we need to transfer the tokens to the contract itself, since only
        // token holders can burn their tokens
        _networkToken.safeTransferFrom(msg.sender, address(this), amount);
        _burnNetworkTokens(poolAnchor, amount);

        // mint governance tokens to the recipient
        _govTokenGovernance.mint(owner, amount);

        return id;
    }

    /**
     * @dev adds base token liquidity to a pool
     */
    function _addBaseTokenLiquidity(
        address owner,
        IConverterAnchor poolAnchor,
        IReserveToken baseToken,
        uint256 amount
    ) internal returns (uint256) {
        IDSToken poolToken = IDSToken(address(poolAnchor));
        IReserveToken networkToken = IReserveToken(address(_networkToken));

        // get the reserve balances
        ILiquidityPoolConverter converter = ILiquidityPoolConverter(payable(_ownedBy(poolAnchor)));
        (uint256 reserveBalanceBase, uint256 reserveBalanceNetwork) = _converterReserveBalances(
            converter,
            baseToken,
            networkToken
        );

        require(reserveBalanceNetwork >= _settings.minNetworkTokenLiquidityForMinting(), "ERR_NOT_ENOUGH_LIQUIDITY");

        // calculate and mint the required amount of network tokens for adding liquidity
        uint256 newNetworkLiquidityAmount = _mulDivF(amount, reserveBalanceNetwork, reserveBalanceBase);

        // get network token minting limit
        uint256 mintingLimit = _networkTokenMintingLimit(poolAnchor);

        uint256 newNetworkTokensMinted = _systemStore.networkTokensMinted(poolAnchor).add(newNetworkLiquidityAmount);
        require(newNetworkTokensMinted <= mintingLimit, "ERR_MAX_AMOUNT_REACHED");

        // issue new network tokens to the system
        _mintNetworkTokens(address(this), poolAnchor, newNetworkLiquidityAmount);

        // transfer the base tokens from the caller and approve the converter
        networkToken.ensureApprove(address(converter), newNetworkLiquidityAmount);

        if (!baseToken.isNativeToken()) {
            baseToken.safeTransferFrom(msg.sender, address(this), amount);
            baseToken.ensureApprove(address(converter), amount);
        }

        // add the liquidity to the converter
        _addLiquidity(converter, baseToken, networkToken, amount, newNetworkLiquidityAmount, msg.value);

        // transfer the new pool tokens to the wallet
        uint256 poolTokenAmount = poolToken.balanceOf(address(this));
        poolToken.safeTransfer(address(_wallet), poolTokenAmount);

        // the system splits the pool tokens with the caller
        // increase the system's pool token balance and add the position for the caller
        _systemStore.incSystemBalance(poolToken, poolTokenAmount - poolTokenAmount / 2); // account for rounding errors

        return _addPosition(owner, poolToken, baseToken, poolTokenAmount / 2, amount, _time());
    }

    /**
     * @dev returns the single-side staking base and network token limits of a given pool
     */
    function poolAvailableSpace(IConverterAnchor poolAnchor)
        external
        view
        poolSupportedAndWhitelisted(poolAnchor)
        returns (uint256, uint256)
    {
        return (_baseTokenAvailableSpace(poolAnchor), _networkTokenAvailableSpace(poolAnchor));
    }

    /**
     * @dev returns the base token staking limits of a given pool
     */
    function _baseTokenAvailableSpace(IConverterAnchor poolAnchor) internal view returns (uint256) {
        // get the pool converter
        ILiquidityPoolConverter converter = ILiquidityPoolConverter(payable(_ownedBy(poolAnchor)));

        // get the base token
        IReserveToken networkToken = IReserveToken(address(_networkToken));
        IReserveToken baseToken = _converterOtherReserve(converter, networkToken);

        // get the reserve balances
        (uint256 reserveBalanceBase, uint256 reserveBalanceNetwork) = _converterReserveBalances(
            converter,
            baseToken,
            networkToken
        );

        // get the network token minting limit
        uint256 mintingLimit = _networkTokenMintingLimit(poolAnchor);

        // get the amount of network tokens already minted for the pool
        uint256 networkTokensMinted = _systemStore.networkTokensMinted(poolAnchor);

        // get the amount of network tokens which can minted for the pool
        uint256 networkTokensCanBeMinted = Math.max(mintingLimit, networkTokensMinted) - networkTokensMinted;

        // return the maximum amount of base token liquidity that can be single-sided staked in the pool
        return _mulDivF(networkTokensCanBeMinted, reserveBalanceBase, reserveBalanceNetwork);
    }

    /**
     * @dev returns the network token staking limits of a given pool
     */
    function _networkTokenAvailableSpace(IConverterAnchor poolAnchor) internal view returns (uint256) {
        // get the pool token
        IDSToken poolToken = IDSToken(address(poolAnchor));
        IReserveToken networkToken = IReserveToken(address(_networkToken));

        // get the pool token rate
        Fraction memory poolRate = _poolTokenRate(poolToken, networkToken);

        // return the maximum amount of network token liquidity that can be single-sided staked in the pool
        return _systemStore.systemBalance(poolToken).mul(poolRate.n).add(poolRate.n).sub(1).div(poolRate.d);
    }

    /**
     * @dev returns the expected, actual, and network token compensation amounts the provider will receive for removing
     * liquidity
     *
     * note that it's also possible to provide the remove liquidity time to get an estimation for the return at that
     * given point
     */
    function removeLiquidityReturn(
        uint256 id,
        uint32 portion,
        uint256 removeTimestamp
    )
        external
        view
        validPortion(portion)
        returns (
            uint256,
            uint256,
            uint256
        )
    {
        Position memory pos = _position(id);

        require(pos.provider != address(0), "ERR_INVALID_ID");
        require(removeTimestamp >= pos.timestamp, "ERR_INVALID_TIMESTAMP");

        // calculate the portion of the liquidity to remove
        if (portion != PPM_RESOLUTION) {
            (pos.poolAmount, pos.reserveAmount) = _portionAmounts(pos.poolAmount, pos.reserveAmount, portion);
        }

        // get the various rates between the reserves upon adding liquidity and now
        PackedRates memory packedRates = _packRates(
            pos.poolToken,
            pos.reserveToken,
            pos.reserveRateN,
            pos.reserveRateD
        );

        (uint256 targetAmount,) = _removeLiquidityAmounts(
            pos.poolToken,
            pos.reserveToken,
            pos.poolAmount,
            pos.reserveAmount,
            packedRates
        );

        return (targetAmount, targetAmount, 0);
    }

    /**
     * @dev removes protected liquidity from a pool and also burns governance tokens from the caller if the caller
     * removes network tokens
     */
    function removeLiquidity(uint256 id, uint32 portion)
        external
        override
        nonReentrant
        removeLiquidityEnabled
        validPortion(portion)
    {
        _removeLiquidity(msg.sender, id, portion);
    }

    /**
     * @dev removes a position from a pool and burns governance tokens from the caller if the caller removes network tokens
     */
    function _removeLiquidity(
        address payable provider,
        uint256 id,
        uint32 portion
    ) internal {
        require(portion == PPM_RESOLUTION, "ERR_PORTION_NOT_SUPPORTED");

        // remove the position from the store and update the stats
        Position memory removedPos = _removePosition(provider, id, portion);

        // add the pool tokens to the system
        _systemStore.incSystemBalance(removedPos.poolToken, removedPos.poolAmount);

        // if removing network token liquidity, burn the governance tokens from the caller. we need to transfer the
        // tokens to the contract itself, since only token holders can burn their tokens
        if (_isNetworkToken(removedPos.reserveToken)) {
            _govToken.safeTransferFrom(provider, address(this), removedPos.reserveAmount);
            _govTokenGovernance.burn(removedPos.reserveAmount);
        }

        // get the various rates between the reserves upon adding liquidity and now
        PackedRates memory packedRates = _packRates(
            removedPos.poolToken,
            removedPos.reserveToken,
            removedPos.reserveRateN,
            removedPos.reserveRateD
        );

        // verify rate deviation as early as possible in order to reduce gas-cost for failing transactions
        _verifyRateDeviation(
            packedRates.removeSpotRateN,
            packedRates.removeSpotRateD,
            packedRates.removeAverageRateN,
            packedRates.removeAverageRateD
        );

        // get the target token amount
        (uint256 targetAmount, uint256 posValue) = _removeLiquidityAmounts(
            removedPos.poolToken,
            removedPos.reserveToken,
            removedPos.poolAmount,
            removedPos.reserveAmount,
            packedRates
        );

        // remove network token liquidity
        if (_isNetworkToken(removedPos.reserveToken)) {
            // mint network tokens for the caller and lock them
            _mintNetworkTokens(address(_wallet), removedPos.poolToken, targetAmount);
            _lockTokens(provider, targetAmount);
            return;
        }

        // remove base token liquidity

        // calculate the amount of pool tokens required for liquidation
        // note that the amount is doubled since it's not possible to liquidate one reserve only
        Fraction memory poolRate = _poolTokenRate(removedPos.poolToken, removedPos.reserveToken);
        uint256 poolAmount = _liquidationAmount(targetAmount, poolRate, removedPos.poolToken);

        // withdraw the pool tokens from the wallet
        _withdrawPoolTokens(removedPos.poolToken, poolAmount);

        // remove liquidity
        _removeLiquidity(
            removedPos.poolToken,
            poolAmount,
            removedPos.reserveToken,
            IReserveToken(address(_networkToken))
        );

        // reduce the total positions value
        uint256 totalValue = _totalPositionsValue[removedPos.poolToken];
        _totalPositionsValue[removedPos.poolToken] = Math.max(totalValue, posValue).sub(posValue);

        // transfer the base tokens to the caller
        uint256 baseBalance = removedPos.reserveToken.balanceOf(address(this));
        removedPos.reserveToken.safeTransfer(provider, baseBalance);

        // if the contract still holds network tokens, burn them
        uint256 networkBalance = _networkToken.balanceOf(address(this));
        if (networkBalance > 0) {
            _burnNetworkTokens(removedPos.poolToken, networkBalance);
        }
    }

    /**
     * @dev returns the value of the specific position, based on the initial stake, fees
     * and positional IL
     */
    function positionValue(uint256 id) external view returns (uint256) {
        Position memory pos = _position(id);

        // get the various rates between the reserves upon adding liquidity and now
        PackedRates memory packedRates = _packRates(
            pos.poolToken,
            pos.reserveToken,
            pos.reserveRateN,
            pos.reserveRateD
        );

        (, uint256 posValue) = _removeLiquidityAmounts(
            pos.poolToken,
            pos.reserveToken,
            pos.poolAmount,
            pos.reserveAmount, 
            packedRates
        );
        return posValue;
    }

    /**
     * @dev returns the amount the provider will receive for removing liquidity
     * as well as the specific position value (before deficit reduction)
     */
    function _removeLiquidityAmounts(
        IDSToken poolToken,
        IReserveToken reserveToken,
        uint256 poolAmount,
        uint256 reserveAmount,
        PackedRates memory packedRates
    ) internal view returns (uint256, uint256) {
        uint256 targetAmount;
        // get the rate between the reserves upon adding liquidity and now
        Fraction memory addSpotRate = Fraction({ n: packedRates.addSpotRateN, d: packedRates.addSpotRateD });
        Fraction memory removeSpotRate = Fraction({ n: packedRates.removeSpotRateN, d: packedRates.removeSpotRateD });

        // get the rate between the pool token and the reserve token
        Fraction memory poolRate = _poolTokenRate(poolToken, reserveToken);

        // calculate the protected amount of reserve tokens plus accumulated fee
        targetAmount = _protectedAmountPlusFee(poolAmount, poolRate, addSpotRate, removeSpotRate);

        // for the network token, return the target amount
        if (_isNetworkToken(reserveToken)) {
            return (targetAmount, targetAmount);
        }

        Fraction memory removeAverageRate = Fraction({
            n: packedRates.removeAverageRateN,
            d: packedRates.removeAverageRateD
        });

        // calculate the position impermanent loss
        Fraction memory loss = _impLoss(addSpotRate, removeAverageRate);

        // deduct the position IL from the target amount
        targetAmount = _deductIL(Math.max(reserveAmount, targetAmount), loss);

        // get the pool deficit
        Fraction memory poolDeficit = _poolDeficit(poolToken);

        // calculate the available liquidity portion
        Fraction memory availablePortion = Fraction({ n: poolDeficit.d - poolDeficit.n, d: poolDeficit.d});

        // return the amount the provider will receive for removing liquidity
        // as well as the specific position value (before deficit reduction)
        return (_mulDivF(targetAmount, availablePortion.n, availablePortion.d), targetAmount);
    }

    /**
     * @dev returns the pool deficit based on the total protected amount vs. total
     * positions value, in PPM
     */
    function poolDeficitPPM(IDSToken poolToken)
        external
        view
        returns (uint256)
    {
        Fraction memory poolDeficit = _poolDeficit(poolToken);
        return _mulDivF(PPM_RESOLUTION, poolDeficit.n, poolDeficit.d);
    }

    /**
     * @dev returns the pool deficit based on the total protected amount vs. total
     * positions value, as a fraction.
     * note that 0/1 is returned if the pool is not in deficit
     */
    function _poolDeficit(IDSToken poolToken)
        private
        view
        returns (Fraction memory)
    {
        // get the converter balance
        IConverter converter = IConverter(payable(_ownedBy(poolToken)));
        IReserveToken reserveToken = _converterOtherReserve(converter, IReserveToken(address(_networkToken)));
        uint256 reserveBalance = converter.reserveBalance(reserveToken);

        // calculate the protected liquidity amount
        uint256 poolTokenSupply = poolToken.totalSupply();
        uint256 protectedPoolTokenAmount = poolToken.balanceOf(address(_wallet));
        uint256 protectedLiquidity = _mulDivF(reserveBalance, protectedPoolTokenAmount, poolTokenSupply);

        // get the total positions value
        uint256 totalValue = totalPositionsValue(poolToken);

        // if the protected liquidity is equal or greater than the total value,
        // the pool is not in deficit
        if (protectedLiquidity >= totalValue) {
            return Fraction({ n: 0, d: 1 });
        }

        // the pool is in deficit
        return Fraction({
            n: totalValue.sub(protectedLiquidity),
            d: totalValue
        });
    }

    /**
     * @dev transfers a position to a new provider
     *
     * Requirements:
     *
     * - the caller must be the owner of the position
     */
    function transferPosition(uint256 id, address newProvider)
        external
        override
        nonReentrant
        validAddress(newProvider)
        returns (uint256)
    {
        return _transferPosition(msg.sender, id, newProvider);
    }

    /**
     * @dev transfers a position to a new provider and optionally notifies another contract
     *
     * Requirements:
     *
     * - the caller must be the owner of the position
     */
    function transferPositionAndNotify(
        uint256 id,
        address newProvider,
        ITransferPositionCallback callback,
        bytes calldata data
    ) external override nonReentrant validAddress(newProvider) validAddress(address(callback)) returns (uint256) {
        uint256 newId = _transferPosition(msg.sender, id, newProvider);

        callback.onTransferPosition(newId, msg.sender, data);

        return newId;
    }

    /**
     * @dev migrates system pool tokens to v3
     *
     * Requirements:
     *
     * - the caller must be the owner of this contract
     */
    function migrateSystemPoolTokens(IConverterAnchor[] calldata poolAnchors) external nonReentrant ownerOnly {
        uint256 length = poolAnchors.length;
        for (uint256 i = 0; i < length; i++) {
            IConverterAnchor poolAnchor = poolAnchors[i];
            IDSToken poolToken = IDSToken(address(poolAnchor));
            ILiquidityPoolConverter converter = ILiquidityPoolConverter(payable(_ownedBy(poolToken)));
            IReserveToken reserveToken1 = IReserveToken(address(_networkToken));
            IReserveToken reserveToken2 = _converterOtherReserve(converter, IReserveToken(address(_networkToken)));

            uint256 poolAmount = _poolTokensToMigrate(poolToken, converter, reserveToken2);
            if (poolAmount == 0) {
                continue;
            }

            _withdrawPoolTokens(poolToken, poolAmount);

            (IReserveToken[] memory reserveTokens, uint256[] memory minReturns) = _removeLiquidityInput(
                reserveToken1,
                reserveToken2
            );
            uint256[] memory reserveAmounts = converter.removeLiquidity(poolAmount, reserveTokens, minReturns);

            _burnNetworkTokens(poolAnchor, reserveAmounts[0]);
            if (reserveTokens[1].isNativeToken()) {
                _vaultV3.sendValue(reserveAmounts[1]);
            } else {
                reserveTokens[1].safeTransfer(_vaultV3, reserveAmounts[1]);
            }
        }
    }

    /**
     * @dev amount of pool tokens to migrate to v3
     * @param poolToken pool token
     * @param converter pool converter
     * @param reserveToken the reserve tokens whose pool tokens we'll migrate
     * @return poolAmount number of pool tokens to migrate to v3
     * if the pool is in deficit don't migrate it (return 0)
     *
     */
    function _poolTokensToMigrate(
        IDSToken poolToken,
        ILiquidityPoolConverter converter,
        IReserveToken reserveToken
    ) private view returns (uint256) {
        // calcualte the total positions pool token amount
        uint256 totalPositionsValue = totalPositionsValue(poolToken);
        uint256 reserveBalance = converter.reserveBalance(reserveToken);
        uint256 poolTokenSupply = poolToken.totalSupply();
        uint256 positionsPoolTokenAmount = _mulDivF(poolTokenSupply, totalPositionsValue, reserveBalance);

        // get the total protected pool tokens amount
        uint256 protectedPoolTokenAmount = poolToken.balanceOf(address(_wallet));
        // if the positions pool token amount is greater or equal to the total
        // protected pool token amount, there's nothing to migrate
        if (positionsPoolTokenAmount >= protectedPoolTokenAmount) {
            return 0;
        }

        // deduct the positions pool toke amount from the total protected pool tokens amount
        // and limit it by the system balance
        uint256 poolAmountToMigrate = protectedPoolTokenAmount.sub(positionsPoolTokenAmount);
        uint256 systemPoolAmount = _systemStore.systemBalance(poolToken);
        return Math.min(poolAmountToMigrate, systemPoolAmount);
    }

    /**
     * @dev transfers a position to a new provider
     */
    function _transferPosition(
        address provider,
        uint256 id,
        address newProvider
    ) internal returns (uint256) {
        // remove the position from the store and update the stats
        Position memory removedPos = _removePosition(provider, id, PPM_RESOLUTION);

        // add the position to the store, update the stats, and return the new id
        return
            _addPosition(
                newProvider,
                removedPos.poolToken,
                removedPos.reserveToken,
                removedPos.poolAmount,
                removedPos.reserveAmount,
                removedPos.timestamp
            );
    }

    /**
     * @dev allows the caller to claim network token balance that is no longer locked
     *
     * note that the function can revert if the range is too large
     */
    function claimBalance(uint256 startIndex, uint256 endIndex) external nonReentrant {
        // get the locked balances from the store
        (uint256[] memory amounts, uint256[] memory expirationTimes) = _store.lockedBalanceRange(
            msg.sender,
            startIndex,
            endIndex
        );

        uint256 totalAmount = 0;
        uint256 length = amounts.length;
        assert(length == expirationTimes.length);

        // reverse iteration since we're removing from the list
        for (uint256 i = length; i > 0; i--) {
            uint256 index = i - 1;
            if (expirationTimes[index] > _time()) {
                continue;
            }

            // remove the locked balance item
            _store.removeLockedBalance(msg.sender, startIndex + index);
            totalAmount = totalAmount.add(amounts[index]);
        }

        if (totalAmount > 0) {
            // transfer the tokens to the caller in a single call
            _wallet.withdrawTokens(IReserveToken(address(_networkToken)), msg.sender, totalAmount);
        }
    }

    /**
     * @dev adds the position to the store and updates the stats
     */
    function _addPosition(
        address provider,
        IDSToken poolToken,
        IReserveToken reserveToken,
        uint256 poolAmount,
        uint256 reserveAmount,
        uint256 timestamp
    ) internal returns (uint256) {
        // verify rate deviation as early as possible in order to reduce gas-cost for failing transactions
        (Fraction memory spotRate, Fraction memory averageRate) = _reserveTokenRates(poolToken, reserveToken);
        _verifyRateDeviation(spotRate.n, spotRate.d, averageRate.n, averageRate.d);

        _stats.increaseTotalAmounts(provider, poolToken, reserveToken, poolAmount, reserveAmount);
        _stats.addProviderPool(provider, poolToken);

        return
            _store.addProtectedLiquidity(
                provider,
                poolToken,
                reserveToken,
                poolAmount,
                reserveAmount,
                spotRate.n,
                spotRate.d,
                timestamp
            );
    }

    /**
     * @dev removes the position from the store and updates the stats
     */
    function _removePosition(
        address provider,
        uint256 id,
        uint32 portion
    ) private returns (Position memory) {
        Position memory pos = _providerPosition(id, provider);

        // verify that the pool is whitelisted
        _poolWhitelisted(pos.poolToken);

        // verify that the position is not removed on the same block in which it was added
        require(pos.timestamp < _time(), "ERR_TOO_EARLY");

        if (portion == PPM_RESOLUTION) {
            // remove the position from the provider
            _store.removeProtectedLiquidity(id);
        } else {
            // remove a portion of the position from the provider
            uint256 fullPoolAmount = pos.poolAmount;
            uint256 fullReserveAmount = pos.reserveAmount;
            (pos.poolAmount, pos.reserveAmount) = _portionAmounts(pos.poolAmount, pos.reserveAmount, portion);

            _store.updateProtectedLiquidityAmounts(
                id,
                fullPoolAmount - pos.poolAmount,
                fullReserveAmount - pos.reserveAmount
            );
        }

        // update the statistics
        _stats.decreaseTotalAmounts(pos.provider, pos.poolToken, pos.reserveToken, pos.poolAmount, pos.reserveAmount);

        return pos;
    }

    /**
     * @dev locks network tokens for the provider and emits the tokens locked event
     */
    function _lockTokens(address provider, uint256 amount) internal {
        uint256 expirationTime = _time().add(_settings.lockDuration());
        _store.addLockedBalance(provider, amount, expirationTime);
    }

    /**
     * @dev returns the rate of 1 pool token in reserve token units
     */
    function _poolTokenRate(IDSToken poolToken, IReserveToken reserveToken)
        internal
        view
        virtual
        returns (Fraction memory)
    {
        // get the pool token supply
        uint256 poolTokenSupply = poolToken.totalSupply();

        // get the reserve balance
        IConverter converter = IConverter(payable(_ownedBy(poolToken)));
        uint256 reserveBalance = converter.getConnectorBalance(reserveToken);

        // for standard pools, 50% of the pool supply value equals the value of each reserve
        return Fraction({ n: reserveBalance.mul(2), d: poolTokenSupply });
    }

    /**
     * @dev returns the spot rate and average rate of 1 reserve token in the other reserve token units
     */
    function _reserveTokenRates(IDSToken poolToken, IReserveToken reserveToken)
        internal
        view
        returns (Fraction memory, Fraction memory)
    {
        ILiquidityPoolConverter converter = ILiquidityPoolConverter(payable(_ownedBy(poolToken)));
        IReserveToken otherReserve = _converterOtherReserve(converter, reserveToken);

        (uint256 spotRateN, uint256 spotRateD) = _converterReserveBalances(converter, otherReserve, reserveToken);
        (uint256 averageRateN, uint256 averageRateD) = converter.recentAverageRate(reserveToken);

        return (Fraction({ n: spotRateN, d: spotRateD }), Fraction({ n: averageRateN, d: averageRateD }));
    }

    /**
     * @dev returns the various rates between the reserves
     */
    function _packRates(
        IDSToken poolToken,
        IReserveToken reserveToken,
        uint256 addSpotRateN,
        uint256 addSpotRateD
    ) internal view returns (PackedRates memory) {
        (Fraction memory removeSpotRate, Fraction memory removeAverageRate) = _reserveTokenRates(
            poolToken,
            reserveToken
        );

        assert((removeSpotRate.n | removeSpotRate.d | removeAverageRate.n | removeAverageRate.d) <= MAX_UINT128);

        return _packRates(addSpotRateN, addSpotRateD, removeSpotRate, removeAverageRate);
    }

    /**
     * @dev returns the various rates between the reserves
     */
    function _packRates(
        uint256 addSpotRateN,
        uint256 addSpotRateD,
        Fraction memory removeSpotRate,
        Fraction memory removeAverageRate
    ) internal pure returns (PackedRates memory) {
        assert((addSpotRateN | addSpotRateD) <= MAX_UINT128);

        return
            PackedRates({
                addSpotRateN: uint128(addSpotRateN),
                addSpotRateD: uint128(addSpotRateD),
                removeSpotRateN: uint128(removeSpotRate.n),
                removeSpotRateD: uint128(removeSpotRate.d),
                removeAverageRateN: uint128(removeAverageRate.n),
                removeAverageRateD: uint128(removeAverageRate.d)
            });
    }

    /**
     * @dev verifies that the deviation of the average rate from the spot rate is within the permitted range
     *
     * for example, if the maximum permitted deviation is 5%, then verify `95/100 <= average/spot <= 100/95`
     */
    function _verifyRateDeviation(
        uint256 spotRateN,
        uint256 spotRateD,
        uint256 averageRateN,
        uint256 averageRateD
    ) internal view {
        uint256 ppmDelta = PPM_RESOLUTION - _settings.averageRateMaxDeviation();
        uint256 min = spotRateN.mul(averageRateD).mul(ppmDelta).mul(ppmDelta);
        uint256 mid = spotRateD.mul(averageRateN).mul(ppmDelta).mul(PPM_RESOLUTION);
        uint256 max = spotRateN.mul(averageRateD).mul(PPM_RESOLUTION).mul(PPM_RESOLUTION);
        require(min <= mid && mid <= max, "ERR_INVALID_RATE");
    }

    /**
     * @dev utility to add liquidity to a converter
     */
    function _addLiquidity(
        ILiquidityPoolConverter converter,
        IReserveToken reserveToken1,
        IReserveToken reserveToken2,
        uint256 reserveAmount1,
        uint256 reserveAmount2,
        uint256 value
    ) internal {
        IReserveToken[] memory reserveTokens = new IReserveToken[](2);
        uint256[] memory amounts = new uint256[](2);
        reserveTokens[0] = reserveToken1;
        reserveTokens[1] = reserveToken2;
        amounts[0] = reserveAmount1;
        amounts[1] = reserveAmount2;
        converter.addLiquidity{ value: value }(reserveTokens, amounts, 1);
    }

    /**
     * @dev utility to remove liquidity from a converter
     */
    function _removeLiquidity(
        IDSToken poolToken,
        uint256 poolAmount,
        IReserveToken reserveToken1,
        IReserveToken reserveToken2
    ) internal {
        ILiquidityPoolConverter converter = ILiquidityPoolConverter(payable(_ownedBy(poolToken)));
        (IReserveToken[] memory reserveTokens, uint256[] memory minReturns) = _removeLiquidityInput(
            reserveToken1,
            reserveToken2
        );
        converter.removeLiquidity(poolAmount, reserveTokens, minReturns);
    }

    /**
     * @dev returns a position from the store
     */
    function _position(uint256 id) internal view returns (Position memory) {
        Position memory pos;
        (
            pos.provider,
            pos.poolToken,
            pos.reserveToken,
            pos.poolAmount,
            pos.reserveAmount,
            pos.reserveRateN,
            pos.reserveRateD,
            pos.timestamp
        ) = _store.protectedLiquidity(id);

        return pos;
    }

    /**
     * @dev returns a position from the store
     */
    function _providerPosition(uint256 id, address provider) internal view returns (Position memory) {
        Position memory pos = _position(id);
        require(pos.provider == provider, "ERR_ACCESS_DENIED");

        return pos;
    }

    /**
     * @dev returns the protected amount of reserve tokens plus accumulated fee before compensation
     */
    function _protectedAmountPlusFee(
        uint256 poolAmount,
        Fraction memory poolRate,
        Fraction memory addRate,
        Fraction memory removeRate
    ) internal pure returns (uint256) {
        uint256 n = MathEx.ceilSqrt(addRate.d.mul(removeRate.n)).mul(poolRate.n);
        uint256 d = MathEx.floorSqrt(addRate.n.mul(removeRate.d)).mul(poolRate.d);

        uint256 x = n * poolAmount;
        if (x / n == poolAmount) {
            return x / d;
        }

        (uint256 hi, uint256 lo) = n > poolAmount ? (n, poolAmount) : (poolAmount, n);
        (uint256 p, uint256 q) = MathEx.reducedRatio(hi, d, MAX_UINT256 / lo);
        uint256 min = (hi / d).mul(lo);

        if (q > 0) {
            return Math.max(min, (p * lo) / q);
        }
        return min;
    }

    /**
     * @dev returns the impermanent loss incurred due to the change in rates between the reserve tokens
     */
    function _impLoss(Fraction memory prevRate, Fraction memory newRate) internal pure returns (Fraction memory) {
        uint256 ratioN = newRate.n.mul(prevRate.d);
        uint256 ratioD = newRate.d.mul(prevRate.n);

        uint256 prod = ratioN * ratioD;
        uint256 root = prod / ratioN == ratioD
            ? MathEx.floorSqrt(prod)
            : MathEx.floorSqrt(ratioN) * MathEx.floorSqrt(ratioD);
        uint256 sum = ratioN.add(ratioD);

        // the arithmetic below is safe because `x + y >= sqrt(x * y) * 2`
        if (sum % 2 == 0) {
            sum /= 2;
            return Fraction({ n: sum - root, d: sum });
        }
        return Fraction({ n: sum - root * 2, d: sum });
    }

    /**
     * @dev deducts the IL amount from the given position value
     */
    function _deductIL(uint256 value, Fraction memory loss) internal pure returns (uint256) {
        uint256 maxVal = Math.max(1, value);
        (uint256 lossN, uint256 lossD) = MathEx.reducedRatio(loss.n, loss.d, MAX_UINT256 / maxVal);
        return value.mul(lossD.sub(lossN)).div(lossD);
    }

    /**
     * @dev utility to mint network tokens
     */
    function _mintNetworkTokens(
        address owner,
        IConverterAnchor poolAnchor,
        uint256 amount
    ) private {
        _systemStore.incNetworkTokensMinted(poolAnchor, amount);
        _networkTokenGovernance.mint(owner, amount);
    }

    /**
     * @dev utility to burn network tokens
     */
    function _burnNetworkTokens(IConverterAnchor poolAnchor, uint256 amount) private {
        _systemStore.decNetworkTokensMinted(poolAnchor, amount);
        _networkTokenGovernance.burn(amount);
    }

    /**
     * @dev utility to get the reserve balances
     */
    function _converterReserveBalances(
        IConverter converter,
        IReserveToken reserveToken1,
        IReserveToken reserveToken2
    ) private view returns (uint256, uint256) {
        return (converter.getConnectorBalance(reserveToken1), converter.getConnectorBalance(reserveToken2));
    }

    /**
     * @dev utility to get the other reserve
     */
    function _converterOtherReserve(IConverter converter, IReserveToken thisReserve)
        private
        view
        returns (IReserveToken)
    {
        IReserveToken otherReserve = converter.connectorTokens(0);
        return otherReserve != thisReserve ? otherReserve : converter.connectorTokens(1);
    }

    /**
     * @dev utility to get the owner
     */
    function _ownedBy(IOwned owned) private view returns (address) {
        return owned.owner();
    }

    /**
     * @dev returns whether the provided reserve token is the network token
     */
    function _isNetworkToken(IReserveToken reserveToken) private view returns (bool) {
        return address(reserveToken) == address(_networkToken);
    }

    /**
     * @dev returns custom input for the `removeLiquidity` converter function
     */
    function _removeLiquidityInput(IReserveToken reserveToken1, IReserveToken reserveToken2)
        private
        pure
        returns (IReserveToken[] memory, uint256[] memory)
    {
        IReserveToken[] memory reserveTokens = new IReserveToken[](2);
        uint256[] memory minReturns = new uint256[](2);
        reserveTokens[0] = reserveToken1;
        reserveTokens[1] = reserveToken2;
        minReturns[0] = 1;
        minReturns[1] = 1;
        return (reserveTokens, minReturns);
    }

    /**
     * @dev returns the relative position amounts
     */
    function _portionAmounts(
        uint256 poolAmount,
        uint256 reserveAmount,
        uint256 portion
    ) private pure returns (uint256, uint256) {
        return (_mulDivF(poolAmount, portion, PPM_RESOLUTION), _mulDivF(reserveAmount, portion, PPM_RESOLUTION));
    }

    /**
     * @dev returns the network token minting limit
     */
    function _networkTokenMintingLimit(IConverterAnchor poolAnchor) private view returns (uint256) {
        uint256 mintingLimit = _settings.networkTokenMintingLimits(poolAnchor);
        return mintingLimit > 0 ? mintingLimit : _settings.defaultNetworkTokenMintingLimit();
    }

    /**
     * @dev returns the amount of pool tokens required for liquidation
     */
    function _liquidationAmount(
        uint256 targetAmount,
        Fraction memory poolRate,
        IDSToken poolToken
    ) private view returns (uint256) {
        // note that the amount is doubled since it's not possible to liquidate one reserve only
        uint256 poolAmount = _mulDivF(targetAmount, poolRate.d.mul(2), poolRate.n);
        // limit the amount of pool tokens by the amount the system/caller holds
        return Math.min(poolAmount, poolToken.balanceOf(address(_wallet)));
    }

    /**
     * @dev withdraw pool tokens from the wallet
     */
    function _withdrawPoolTokens(IDSToken poolToken, uint256 poolAmount) private {
        uint256 systemBalance = _systemStore.systemBalance(poolToken);
        _systemStore.decSystemBalance(poolToken, Math.min(poolAmount, systemBalance));
        _wallet.withdrawTokens(IReserveToken(address(poolToken)), address(this), poolAmount);
    }

    /**
     * @dev returns `x * y / z`
     */
    function _mulDivF(
        uint256 x,
        uint256 y,
        uint256 z
    ) private pure returns (uint256) {
        return x.mul(y).div(z);
    }

    /**
     * @dev enables/disabled deposits
     *
     * Requirements:
     *
     * - the caller must be the owner of the contract
     */
    function enableDepositing(bool state) external ownerOnly {
        _addingEnabled = state;
    }

    /**
     * @dev enables/disabled removals
     *
     * Requirements:
     *
     * - the caller must be the owner of the contract
     */
    function enableRemoving(bool state) external ownerOnly {
        _removingEnabled = state;
    }

    /**
     * Sets the total positions value of the pool to the given amount
     * @param poolAnchor pool anchor
     * @param amount total positions value amount in wei
     *
     * Requirements:
     *
     * - the caller must be the owner of the contract
     * - the pool must exist and be whitelisted
     */
    function setTotalPositionsValue(IConverterAnchor poolAnchor, uint256 amount)
        public
        ownerOnly
        poolSupportedAndWhitelisted(poolAnchor)
    {
        _totalPositionsValue[poolAnchor] = amount;
    }

    /**
     * Sets the total positions value of multiple pools in a single call
     * @param poolAnchors list of pool anchor
     * @param amounts list of total positions value amount in wei
     *
     * Requirements:
     *
     * - the caller must be the owner of the contract
     * - the pools must exist and be whitelisted
     */
    function setTotalPositionsValueMultiple(IConverterAnchor[] calldata poolAnchors, uint256[] calldata amounts)
        public
        ownerOnly
    {
        require(poolAnchors.length == amounts.length, "ERR_LENGTH_MISMATCH");
        for (uint256 i = 0; i < poolAnchors.length; i++) {
            setTotalPositionsValue(poolAnchors[i], amounts[i]);
        }
    }

    /**
     * Returns the total positions value of the pool, in wei
     * @return amount total positions value of the pool, in wei
     * @param poolAnchor pool anchor
     */
    function totalPositionsValue(IConverterAnchor poolAnchor) public view returns (uint256 amount) {
        return _totalPositionsValue[poolAnchor];
    }
}
