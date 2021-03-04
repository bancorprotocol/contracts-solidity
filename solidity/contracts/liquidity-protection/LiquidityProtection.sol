// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "@bancor/token-governance/contracts/ITokenGovernance.sol";

import "../utility/interfaces/ICheckpointStore.sol";
import "../utility/MathEx.sol";
import "../utility/ReentrancyGuard.sol";
import "../utility/Types.sol";
import "../utility/Time.sol";
import "../utility/Utils.sol";
import "../utility/Owned.sol";
import "./interfaces/ILiquidityProtection.sol";
import "../token/interfaces/IDSToken.sol";
import "../converter/interfaces/IConverterAnchor.sol";
import "../converter/interfaces/IConverter.sol";
import "../converter/interfaces/IConverterRegistry.sol";

interface ILiquidityPoolConverter is IConverter {
    function addLiquidity(
        IERC20[] memory _reserveTokens,
        uint256[] memory _reserveAmounts,
        uint256 _minReturn
    ) external payable;

    function removeLiquidity(
        uint256 _amount,
        IERC20[] memory _reserveTokens,
        uint256[] memory _reserveMinReturnAmounts
    ) external;

    function recentAverageRate(IERC20 _reserveToken) external view returns (uint256, uint256);
}

/**
 * @dev This contract implements the liquidity protection mechanism.
 */
