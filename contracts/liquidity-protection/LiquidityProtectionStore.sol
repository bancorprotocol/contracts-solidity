// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";

import "./interfaces/ILiquidityProtectionStore.sol";

import "../token/ReserveToken.sol";

import "../utility/Owned.sol";
import "../utility/Utils.sol";

/**
 * @dev This contract serves as the storage of the liquidity protection mechanism.
 *
 * It holds the data and tokens, and it is generally non-upgradable.
 */
contract LiquidityProtectionStore is ILiquidityProtectionStore, Owned, Utils {
    using SafeMath for uint256;
    using ReserveToken for IReserveToken;

    struct ProtectedLiquidity {
        address provider; // liquidity provider
        uint256 index; // index in the provider liquidity ids array
        IDSToken poolToken; // pool token address
        IReserveToken reserveToken; // reserve token address
        uint256 poolAmount; // pool token amount
        uint256 reserveAmount; // reserve token amount
        uint256 reserveRateN; // rate of 1 protected reserve token in units of the other reserve token (numerator)
        uint256 reserveRateD; // rate of 1 protected reserve token in units of the other reserve token (denominator)
        uint256 timestamp; // timestamp
    }

    struct LockedBalance {
        uint256 amount; // amount of network tokens
        uint256 expirationTime; // lock expiration time
    }

    // protected liquidity by provider
    uint256 private _nextProtectedLiquidityId;
    mapping(address => uint256[]) private _protectedLiquidityIdsByProvider;
    mapping(uint256 => ProtectedLiquidity) private _protectedLiquidities;

    // user locked network token balances
    mapping(address => LockedBalance[]) private _lockedBalances;

    // system balances
    mapping(IReserveToken => uint256) private _systemBalances;

    // total protected pool supplies / reserve amounts
    mapping(IDSToken => uint256) private _totalProtectedPoolAmounts;
    mapping(IDSToken => mapping(IReserveToken => uint256)) private _totalProtectedReserveAmounts;

    /**
     * @dev triggered when liquidity protection is added
     *
     * @param provider liquidity provider
     * @param poolToken pool token address
     * @param reserveToken reserve token address
     * @param poolAmount amount of pool tokens
     * @param reserveAmount amount of reserve tokens
     */
    event ProtectionAdded(
        address indexed provider,
        IDSToken indexed poolToken,
        IReserveToken indexed reserveToken,
        uint256 poolAmount,
        uint256 reserveAmount
    );

    /**
     * @dev triggered when liquidity protection is updated
     *
     * @param provider liquidity provider
     * @param prevPoolAmount previous amount of pool tokens
     * @param prevReserveAmount previous amount of reserve tokens
     * @param newPoolAmount new amount of pool tokens
     * @param newReserveAmount new amount of reserve tokens
     */
    event ProtectionUpdated(
        address indexed provider,
        uint256 prevPoolAmount,
        uint256 prevReserveAmount,
        uint256 newPoolAmount,
        uint256 newReserveAmount
    );

    /**
     * @dev triggered when liquidity protection is removed
     *
     * @param provider liquidity provider
     * @param poolToken pool token address
     * @param reserveToken reserve token address
     * @param poolAmount amount of pool tokens
     * @param reserveAmount amount of reserve tokens
     */
    event ProtectionRemoved(
        address indexed provider,
        IDSToken indexed poolToken,
        IReserveToken indexed reserveToken,
        uint256 poolAmount,
        uint256 reserveAmount
    );

    /**
     * @dev triggered when network tokens are locked
     *
     * @param provider provider of the network tokens
     * @param amount amount of network tokens
     * @param expirationTime lock expiration time
     */
    event BalanceLocked(address indexed provider, uint256 amount, uint256 expirationTime);

    /**
     * @dev triggered when network tokens are unlocked
     *
     * @param provider provider of the network tokens
     * @param amount amount of network tokens
     */
    event BalanceUnlocked(address indexed provider, uint256 amount);

    /**
     * @dev triggered when the system balance for a given token is updated
     *
     * @param token token address
     * @param prevAmount previous amount
     * @param newAmount new amount
     */
    event SystemBalanceUpdated(IReserveToken token, uint256 prevAmount, uint256 newAmount);

    /**
     * @dev withdraws tokens held by the contract
     * can only be called by the contract owner
     *
     * @param token token address
     * @param recipient recipient address
     * @param amount amount to withdraw
     */
    function withdrawTokens(
        IReserveToken token,
        address recipient,
        uint256 amount
    ) external override ownerOnly validExternalAddress(recipient) {
        token.safeTransfer(recipient, amount);
    }

    /**
     * @dev returns the number of protected liquidities for the given provider
     *
     * @param provider liquidity provider
     *
     * @return number of protected liquidities
     */
    function protectedLiquidityCount(address provider) external view returns (uint256) {
        return _protectedLiquidityIdsByProvider[provider].length;
    }

    /**
     * @dev returns the list of protected liquidity ids for the given provider
     *
     * @param provider liquidity provider
     *
     * @return protected liquidity ids
     */
    function protectedLiquidityIds(address provider) external view returns (uint256[] memory) {
        return _protectedLiquidityIdsByProvider[provider];
    }

    /**
     * @dev returns the id of a protected liquidity for the given provider at a specific index
     *
     * @param provider liquidity provider
     * @param index protected liquidity index
     *
     * @return protected liquidity id
     */
    function protectedLiquidityId(address provider, uint256 index) external view returns (uint256) {
        return _protectedLiquidityIdsByProvider[provider][index];
    }

    /**
     * @dev returns an existing protected liquidity details
     *
     * @param id protected liquidity id
     *
     * @return liquidity provider
     * @return pool token address
     * @return reserve token address
     * @return pool token amount
     * @return reserve token amount
     * @return rate of 1 protected reserve token in units of the other reserve token (numerator)
     * @return rate of 1 protected reserve token in units of the other reserve token (denominator)
     * @return timestamp
     */
    function protectedLiquidity(uint256 id)
        external
        view
        override
        returns (
            address,
            IDSToken,
            IReserveToken,
            uint256,
            uint256,
            uint256,
            uint256,
            uint256
        )
    {
        ProtectedLiquidity memory liquidity = _protectedLiquidities[id];

        return (
            liquidity.provider,
            liquidity.poolToken,
            liquidity.reserveToken,
            liquidity.poolAmount,
            liquidity.reserveAmount,
            liquidity.reserveRateN,
            liquidity.reserveRateD,
            liquidity.timestamp
        );
    }

    /**
     * @dev adds protected liquidity
     * can only be called by the contract owner
     *
     * @param provider liquidity provider
     * @param poolToken pool token address
     * @param reserveToken reserve token address
     * @param poolAmount pool token amount
     * @param reserveAmount reserve token amount
     * @param reserveRateN rate of 1 protected reserve token in units of the other reserve token (numerator)
     * @param reserveRateD rate of 1 protected reserve token in units of the other reserve token (denominator)
     * @param timestamp timestamp
     *
     * @return new protected liquidity id
     */
    function addProtectedLiquidity(
        address provider,
        IDSToken poolToken,
        IReserveToken reserveToken,
        uint256 poolAmount,
        uint256 reserveAmount,
        uint256 reserveRateN,
        uint256 reserveRateD,
        uint256 timestamp
    ) external override ownerOnly returns (uint256) {
        // validate input
        require(
            provider != address(0) &&
                provider != address(this) &&
                address(poolToken) != address(0) &&
                address(poolToken) != address(this) &&
                address(reserveToken) != address(0) &&
                address(reserveToken) != address(this),
            "ERR_INVALID_ADDRESS"
        );
        require(
            poolAmount > 0 && reserveAmount > 0 && reserveRateN > 0 && reserveRateD > 0 && timestamp > 0,
            "ERR_ZERO_VALUE"
        );

        // add the protected liquidity
        uint256[] storage ids = _protectedLiquidityIdsByProvider[provider];
        uint256 id = _nextProtectedLiquidityId;
        _nextProtectedLiquidityId += 1;

        _protectedLiquidities[id] = ProtectedLiquidity({
            provider: provider,
            index: ids.length,
            poolToken: poolToken,
            reserveToken: reserveToken,
            poolAmount: poolAmount,
            reserveAmount: reserveAmount,
            reserveRateN: reserveRateN,
            reserveRateD: reserveRateD,
            timestamp: timestamp
        });

        ids.push(id);

        // update the total amounts
        _totalProtectedPoolAmounts[poolToken] = _totalProtectedPoolAmounts[poolToken].add(poolAmount);
        _totalProtectedReserveAmounts[poolToken][reserveToken] = _totalProtectedReserveAmounts[poolToken][reserveToken]
            .add(reserveAmount);

        emit ProtectionAdded(provider, poolToken, reserveToken, poolAmount, reserveAmount);

        return id;
    }

    /**
     * @dev updates an existing protected liquidity pool/reserve amounts
     * can only be called by the contract owner
     *
     * @param id protected liquidity id
     * @param newPoolAmount new pool tokens amount
     * @param newReserveAmount new reserve tokens amount
     */
    function updateProtectedLiquidityAmounts(
        uint256 id,
        uint256 newPoolAmount,
        uint256 newReserveAmount
    ) external override ownerOnly greaterThanZero(newPoolAmount) greaterThanZero(newReserveAmount) {
        // update the protected liquidity
        ProtectedLiquidity storage liquidity = _protectedLiquidities[id];

        // validate input
        address provider = liquidity.provider;
        require(provider != address(0), "ERR_INVALID_ID");

        IDSToken poolToken = liquidity.poolToken;
        IReserveToken reserveToken = liquidity.reserveToken;
        uint256 prevPoolAmount = liquidity.poolAmount;
        uint256 prevReserveAmount = liquidity.reserveAmount;
        liquidity.poolAmount = newPoolAmount;
        liquidity.reserveAmount = newReserveAmount;

        // update the total amounts
        _totalProtectedPoolAmounts[poolToken] = _totalProtectedPoolAmounts[poolToken].add(newPoolAmount).sub(
            prevPoolAmount
        );
        _totalProtectedReserveAmounts[poolToken][reserveToken] = _totalProtectedReserveAmounts[poolToken][reserveToken]
            .add(newReserveAmount)
            .sub(prevReserveAmount);

        emit ProtectionUpdated(provider, prevPoolAmount, prevReserveAmount, newPoolAmount, newReserveAmount);
    }

    /**
     * @dev removes protected liquidity
     * can only be called by the contract owner
     *
     * @param id protected liquidity id
     */
    function removeProtectedLiquidity(uint256 id) external override ownerOnly {
        // remove the protected liquidity
        ProtectedLiquidity storage liquidity = _protectedLiquidities[id];

        // validate input
        address provider = liquidity.provider;
        require(provider != address(0), "ERR_INVALID_ID");

        uint256 index = liquidity.index;
        IDSToken poolToken = liquidity.poolToken;
        IReserveToken reserveToken = liquidity.reserveToken;
        uint256 poolAmount = liquidity.poolAmount;
        uint256 reserveAmount = liquidity.reserveAmount;
        delete _protectedLiquidities[id];

        uint256[] storage ids = _protectedLiquidityIdsByProvider[provider];
        uint256 length = ids.length;
        assert(length > 0);

        uint256 lastIndex = length - 1;
        if (index < lastIndex) {
            uint256 lastId = ids[lastIndex];
            ids[index] = lastId;
            _protectedLiquidities[lastId].index = index;
        }

        ids.pop();

        // update the total amounts
        _totalProtectedPoolAmounts[poolToken] = _totalProtectedPoolAmounts[poolToken].sub(poolAmount);
        _totalProtectedReserveAmounts[poolToken][reserveToken] = _totalProtectedReserveAmounts[poolToken][reserveToken]
            .sub(reserveAmount);

        emit ProtectionRemoved(provider, poolToken, reserveToken, poolAmount, reserveAmount);
    }

    /**
     * @dev returns the number of network token locked balances for a given provider
     *
     * @param provider locked balances provider
     *
     * @return the number of network token locked balances
     */
    function lockedBalanceCount(address provider) external view returns (uint256) {
        return _lockedBalances[provider].length;
    }

    /**
     * @dev returns an existing locked network token balance details
     *
     * @param provider locked balances provider
     * @param index start index
     *
     * @return amount of network tokens
     * @return lock expiration time
     */
    function lockedBalance(address provider, uint256 index) external view override returns (uint256, uint256) {
        LockedBalance storage balance = _lockedBalances[provider][index];

        return (balance.amount, balance.expirationTime);
    }

    /**
     * @dev returns a range of locked network token balances for a given provider
     *
     * @param provider locked balances provider
     * @param startIndex start index
     * @param endIndex end index (exclusive)
     *
     * @return locked amounts
     * @return expiration times
     */
    function lockedBalanceRange(
        address provider,
        uint256 startIndex,
        uint256 endIndex
    ) external view override returns (uint256[] memory, uint256[] memory) {
        // limit the end index by the number of locked balances
        if (endIndex > _lockedBalances[provider].length) {
            endIndex = _lockedBalances[provider].length;
        }

        // ensure that the end index is higher than the start index
        require(endIndex > startIndex, "ERR_INVALID_INDICES");

        // get the locked balances for the given range and return them
        uint256 length = endIndex - startIndex;
        uint256[] memory amounts = new uint256[](length);
        uint256[] memory expirationTimes = new uint256[](length);

        for (uint256 i = 0; i < length; i++) {
            LockedBalance storage balance = _lockedBalances[provider][startIndex + i];
            amounts[i] = balance.amount;
            expirationTimes[i] = balance.expirationTime;
        }

        return (amounts, expirationTimes);
    }

    /**
     * @dev adds new locked network token balance
     * can only be called by the contract owner
     *
     * @param provider liquidity provider
     * @param amount token amount
     * @param expirationTime lock expiration time
     *
     * @return new locked balance index
     */
    function addLockedBalance(
        address provider,
        uint256 amount,
        uint256 expirationTime
    )
        external
        override
        ownerOnly
        validExternalAddress(provider)
        greaterThanZero(amount)
        greaterThanZero(expirationTime)
        returns (uint256)
    {
        _lockedBalances[provider].push(LockedBalance({ amount: amount, expirationTime: expirationTime }));

        emit BalanceLocked(provider, amount, expirationTime);
        return _lockedBalances[provider].length - 1;
    }

    /**
     * @dev removes a locked network token balance
     * can only be called by the contract owner
     *
     * @param provider liquidity provider
     * @param index index of the locked balance
     */
    function removeLockedBalance(address provider, uint256 index) external override ownerOnly validAddress(provider) {
        LockedBalance[] storage balances = _lockedBalances[provider];
        uint256 length = balances.length;

        // validate input
        require(index < length, "ERR_INVALID_INDEX");

        uint256 amount = balances[index].amount;
        uint256 lastIndex = length - 1;
        if (index < lastIndex) {
            balances[index] = balances[lastIndex];
        }

        balances.pop();

        emit BalanceUnlocked(provider, amount);
    }

    /**
     * @dev returns the system balance for a given token
     *
     * @param token token address
     *
     * @return system balance
     */
    function systemBalance(IReserveToken token) external view override returns (uint256) {
        return _systemBalances[token];
    }

    /**
     * @dev increases the system balance for a given token
     * can only be called by the contract owner
     *
     * @param token token address
     * @param amount token amount
     */
    function incSystemBalance(IReserveToken token, uint256 amount)
        external
        override
        ownerOnly
        validAddress(address(token))
    {
        uint256 prevAmount = _systemBalances[token];
        uint256 newAmount = prevAmount.add(amount);
        _systemBalances[token] = newAmount;

        emit SystemBalanceUpdated(token, prevAmount, newAmount);
    }

    /**
     * @dev decreases the system balance for a given token
     * can only be called by the contract owner
     *
     * @param token token address
     * @param amount token amount
     */
    function decSystemBalance(IReserveToken token, uint256 amount)
        external
        override
        ownerOnly
        validAddress(address(token))
    {
        uint256 prevAmount = _systemBalances[token];
        uint256 newAmount = prevAmount.sub(amount);
        _systemBalances[token] = newAmount;

        emit SystemBalanceUpdated(token, prevAmount, newAmount);
    }

    /**
     * @dev returns the total protected pool token amount for a given pool
     *
     * @param poolToken pool token address
     *
     * @return total protected amount
     */
    function totalProtectedPoolAmount(IDSToken poolToken) external view returns (uint256) {
        return _totalProtectedPoolAmounts[poolToken];
    }

    /**
     * @dev returns the total protected reserve amount for a given pool
     *
     * @param poolToken pool token address
     * @param reserveToken reserve token address
     *
     * @return total protected amount
     */
    function totalProtectedReserveAmount(IDSToken poolToken, IReserveToken reserveToken)
        external
        view
        returns (uint256)
    {
        return _totalProtectedReserveAmounts[poolToken][reserveToken];
    }
}