contract LiquidityProtection is ILiquidityProtection, Utils, Owned, ReentrancyGuard, Time {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    using SafeERC20 for IDSToken;
    using MathEx for *;

    struct ProtectedLiquidity {
        address provider; // liquidity provider
        IDSToken poolToken; // pool token address
        IERC20 reserveToken; // reserve token address
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

    ILiquidityProtectionSettings public immutable override settings;
    ILiquidityProtectionStore public immutable override store;
    ILiquidityProtectionStats public immutable override stats;
    ILiquidityProtectionSystemStore public immutable override systemStore;
    ITokenHolder public immutable override wallet;
    IERC20 public immutable networkToken;
    ITokenGovernance public immutable networkTokenGovernance;
    IERC20 public immutable govToken;
    ITokenGovernance public immutable govTokenGovernance;
    ICheckpointStore public immutable lastRemoveCheckpointStore;

    // true if the contract is currently adding/removing liquidity from a converter, used for accepting ETH
    bool private updatingLiquidity = false;

    /**
     * @dev initializes a new LiquidityProtection contract
     *
     * @param _contractAddresses:
     * - [0] liquidity protection settings
     * - [1] liquidity protection store
     * - [2] liquidity protection stats
     * - [3] liquidity protection system store
     * - [4] liquidity protection wallet
     * - [5] network token governance
     * - [6] governance token governance
     * - [7] last liquidity removal/unprotection checkpoints store
     */
    constructor(address[8] memory _contractAddresses) public {
        for (uint256 i = 0; i < _contractAddresses.length; i++) {
            _validAddress(_contractAddresses[i]);
        }

        settings = ILiquidityProtectionSettings(_contractAddresses[0]);
        store = ILiquidityProtectionStore(_contractAddresses[1]);
        stats = ILiquidityProtectionStats(_contractAddresses[2]);
        systemStore = ILiquidityProtectionSystemStore(_contractAddresses[3]);
        wallet = ITokenHolder(_contractAddresses[4]);
        networkTokenGovernance = ITokenGovernance(_contractAddresses[5]);
        govTokenGovernance = ITokenGovernance(_contractAddresses[6]);
        lastRemoveCheckpointStore = ICheckpointStore(_contractAddresses[7]);

        networkToken = IERC20(address(ITokenGovernance(_contractAddresses[5]).token()));
        govToken = IERC20(address(ITokenGovernance(_contractAddresses[6]).token()));
    }

    // ensures that the contract is currently removing liquidity from a converter
    modifier updatingLiquidityOnly() {
        require(updatingLiquidity, "ERR_NOT_UPDATING_LIQUIDITY");
        _;
    }

    // ensures that the pool is supported and whitelisted
    modifier poolSupportedAndWhitelisted(IConverterAnchor _poolAnchor) {
        _poolSupported(_poolAnchor);
        _poolWhitelisted(_poolAnchor);
        _;
    }

    // ensures that add liquidity is enabled
    modifier addLiquidityEnabled(IConverterAnchor _poolAnchor, IERC20 _reserveToken) {
        _addLiquidityEnabled(_poolAnchor, _reserveToken);
        _;
    }

    // error message binary size optimization
    function _poolSupported(IConverterAnchor _poolAnchor) internal view {
        require(settings.isPoolSupported(_poolAnchor), "ERR_POOL_NOT_SUPPORTED");
    }

    // error message binary size optimization
    function _poolWhitelisted(IConverterAnchor _poolAnchor) internal view {
        require(settings.isPoolWhitelisted(_poolAnchor), "ERR_POOL_NOT_WHITELISTED");
    }

    // error message binary size optimization
    function _addLiquidityEnabled(IConverterAnchor _poolAnchor, IERC20 _reserveToken) internal view {
        require(!settings.addLiquidityDisabled(_poolAnchor, _reserveToken), "ERR_ADD_LIQUIDITY_DISABLED");
    }

    // error message binary size optimization
    function verifyEthAmount(uint256 _value) internal view {
        require(msg.value == _value, "ERR_ETH_AMOUNT_MISMATCH");
    }

    /**
     * @dev accept ETH
     * used when removing liquidity from ETH converters
     */
    receive() external payable updatingLiquidityOnly() {}

    /**
     * @dev transfers the ownership of the store
     * can only be called by the contract owner
     *
     * @param _newOwner    the new owner of the store
     */
    function transferStoreOwnership(address _newOwner) external ownerOnly {
        store.transferOwnership(_newOwner);
    }

    /**
     * @dev accepts the ownership of the store
     * can only be called by the contract owner
     */
    function acceptStoreOwnership() external ownerOnly {
        store.acceptOwnership();
    }

    /**
     * @dev transfers the ownership of the wallet
     * can only be called by the contract owner
     *
     * @param _newOwner    the new owner of the wallet
     */
    function transferWalletOwnership(address _newOwner) external ownerOnly {
        wallet.transferOwnership(_newOwner);
    }

    /**
     * @dev accepts the ownership of the wallet
     * can only be called by the contract owner
     */
    function acceptWalletOwnership() external ownerOnly {
        wallet.acceptOwnership();
    }

    /**
     * @dev adds protected liquidity to a pool for a specific recipient
     * also mints new governance tokens for the caller if the caller adds network tokens
     *
     * @param _owner       protected liquidity owner
     * @param _poolAnchor      anchor of the pool
     * @param _reserveToken    reserve token to add to the pool
     * @param _amount          amount of tokens to add to the pool
     * @return new protected liquidity id
     */
    function addLiquidityFor(
        address _owner,
        IConverterAnchor _poolAnchor,
        IERC20 _reserveToken,
        uint256 _amount
    )
        external
        payable
        override
        protected
        validAddress(_owner)
        poolSupportedAndWhitelisted(_poolAnchor)
        addLiquidityEnabled(_poolAnchor, _reserveToken)
        greaterThanZero(_amount)
        returns (uint256)
    {
        return addLiquidity(_owner, _poolAnchor, _reserveToken, _amount);
    }

    /**
     * @dev adds protected liquidity to a pool
     * also mints new governance tokens for the caller if the caller adds network tokens
     *
     * @param _poolAnchor      anchor of the pool
     * @param _reserveToken    reserve token to add to the pool
     * @param _amount          amount of tokens to add to the pool
     * @return new protected liquidity id
     */
    function addLiquidity(
        IConverterAnchor _poolAnchor,
        IERC20 _reserveToken,
        uint256 _amount
    )
        external
        payable
        override
        protected
        poolSupportedAndWhitelisted(_poolAnchor)
        addLiquidityEnabled(_poolAnchor, _reserveToken)
        greaterThanZero(_amount)
        returns (uint256)
    {
        return addLiquidity(msg.sender, _poolAnchor, _reserveToken, _amount);
    }

    /**
     * @dev adds protected liquidity to a pool for a specific recipient
     * also mints new governance tokens for the caller if the caller adds network tokens
     *
     * @param _owner       protected liquidity owner
     * @param _poolAnchor      anchor of the pool
     * @param _reserveToken    reserve token to add to the pool
     * @param _amount          amount of tokens to add to the pool
     * @return new protected liquidity id
     */
    function addLiquidity(
        address _owner,
        IConverterAnchor _poolAnchor,
        IERC20 _reserveToken,
        uint256 _amount
    ) private returns (uint256) {
        // save a local copy of `networkToken`
        IERC20 networkTokenLocal = networkToken;

        if (_reserveToken == networkTokenLocal) {
            verifyEthAmount(0);
            return addNetworkTokenLiquidity(_owner, _poolAnchor, networkTokenLocal, _amount);
        }

        // verify that ETH was passed with the call if needed
        verifyEthAmount(_reserveToken == ETH_RESERVE_ADDRESS ? _amount : 0);
        return addBaseTokenLiquidity(_owner, _poolAnchor, _reserveToken, networkTokenLocal, _amount);
    }

    /**
     * @dev adds protected network token liquidity to a pool
     * also mints new governance tokens for the caller
     *
     * @param _owner    protected liquidity owner
     * @param _poolAnchor   anchor of the pool
     * @param _networkToken the network reserve token of the pool
     * @param _amount       amount of tokens to add to the pool
     * @return new protected liquidity id
     */
    function addNetworkTokenLiquidity(
        address _owner,
        IConverterAnchor _poolAnchor,
        IERC20 _networkToken,
        uint256 _amount
    ) internal returns (uint256) {
        IDSToken poolToken = IDSToken(address(_poolAnchor));

        // get the rate between the pool token and the reserve
        Fraction memory poolRate = poolTokenRate(poolToken, _networkToken);

        // calculate the amount of pool tokens based on the amount of reserve tokens
        uint256 poolTokenAmount = _amount.mul(poolRate.d).div(poolRate.n);

        // remove the pool tokens from the system's ownership (will revert if not enough tokens are available)
        systemStore.decSystemBalance(poolToken, poolTokenAmount);

        // add protected liquidity for the recipient
        uint256 id = addProtectedLiquidity(_owner, poolToken, _networkToken, poolTokenAmount, _amount);

        // burns the network tokens from the caller. we need to transfer the tokens to the contract itself, since only
        // token holders can burn their tokens
        _networkToken.safeTransferFrom(msg.sender, address(this), _amount);
        burnNetworkTokens(_poolAnchor, _amount);

        // mint governance tokens to the recipient
        govTokenGovernance.mint(_owner, _amount);

        return id;
    }

    /**
     * @dev adds protected base token liquidity to a pool
     *
     * @param _owner    protected liquidity owner
     * @param _poolAnchor   anchor of the pool
     * @param _baseToken    the base reserve token of the pool
     * @param _networkToken the network reserve token of the pool
     * @param _amount       amount of tokens to add to the pool
     * @return new protected liquidity id
     */
    function addBaseTokenLiquidity(
        address _owner,
        IConverterAnchor _poolAnchor,
        IERC20 _baseToken,
        IERC20 _networkToken,
        uint256 _amount
    ) internal returns (uint256) {
        IDSToken poolToken = IDSToken(address(_poolAnchor));

        // get the reserve balances
        ILiquidityPoolConverter converter = ILiquidityPoolConverter(payable(ownedBy(_poolAnchor)));
        (uint256 reserveBalanceBase, uint256 reserveBalanceNetwork) =
            converterReserveBalances(converter, _baseToken, _networkToken);

        require(reserveBalanceNetwork >= settings.minNetworkTokenLiquidityForMinting(), "ERR_NOT_ENOUGH_LIQUIDITY");

        // calculate and mint the required amount of network tokens for adding liquidity
        uint256 newNetworkLiquidityAmount = _amount.mul(reserveBalanceNetwork).div(reserveBalanceBase);

        // verify network token minting limit
        uint256 mintingLimit = settings.networkTokenMintingLimits(_poolAnchor);
        if (mintingLimit == 0) {
            mintingLimit = settings.defaultNetworkTokenMintingLimit();
        }

        uint256 newNetworkTokensMinted = systemStore.networkTokensMinted(_poolAnchor).add(newNetworkLiquidityAmount);
        require(newNetworkTokensMinted <= mintingLimit, "ERR_MAX_AMOUNT_REACHED");

        // issue new network tokens to the system
        mintNetworkTokens(address(this), _poolAnchor, newNetworkLiquidityAmount);

        // transfer the base tokens from the caller and approve the converter
        ensureAllowance(_networkToken, address(converter), newNetworkLiquidityAmount);
        if (_baseToken != ETH_RESERVE_ADDRESS) {
            _baseToken.safeTransferFrom(msg.sender, address(this), _amount);
            ensureAllowance(_baseToken, address(converter), _amount);
        }

        // add liquidity
        addLiquidity(converter, _baseToken, _networkToken, _amount, newNetworkLiquidityAmount, msg.value);

        // transfer the new pool tokens to the wallet
        uint256 poolTokenAmount = poolToken.balanceOf(address(this));
        poolToken.safeTransfer(address(wallet), poolTokenAmount);

        // the system splits the pool tokens with the caller
        // increase the system's pool token balance and add protected liquidity for the caller
        systemStore.incSystemBalance(poolToken, poolTokenAmount - poolTokenAmount / 2); // account for rounding errors
        return addProtectedLiquidity(_owner, poolToken, _baseToken, poolTokenAmount / 2, _amount);
    }

    /**
     * @dev returns the single-side staking limits of a given pool
     *
     * @param _poolAnchor   anchor of the pool
     * @return maximum amount of base tokens that can be single-side staked in the pool
     * @return maximum amount of network tokens that can be single-side staked in the pool
     */
    function poolAvailableSpace(IConverterAnchor _poolAnchor)
        external
        view
        poolSupportedAndWhitelisted(_poolAnchor)
        returns (uint256, uint256)
    {
        IERC20 networkTokenLocal = networkToken;
        return (
            baseTokenAvailableSpace(_poolAnchor, networkTokenLocal),
            networkTokenAvailableSpace(_poolAnchor, networkTokenLocal)
        );
    }

    /**
     * @dev returns the base-token staking limits of a given pool
     *
     * @param _poolAnchor   anchor of the pool
     * @return maximum amount of base tokens that can be single-side staked in the pool
     */
    function baseTokenAvailableSpace(IConverterAnchor _poolAnchor)
        external
        view
        poolSupportedAndWhitelisted(_poolAnchor)
        returns (uint256)
    {
        return baseTokenAvailableSpace(_poolAnchor, networkToken);
    }

    /**
     * @dev returns the network-token staking limits of a given pool
     *
     * @param _poolAnchor   anchor of the pool
     * @return maximum amount of network tokens that can be single-side staked in the pool
     */
    function networkTokenAvailableSpace(IConverterAnchor _poolAnchor)
        external
        view
        poolSupportedAndWhitelisted(_poolAnchor)
        returns (uint256)
    {
        return networkTokenAvailableSpace(_poolAnchor, networkToken);
    }

    /**
     * @dev returns the base-token staking limits of a given pool
     *
     * @param _poolAnchor   anchor of the pool
     * @param _networkToken the network token
     * @return maximum amount of base tokens that can be single-side staked in the pool
     */
    function baseTokenAvailableSpace(IConverterAnchor _poolAnchor, IERC20 _networkToken)
        internal
        view
        returns (uint256)
    {
        // get the pool converter
        ILiquidityPoolConverter converter = ILiquidityPoolConverter(payable(ownedBy(_poolAnchor)));

        // get the base token
        IERC20 baseToken = converterOtherReserve(converter, _networkToken);

        // get the reserve balances
        (uint256 reserveBalanceBase, uint256 reserveBalanceNetwork) =
            converterReserveBalances(converter, baseToken, _networkToken);

        // get the network token minting limit
        uint256 mintingLimit = settings.networkTokenMintingLimits(_poolAnchor);
        if (mintingLimit == 0) {
            mintingLimit = settings.defaultNetworkTokenMintingLimit();
        }

        // get the amount of network tokens already minted for the pool
        uint256 networkTokensMinted = systemStore.networkTokensMinted(_poolAnchor);

        // get the amount of network tokens which can minted for the pool
        uint256 networkTokensCanBeMinted = MathEx.max(mintingLimit, networkTokensMinted) - networkTokensMinted;

        // return the maximum amount of base token liquidity that can be single-sided staked in the pool
        return networkTokensCanBeMinted.mul(reserveBalanceBase).div(reserveBalanceNetwork);
    }

    /**
     * @dev returns the network-token staking limits of a given pool
     *
     * @param _poolAnchor   anchor of the pool
     * @param _networkToken the network token
     * @return maximum amount of network tokens that can be single-side staked in the pool
     */
    function networkTokenAvailableSpace(IConverterAnchor _poolAnchor, IERC20 _networkToken)
        internal
        view
        returns (uint256)
    {
        // get the pool token
        IDSToken poolToken = IDSToken(address(_poolAnchor));

        // get the pool token rate
        Fraction memory poolRate = poolTokenRate(poolToken, _networkToken);

        // return the maximum amount of network token liquidity that can be single-sided staked in the pool
        return systemStore.systemBalance(poolToken).mul(poolRate.n).add(poolRate.n).sub(1).div(poolRate.d);
    }

    /**
     * @dev returns the expected/actual amounts the provider will receive for removing liquidity
     * it's also possible to provide the remove liquidity time to get an estimation
     * for the return at that given point
     *
     * @param _id              protected liquidity id
     * @param _portion         portion of liquidity to remove, in PPM
     * @param _removeTimestamp time at which the liquidity is removed
     * @return expected return amount in the reserve token
     * @return actual return amount in the reserve token
     * @return compensation in the network token
     */
    function removeLiquidityReturn(
        uint256 _id,
        uint32 _portion,
        uint256 _removeTimestamp
    )
        external
        view
        validPortion(_portion)
        returns (
            uint256,
            uint256,
            uint256
        )
    {
        ProtectedLiquidity memory liquidity = protectedLiquidity(_id);

        // verify input
        require(liquidity.provider != address(0), "ERR_INVALID_ID");
        require(_removeTimestamp >= liquidity.timestamp, "ERR_INVALID_TIMESTAMP");

        // calculate the portion of the liquidity to remove
        if (_portion != PPM_RESOLUTION) {
            liquidity.poolAmount = liquidity.poolAmount.mul(_portion) / PPM_RESOLUTION;
            liquidity.reserveAmount = liquidity.reserveAmount.mul(_portion) / PPM_RESOLUTION;
        }

        // get the various rates between the reserves upon adding liquidity and now
        PackedRates memory packedRates =
            packRates(
                liquidity.poolToken,
                liquidity.reserveToken,
                liquidity.reserveRateN,
                liquidity.reserveRateD,
                false
            );

        uint256 targetAmount =
            removeLiquidityTargetAmount(
                liquidity.poolToken,
                liquidity.reserveToken,
                liquidity.poolAmount,
                liquidity.reserveAmount,
                packedRates,
                liquidity.timestamp,
                _removeTimestamp
            );

        // for network token, the return amount is identical to the target amount
        if (liquidity.reserveToken == networkToken) {
            return (targetAmount, targetAmount, 0);
        }

        // handle base token return

        // calculate the amount of pool tokens required for liquidation
        // note that the amount is doubled since it's not possible to liquidate one reserve only
        Fraction memory poolRate = poolTokenRate(liquidity.poolToken, liquidity.reserveToken);
        uint256 poolAmount = targetAmount.mul(poolRate.d).div(poolRate.n / 2);

        // limit the amount of pool tokens by the amount the system/caller holds
        uint256 availableBalance = systemStore.systemBalance(liquidity.poolToken).add(liquidity.poolAmount);
        poolAmount = poolAmount > availableBalance ? availableBalance : poolAmount;

        // calculate the base token amount received by liquidating the pool tokens
        // note that the amount is divided by 2 since the pool amount represents both reserves
        uint256 baseAmount = poolAmount.mul(poolRate.n / 2).div(poolRate.d);
        uint256 networkAmount = getNetworkCompensation(targetAmount, baseAmount, packedRates);

        return (targetAmount, baseAmount, networkAmount);
    }

    /**
     * @dev removes protected liquidity from a pool
     * also burns governance tokens from the caller if the caller removes network tokens
     *
     * @param _id      id in the caller's list of protected liquidity
     * @param _portion portion of liquidity to remove, in PPM
     */
    function removeLiquidity(uint256 _id, uint32 _portion) external override protected validPortion(_portion) {
        removeLiquidity(msg.sender, _id, _portion);
    }

    /**
     * @dev removes protected liquidity from a pool
     * also burns governance tokens from the caller if the caller removes network tokens
     *
     * @param _provider protected liquidity provider
     * @param _id id in the caller's list of protected liquidity
     * @param _portion portion of liquidity to remove, in PPM
     */
    function removeLiquidity(
        address payable _provider,
        uint256 _id,
        uint32 _portion
    ) internal {
        ProtectedLiquidity memory liquidity = protectedLiquidity(_id, _provider);

        // save a local copy of `networkToken`
        IERC20 networkTokenLocal = networkToken;

        // verify that the pool is whitelisted
        _poolWhitelisted(liquidity.poolToken);

        // verify that the protected liquidity is not removed on the same block in which it was added
        require(liquidity.timestamp < time(), "ERR_TOO_EARLY");

        if (_portion == PPM_RESOLUTION) {
            // notify event subscribers
            notifyEventSubscribersOnRemovingLiquidity(
                _id,
                _provider,
                liquidity.poolToken,
                liquidity.reserveToken,
                liquidity.poolAmount,
                liquidity.reserveAmount
            );

            // remove the protected liquidity from the provider
            store.removeProtectedLiquidity(_id);
        } else {
            // remove a portion of the protected liquidity from the provider
            uint256 fullPoolAmount = liquidity.poolAmount;
            uint256 fullReserveAmount = liquidity.reserveAmount;
            liquidity.poolAmount = liquidity.poolAmount.mul(_portion) / PPM_RESOLUTION;
            liquidity.reserveAmount = liquidity.reserveAmount.mul(_portion) / PPM_RESOLUTION;

            // notify event subscribers
            notifyEventSubscribersOnRemovingLiquidity(
                _id,
                _provider,
                liquidity.poolToken,
                liquidity.reserveToken,
                liquidity.poolAmount,
                liquidity.reserveAmount
            );

            store.updateProtectedLiquidityAmounts(
                _id,
                fullPoolAmount - liquidity.poolAmount,
                fullReserveAmount - liquidity.reserveAmount
            );
        }

        // update the statistics
        stats.decreaseTotalAmounts(
            liquidity.provider,
            liquidity.poolToken,
            liquidity.reserveToken,
            liquidity.poolAmount,
            liquidity.reserveAmount
        );

        // update last liquidity removal checkpoint
        lastRemoveCheckpointStore.addCheckpoint(_provider);

        // add the pool tokens to the system
        systemStore.incSystemBalance(liquidity.poolToken, liquidity.poolAmount);

        // if removing network token liquidity, burn the governance tokens from the caller. we need to transfer the
        // tokens to the contract itself, since only token holders can burn their tokens
        if (liquidity.reserveToken == networkTokenLocal) {
            govToken.safeTransferFrom(_provider, address(this), liquidity.reserveAmount);
            govTokenGovernance.burn(liquidity.reserveAmount);
        }

        // get the various rates between the reserves upon adding liquidity and now
        PackedRates memory packedRates =
            packRates(
                liquidity.poolToken,
                liquidity.reserveToken,
                liquidity.reserveRateN,
                liquidity.reserveRateD,
                true
            );

        // get the target token amount
        uint256 targetAmount =
            removeLiquidityTargetAmount(
                liquidity.poolToken,
                liquidity.reserveToken,
                liquidity.poolAmount,
                liquidity.reserveAmount,
                packedRates,
                liquidity.timestamp,
                time()
            );

        // remove network token liquidity
        if (liquidity.reserveToken == networkTokenLocal) {
            // mint network tokens for the caller and lock them
            mintNetworkTokens(address(wallet), liquidity.poolToken, targetAmount);
            lockTokens(_provider, targetAmount);
            return;
        }

        // remove base token liquidity

        // calculate the amount of pool tokens required for liquidation
        // note that the amount is doubled since it's not possible to liquidate one reserve only
        Fraction memory poolRate = poolTokenRate(liquidity.poolToken, liquidity.reserveToken);
        uint256 poolAmount = targetAmount.mul(poolRate.d).div(poolRate.n / 2);

        // limit the amount of pool tokens by the amount the system holds
        uint256 systemBalance = systemStore.systemBalance(liquidity.poolToken);
        poolAmount = poolAmount > systemBalance ? systemBalance : poolAmount;

        // withdraw the pool tokens from the wallet
        systemStore.decSystemBalance(liquidity.poolToken, poolAmount);
        wallet.withdrawTokens(liquidity.poolToken, address(this), poolAmount);

        // remove liquidity
        removeLiquidity(liquidity.poolToken, poolAmount, liquidity.reserveToken, networkTokenLocal);

        // transfer the base tokens to the caller
        uint256 baseBalance;
        if (liquidity.reserveToken == ETH_RESERVE_ADDRESS) {
            baseBalance = address(this).balance;
            _provider.transfer(baseBalance);
        } else {
            baseBalance = liquidity.reserveToken.balanceOf(address(this));
            liquidity.reserveToken.safeTransfer(_provider, baseBalance);
        }

        // compensate the caller with network tokens if still needed
        uint256 delta = getNetworkCompensation(targetAmount, baseBalance, packedRates);
        if (delta > 0) {
            // check if there's enough network token balance, otherwise mint more
            uint256 networkBalance = networkTokenLocal.balanceOf(address(this));
            if (networkBalance < delta) {
                networkTokenGovernance.mint(address(this), delta - networkBalance);
            }

            // lock network tokens for the caller
            networkTokenLocal.safeTransfer(address(wallet), delta);
            lockTokens(_provider, delta);
        }

        // if the contract still holds network tokens, burn them
        uint256 networkBalance = networkTokenLocal.balanceOf(address(this));
        if (networkBalance > 0) {
            burnNetworkTokens(liquidity.poolToken, networkBalance);
        }
    }

    /**
     * @dev returns the amount the provider will receive for removing liquidity
     * it's also possible to provide the remove liquidity rate & time to get an estimation
     * for the return at that given point
     *
     * @param _poolToken       pool token
     * @param _reserveToken    reserve token
     * @param _poolAmount      pool token amount when the liquidity was added
     * @param _reserveAmount   reserve token amount that was added
     * @param _packedRates     see `struct PackedRates`
     * @param _addTimestamp    time at which the liquidity was added
     * @param _removeTimestamp time at which the liquidity is removed
     * @return amount received for removing liquidity
     */
    function removeLiquidityTargetAmount(
        IDSToken _poolToken,
        IERC20 _reserveToken,
        uint256 _poolAmount,
        uint256 _reserveAmount,
        PackedRates memory _packedRates,
        uint256 _addTimestamp,
        uint256 _removeTimestamp
    ) internal view returns (uint256) {
        // get the rate between the pool token and the reserve token
        Fraction memory poolRate = poolTokenRate(_poolToken, _reserveToken);

        // get the rate between the reserves upon adding liquidity and now
        Fraction memory addSpotRate = Fraction({ n: _packedRates.addSpotRateN, d: _packedRates.addSpotRateD });
        Fraction memory removeSpotRate = Fraction({ n: _packedRates.removeSpotRateN, d: _packedRates.removeSpotRateD });
        Fraction memory removeAverageRate =
            Fraction({ n: _packedRates.removeAverageRateN, d: _packedRates.removeAverageRateD });

        // calculate the protected amount of reserve tokens plus accumulated fee before compensation
        uint256 total = protectedAmountPlusFee(_poolAmount, poolRate, addSpotRate, removeSpotRate);

        // calculate the impermanent loss
        Fraction memory loss = impLoss(addSpotRate, removeAverageRate);

        // calculate the protection level
        Fraction memory level = protectionLevel(_addTimestamp, _removeTimestamp);

        // calculate the compensation amount
        return compensationAmount(_reserveAmount, MathEx.max(_reserveAmount, total), loss, level);
    }

    /**
     * @dev allows the caller to claim network token balance that is no longer locked
     * note that the function can revert if the range is too large
     *
     * @param _startIndex  start index in the caller's list of locked balances
     * @param _endIndex    end index in the caller's list of locked balances (exclusive)
     */
    function claimBalance(uint256 _startIndex, uint256 _endIndex) external protected {
        // get the locked balances from the store
        (uint256[] memory amounts, uint256[] memory expirationTimes) =
            store.lockedBalanceRange(msg.sender, _startIndex, _endIndex);

        uint256 totalAmount = 0;
        uint256 length = amounts.length;
        assert(length == expirationTimes.length);

        // reverse iteration since we're removing from the list
        for (uint256 i = length; i > 0; i--) {
            uint256 index = i - 1;
            if (expirationTimes[index] > time()) {
                continue;
            }

            // remove the locked balance item
            store.removeLockedBalance(msg.sender, _startIndex + index);
            totalAmount = totalAmount.add(amounts[index]);
        }

        if (totalAmount > 0) {
            // transfer the tokens to the caller in a single call
            wallet.withdrawTokens(networkToken, msg.sender, totalAmount);
        }
    }

    /**
     * @dev returns the ROI for removing liquidity in the current state after providing liquidity with the given args
     * the function assumes full protection is in effect
     * return value is in PPM and can be larger than PPM_RESOLUTION for positive ROI, 1M = 0% ROI
     *
     * @param _poolToken       pool token
     * @param _reserveToken    reserve token
     * @param _reserveAmount   reserve token amount that was added
     * @param _poolRateN       rate of 1 pool token in reserve token units when the liquidity was added (numerator)
     * @param _poolRateD       rate of 1 pool token in reserve token units when the liquidity was added (denominator)
     * @param _reserveRateN    rate of 1 reserve token in the other reserve token units when the liquidity was added (numerator)
     * @param _reserveRateD    rate of 1 reserve token in the other reserve token units when the liquidity was added (denominator)
     * @return ROI in PPM
     */
    function poolROI(
        IDSToken _poolToken,
        IERC20 _reserveToken,
        uint256 _reserveAmount,
        uint256 _poolRateN,
        uint256 _poolRateD,
        uint256 _reserveRateN,
        uint256 _reserveRateD
    ) external view returns (uint256) {
        // calculate the amount of pool tokens based on the amount of reserve tokens
        uint256 poolAmount = _reserveAmount.mul(_poolRateD).div(_poolRateN);

        // get the various rates between the reserves upon adding liquidity and now
        PackedRates memory packedRates = packRates(_poolToken, _reserveToken, _reserveRateN, _reserveRateD, false);

        // get the current return
        uint256 protectedReturn =
            removeLiquidityTargetAmount(
                _poolToken,
                _reserveToken,
                poolAmount,
                _reserveAmount,
                packedRates,
                time().sub(settings.maxProtectionDelay()),
                time()
            );

        // calculate the ROI as the ratio between the current fully protected return and the initial amount
        return protectedReturn.mul(PPM_RESOLUTION).div(_reserveAmount);
    }

    /**
     * @dev adds protected liquidity for the caller to the store
     *
     * @param _provider        protected liquidity provider
     * @param _poolToken       pool token
     * @param _reserveToken    reserve token
     * @param _poolAmount      amount of pool tokens to protect
     * @param _reserveAmount   amount of reserve tokens to protect
     * @return new protected liquidity id
     */
    function addProtectedLiquidity(
        address _provider,
        IDSToken _poolToken,
        IERC20 _reserveToken,
        uint256 _poolAmount,
        uint256 _reserveAmount
    ) internal returns (uint256) {
        // notify event subscribers
        address[] memory subscribers = settings.subscribers();
        uint256 length = subscribers.length;
        for (uint256 i = 0; i < length; i++) {
            ILiquidityProtectionEventsSubscriber(subscribers[i]).onAddingLiquidity(
                _provider,
                _poolToken,
                _reserveToken,
                _poolAmount,
                _reserveAmount
            );
        }

        ILiquidityPoolConverter converter = ILiquidityPoolConverter(payable(ownedBy(_poolToken)));
        IERC20 otherReserve = converterOtherReserve(converter, _reserveToken);
        (uint256 rateN, uint256 rateD) = converterReserveBalances(converter, otherReserve, _reserveToken);

        stats.increaseTotalAmounts(_provider, _poolToken, _reserveToken, _poolAmount, _reserveAmount);
        stats.addProviderPool(_provider, _poolToken);
        return
            store.addProtectedLiquidity(
                _provider,
                _poolToken,
                _reserveToken,
                _poolAmount,
                _reserveAmount,
                rateN,
                rateD,
                time()
            );
    }

    /**
     * @dev locks network tokens for the provider and emits the tokens locked event
     *
     * @param _provider    tokens provider
     * @param _amount      amount of network tokens
     */
    function lockTokens(address _provider, uint256 _amount) internal {
        uint256 expirationTime = time().add(settings.lockDuration());
        store.addLockedBalance(_provider, _amount, expirationTime);
    }

    /**
     * @dev returns the rate of 1 pool token in reserve token units
     *
     * @param _poolToken       pool token
     * @param _reserveToken    reserve token
     */
    function poolTokenRate(IDSToken _poolToken, IERC20 _reserveToken) internal view virtual returns (Fraction memory) {
        // get the pool token supply
        uint256 poolTokenSupply = _poolToken.totalSupply();

        // get the reserve balance
        IConverter converter = IConverter(payable(ownedBy(_poolToken)));
        uint256 reserveBalance = converter.getConnectorBalance(_reserveToken);

        // for standard pools, 50% of the pool supply value equals the value of each reserve
        return Fraction({ n: reserveBalance.mul(2), d: poolTokenSupply });
    }

    /**
     * @dev returns the spot rate and average rate of 1 reserve token in the other reserve token units
     *
     * @param _poolToken            pool token
     * @param _reserveToken         reserve token
     * @param _validateAverageRate  true to validate the average rate; false otherwise
     */
    function reserveTokenRates(
        IDSToken _poolToken,
        IERC20 _reserveToken,
        bool _validateAverageRate
    )
        internal
        view
        returns (
            uint256,
            uint256,
            uint256,
            uint256
        )
    {
        ILiquidityPoolConverter converter = ILiquidityPoolConverter(payable(ownedBy(_poolToken)));
        IERC20 otherReserve = converterOtherReserve(converter, _reserveToken);

        (uint256 spotRateN, uint256 spotRateD) = converterReserveBalances(converter, otherReserve, _reserveToken);
        (uint256 averageRateN, uint256 averageRateD) = converter.recentAverageRate(_reserveToken);

        require(
            !_validateAverageRate ||
                averageRateInRange(
                    spotRateN,
                    spotRateD,
                    averageRateN,
                    averageRateD,
                    settings.averageRateMaxDeviation()
                ),
            "ERR_INVALID_RATE"
        );

        return (spotRateN, spotRateD, averageRateN, averageRateD);
    }

    /**
     * @dev returns the various rates between the reserves
     *
     * @param _poolToken            pool token
     * @param _reserveToken         reserve token
     * @param _addSpotRateN         add spot rate numerator
     * @param _addSpotRateD         add spot rate denominator
     * @param _validateAverageRate  true to validate the average rate; false otherwise
     * @return see `struct PackedRates`
     */
    function packRates(
        IDSToken _poolToken,
        IERC20 _reserveToken,
        uint256 _addSpotRateN,
        uint256 _addSpotRateD,
        bool _validateAverageRate
    ) internal view returns (PackedRates memory) {
        (uint256 removeSpotRateN, uint256 removeSpotRateD, uint256 removeAverageRateN, uint256 removeAverageRateD) =
            reserveTokenRates(_poolToken, _reserveToken, _validateAverageRate);

        require(
            (_addSpotRateN <= MAX_UINT128 && _addSpotRateD <= MAX_UINT128) &&
                (removeSpotRateN <= MAX_UINT128 && removeSpotRateD <= MAX_UINT128) &&
                (removeAverageRateN <= MAX_UINT128 && removeAverageRateD <= MAX_UINT128),
            "ERR_INVALID_RATE"
        );

        return
            PackedRates({
                addSpotRateN: uint128(_addSpotRateN),
                addSpotRateD: uint128(_addSpotRateD),
                removeSpotRateN: uint128(removeSpotRateN),
                removeSpotRateD: uint128(removeSpotRateD),
                removeAverageRateN: uint128(removeAverageRateN),
                removeAverageRateD: uint128(removeAverageRateD)
            });
    }

    /**
     * @dev returns whether or not the deviation of the average rate from the spot rate is within range
     * for example, if the maximum permitted deviation is 5%, then return `95/100 <= average/spot <= 100/95`
     *
     * @param _spotRateN       spot rate numerator
     * @param _spotRateD       spot rate denominator
     * @param _averageRateN    average rate numerator
     * @param _averageRateD    average rate denominator
     * @param _maxDeviation    the maximum permitted deviation of the average rate from the spot rate
     */
    function averageRateInRange(
        uint256 _spotRateN,
        uint256 _spotRateD,
        uint256 _averageRateN,
        uint256 _averageRateD,
        uint32 _maxDeviation
    ) internal pure returns (bool) {
        uint256 ppmDelta = PPM_RESOLUTION - _maxDeviation;
        uint256 min = _spotRateN.mul(_averageRateD).mul(ppmDelta).mul(ppmDelta);
        uint256 mid = _spotRateD.mul(_averageRateN).mul(ppmDelta).mul(PPM_RESOLUTION);
        uint256 max = _spotRateN.mul(_averageRateD).mul(PPM_RESOLUTION).mul(PPM_RESOLUTION);
        return min <= mid && mid <= max;
    }

    /**
     * @dev utility to add liquidity to a converter
     *
     * @param _converter       converter
     * @param _reserveToken1   reserve token 1
     * @param _reserveToken2   reserve token 2
     * @param _reserveAmount1  reserve amount 1
     * @param _reserveAmount2  reserve amount 2
     * @param _value           ETH amount to add
     */
    function addLiquidity(
        ILiquidityPoolConverter _converter,
        IERC20 _reserveToken1,
        IERC20 _reserveToken2,
        uint256 _reserveAmount1,
        uint256 _reserveAmount2,
        uint256 _value
    ) internal {
        // ensure that the contract can receive ETH
        updatingLiquidity = true;

        IERC20[] memory reserveTokens = new IERC20[](2);
        uint256[] memory amounts = new uint256[](2);
        reserveTokens[0] = _reserveToken1;
        reserveTokens[1] = _reserveToken2;
        amounts[0] = _reserveAmount1;
        amounts[1] = _reserveAmount2;
        _converter.addLiquidity{ value: _value }(reserveTokens, amounts, 1);

        // ensure that the contract can receive ETH
        updatingLiquidity = false;
    }

    /**
     * @dev utility to remove liquidity from a converter
     *
     * @param _poolToken       pool token of the converter
     * @param _poolAmount      amount of pool tokens to remove
     * @param _reserveToken1   reserve token 1
     * @param _reserveToken2   reserve token 2
     */
    function removeLiquidity(
        IDSToken _poolToken,
        uint256 _poolAmount,
        IERC20 _reserveToken1,
        IERC20 _reserveToken2
    ) internal {
        ILiquidityPoolConverter converter = ILiquidityPoolConverter(payable(ownedBy(_poolToken)));

        // ensure that the contract can receive ETH
        updatingLiquidity = true;

        IERC20[] memory reserveTokens = new IERC20[](2);
        uint256[] memory minReturns = new uint256[](2);
        reserveTokens[0] = _reserveToken1;
        reserveTokens[1] = _reserveToken2;
        minReturns[0] = 1;
        minReturns[1] = 1;
        converter.removeLiquidity(_poolAmount, reserveTokens, minReturns);

        // ensure that the contract can receive ETH
        updatingLiquidity = false;
    }

    /**
     * @dev returns a protected liquidity from the store
     *
     * @param _id  protected liquidity id
     * @return protected liquidity
     */
    function protectedLiquidity(uint256 _id) internal view returns (ProtectedLiquidity memory) {
        ProtectedLiquidity memory liquidity;
        (
            liquidity.provider,
            liquidity.poolToken,
            liquidity.reserveToken,
            liquidity.poolAmount,
            liquidity.reserveAmount,
            liquidity.reserveRateN,
            liquidity.reserveRateD,
            liquidity.timestamp
        ) = store.protectedLiquidity(_id);

        return liquidity;
    }

    /**
     * @dev returns a protected liquidity from the store
     *
     * @param _id          protected liquidity id
     * @param _provider    authorized provider
     * @return protected liquidity
     */
    function protectedLiquidity(uint256 _id, address _provider) internal view returns (ProtectedLiquidity memory) {
        ProtectedLiquidity memory liquidity = protectedLiquidity(_id);
        require(liquidity.provider == _provider, "ERR_ACCESS_DENIED");
        return liquidity;
    }

    /**
     * @dev returns the protected amount of reserve tokens plus accumulated fee before compensation
     *
     * @param _poolAmount      pool token amount when the liquidity was added
     * @param _poolRate        rate of 1 pool token in the related reserve token units
     * @param _addRate         rate of 1 reserve token in the other reserve token units when the liquidity was added
     * @param _removeRate      rate of 1 reserve token in the other reserve token units when the liquidity is removed
     * @return protected amount of reserve tokens plus accumulated fee = sqrt(_removeRate / _addRate) * _poolRate * _poolAmount
     */
    function protectedAmountPlusFee(
        uint256 _poolAmount,
        Fraction memory _poolRate,
        Fraction memory _addRate,
        Fraction memory _removeRate
    ) internal pure returns (uint256) {
        uint256 n = MathEx.ceilSqrt(_addRate.d.mul(_removeRate.n)).mul(_poolRate.n);
        uint256 d = MathEx.floorSqrt(_addRate.n.mul(_removeRate.d)).mul(_poolRate.d);

        uint256 x = n * _poolAmount;
        if (x / n == _poolAmount) {
            return x / d;
        }

        (uint256 hi, uint256 lo) = n > _poolAmount ? (n, _poolAmount) : (_poolAmount, n);
        (uint256 p, uint256 q) = MathEx.reducedRatio(hi, d, MAX_UINT256 / lo);
        uint256 min = (hi / d).mul(lo);

        if (q > 0) {
            return MathEx.max(min, (p * lo) / q);
        }
        return min;
    }

    /**
     * @dev returns the impermanent loss incurred due to the change in rates between the reserve tokens
     *
     * @param _prevRate    previous rate between the reserves
     * @param _newRate     new rate between the reserves
     * @return impermanent loss (as a ratio)
     */
    function impLoss(Fraction memory _prevRate, Fraction memory _newRate) internal pure returns (Fraction memory) {
        uint256 ratioN = _newRate.n.mul(_prevRate.d);
        uint256 ratioD = _newRate.d.mul(_prevRate.n);

        uint256 prod = ratioN * ratioD;
        uint256 root =
            prod / ratioN == ratioD ? MathEx.floorSqrt(prod) : MathEx.floorSqrt(ratioN) * MathEx.floorSqrt(ratioD);
        uint256 sum = ratioN.add(ratioD);

        // the arithmetic below is safe because `x + y >= sqrt(x * y) * 2`
        if (sum % 2 == 0) {
            sum /= 2;
            return Fraction({ n: sum - root, d: sum });
        }
        return Fraction({ n: sum - root * 2, d: sum });
    }

    /**
     * @dev returns the protection level based on the timestamp and protection delays
     *
     * @param _addTimestamp    time at which the liquidity was added
     * @param _removeTimestamp time at which the liquidity is removed
     * @return protection level (as a ratio)
     */
    function protectionLevel(uint256 _addTimestamp, uint256 _removeTimestamp) internal view returns (Fraction memory) {
        uint256 timeElapsed = _removeTimestamp.sub(_addTimestamp);
        uint256 minProtectionDelay = settings.minProtectionDelay();
        uint256 maxProtectionDelay = settings.maxProtectionDelay();
        if (timeElapsed < minProtectionDelay) {
            return Fraction({ n: 0, d: 1 });
        }

        if (timeElapsed >= maxProtectionDelay) {
            return Fraction({ n: 1, d: 1 });
        }

        return Fraction({ n: timeElapsed, d: maxProtectionDelay });
    }

    /**
     * @dev returns the compensation amount based on the impermanent loss and the protection level
     *
     * @param _amount  protected amount in units of the reserve token
     * @param _total   amount plus fee in units of the reserve token
     * @param _loss    protection level (as a ratio between 0 and 1)
     * @param _level   impermanent loss (as a ratio between 0 and 1)
     * @return compensation amount
     */
    function compensationAmount(
        uint256 _amount,
        uint256 _total,
        Fraction memory _loss,
        Fraction memory _level
    ) internal pure returns (uint256) {
        uint256 levelN = _level.n.mul(_amount);
        uint256 levelD = _level.d;
        uint256 maxVal = MathEx.max(MathEx.max(levelN, levelD), _total);
        (uint256 lossN, uint256 lossD) = MathEx.reducedRatio(_loss.n, _loss.d, MAX_UINT256 / maxVal);
        return _total.mul(lossD.sub(lossN)).div(lossD).add(lossN.mul(levelN).div(lossD.mul(levelD)));
    }

    function getNetworkCompensation(
        uint256 _targetAmount,
        uint256 _baseAmount,
        PackedRates memory _packedRates
    ) internal view returns (uint256) {
        if (_targetAmount <= _baseAmount) {
            return 0;
        }

        // calculate the delta in network tokens
        uint256 delta =
            (_targetAmount - _baseAmount).mul(_packedRates.removeAverageRateN).div(_packedRates.removeAverageRateD);

        // the delta might be very small due to precision loss
        // in which case no compensation will take place (gas optimization)
        if (delta >= settings.minNetworkCompensation()) {
            return delta;
        }

        return 0;
    }

    /**
     * @dev utility, checks whether allowance for the given spender exists and approves one if it doesn't.
     * note that we use the non standard erc-20 interface in which `approve` has no return value so that
     * this function will work for both standard and non standard tokens
     *
     * @param _token   token to check the allowance in
     * @param _spender approved address
     * @param _value   allowance amount
     */
    function ensureAllowance(
        IERC20 _token,
        address _spender,
        uint256 _value
    ) private {
        uint256 allowance = _token.allowance(address(this), _spender);
        if (allowance < _value) {
            if (allowance > 0) {
                _token.safeApprove(_spender, 0);
            }
            _token.safeApprove(_spender, _value);
        }
    }

    // utility to mint network tokens
    function mintNetworkTokens(
        address _owner,
        IConverterAnchor _poolAnchor,
        uint256 _amount
    ) private {
        networkTokenGovernance.mint(_owner, _amount);
        systemStore.incNetworkTokensMinted(_poolAnchor, _amount);
    }

    // utility to burn network tokens
    function burnNetworkTokens(IConverterAnchor _poolAnchor, uint256 _amount) private {
        networkTokenGovernance.burn(_amount);
        systemStore.decNetworkTokensMinted(_poolAnchor, _amount);
    }

    // utility to notify event subscribers on removing liquidity
    function notifyEventSubscribersOnRemovingLiquidity(
        uint256 _id,
        address _provider,
        IDSToken _poolToken,
        IERC20 _reserveToken,
        uint256 _poolAmount,
        uint256 _reserveAmount
    ) private {
        address[] memory subscribers = settings.subscribers();
        uint256 length = subscribers.length;
        for (uint256 i = 0; i < length; i++) {
            ILiquidityProtectionEventsSubscriber(subscribers[i]).onRemovingLiquidity(
                _id,
                _provider,
                _poolToken,
                _reserveToken,
                _poolAmount,
                _reserveAmount
            );
        }
    }

    // utility to get the reserve balances
    function converterReserveBalances(
        IConverter _converter,
        IERC20 _reserveToken1,
        IERC20 _reserveToken2
    ) private view returns (uint256, uint256) {
        return (_converter.getConnectorBalance(_reserveToken1), _converter.getConnectorBalance(_reserveToken2));
    }

    // utility to get the other reserve
    function converterOtherReserve(IConverter _converter, IERC20 _thisReserve) private view returns (IERC20) {
        IERC20 otherReserve = _converter.connectorTokens(0);
        return otherReserve != _thisReserve ? otherReserve : _converter.connectorTokens(1);
    }

    // utility to get the owner
    function ownedBy(IOwned _owned) private view returns (address) {
        return _owned.owner();
    }
}
