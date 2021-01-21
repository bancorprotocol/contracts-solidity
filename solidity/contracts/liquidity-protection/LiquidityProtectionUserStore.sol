// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/EnumerableSet.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

import "./interfaces/ILiquidityProtectionUserStore.sol";
import "../utility/Utils.sol";

/**
 * @dev This contract aggregates the user balances of the liquidity protection mechanism.
 */
contract LiquidityProtectionUserStore is ILiquidityProtectionUserStore, AccessControl, Utils {
    using SafeMath for uint256;

    uint256 private constant MAX_UINT128 = 2**128 - 1;
    uint256 private constant MAX_UINT112 = 2**112 - 1;
    uint256 private constant MAX_UINT32 = 2**32 - 1;

    bytes32 public constant ROLE_SUPERVISOR = keccak256("ROLE_SUPERVISOR");
    bytes32 public constant ROLE_SEEDER = keccak256("ROLE_SEEDER");
    bytes32 public constant ROLE_OWNER = keccak256("ROLE_OWNER");

    struct Position {
        address provider; // liquidity provider
        uint256 index; // index in the provider liquidity ids array
        IDSToken poolToken; // pool token address
        IERC20Token reserveToken; // reserve token address
        uint128 poolAmount; // pool token amount
        uint128 reserveAmount; // reserve token amount
        uint256 reserveRateInfo; // reserve rate details:
        // bits 0...111 represent the numerator of the rate between the protected reserve token and the other reserve token
        // bits 111...223 represent the denominator of the rate between the protected reserve token and the other reserve token
        // bits 224...255 represent the update-time of the rate between the protected reserve token and the other reserve token
        // where `numerator / denominator` gives the worth of one protected reserve token in units of the other reserve token
    }

    struct LockedBalance {
        uint256 amount; // amount of network tokens
        uint256 expirationTime; // lock expiration time
    }

    // position by provider
    uint256 private _nextPositionId;
    mapping(address => uint256[]) private _positionIdsByProvider;
    mapping(uint256 => Position) private _positions;

    // user locked network token balances
    mapping(address => LockedBalance[]) private _lockedBalances;

    // allows execution only by an owner
    modifier ownerOnly {
        _hasRole(ROLE_OWNER);
        _;
    }

    // allows execution only by a seeder
    modifier seederOnly {
        _hasRole(ROLE_SEEDER);
        _;
    }

    // error message binary size optimization
    function _hasRole(bytes32 role) internal view {
        require(hasRole(role, msg.sender), "ERR_ACCESS_DENIED");
    }

    /**
     * @dev triggered when a position is added
     *
     * @param id              position id
     * @param provider        liquidity provider
     * @param poolToken       pool token address
     * @param reserveToken    reserve token address
     * @param poolAmount      amount of pool tokens
     * @param reserveAmount   amount of reserve tokens
     */
    event PositionAdded(
        uint256 id,
        address indexed provider,
        IDSToken indexed poolToken,
        IERC20Token indexed reserveToken,
        uint256 poolAmount,
        uint256 reserveAmount
    );

    /**
     * @dev triggered when a position is updated
     *
     * @param id                  position id
     * @param provider            liquidity provider
     * @param poolToken           pool token address
     * @param reserveToken        reserve token address
     * @param deltaPoolAmount     delta amount of pool tokens
     * @param deltaReserveAmount  delta amount of reserve tokens
     */
    event PositionUpdated(
        uint256 id,
        address indexed provider,
        IDSToken indexed poolToken,
        IERC20Token indexed reserveToken,
        int256 deltaPoolAmount,
        int256 deltaReserveAmount
    );

    /**
     * @dev triggered when a position is removed
     *
     * @param id              position id
     * @param provider        liquidity provider
     * @param poolToken       pool token address
     * @param reserveToken    reserve token address
     * @param poolAmount      amount of pool tokens
     * @param reserveAmount   amount of reserve tokens
     */
    event PositionRemoved(
        uint256 id,
        address indexed provider,
        IDSToken indexed poolToken,
        IERC20Token indexed reserveToken,
        uint256 poolAmount,
        uint256 reserveAmount
    );

    /**
     * @dev triggered when network tokens are locked
     *
     * @param provider        provider of the network tokens
     * @param amount          amount of network tokens
     * @param expirationTime  lock expiration time
     */
    event BalanceLocked(address indexed provider, uint256 amount, uint256 expirationTime);

    /**
     * @dev triggered when network tokens are unlocked
     *
     * @param provider    provider of the network tokens
     * @param amount      amount of network tokens
     */
    event BalanceUnlocked(address indexed provider, uint256 amount);

    constructor(uint256 nextPositionId) public {
        _nextPositionId = nextPositionId;

        // set up administrative roles
        _setRoleAdmin(ROLE_SUPERVISOR, ROLE_SUPERVISOR);
        _setRoleAdmin(ROLE_SEEDER, ROLE_SUPERVISOR);
        _setRoleAdmin(ROLE_OWNER, ROLE_SUPERVISOR);

        // allow the deployer to initially govern the contract
        _setupRole(ROLE_SUPERVISOR, msg.sender);
    }

    /**
     * @dev returns the number of _positions for the given provider
     *
     * @param provider    liquidity provider
     * @return number of _positions
     */
    function positionCount(address provider) external view returns (uint256) {
        return _positionIdsByProvider[provider].length;
    }

    /**
     * @dev returns the list of position ids for the given provider
     *
     * @param provider    liquidity provider
     * @return position ids
     */
    function positionIds(address provider) external view returns (uint256[] memory) {
        return _positionIdsByProvider[provider];
    }

    /**
     * @dev returns the id of a position for the given provider at a specific index
     *
     * @param provider    liquidity provider
     * @param index       position index
     * @return position id
     */
    function positionId(address provider, uint256 index) external view returns (uint256) {
        return _positionIdsByProvider[provider][index];
    }

    /**
     * @dev returns an existing position details
     *
     * @param id  position id
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
    function position(uint256 id)
        external
        view
        override
        returns (
            address,
            IDSToken,
            IERC20Token,
            uint256,
            uint256,
            uint256,
            uint256,
            uint256
        )
    {
        Position storage pos = _positions[id];
        uint256 reserveRateInfo = pos.reserveRateInfo;
        return (
            pos.provider,
            pos.poolToken,
            pos.reserveToken,
            uint256(pos.poolAmount),
            uint256(pos.reserveAmount),
            decodeReserveRateN(reserveRateInfo),
            decodeReserveRateD(reserveRateInfo),
            decodeReserveRateT(reserveRateInfo)
        );
    }

    /**
     * @dev adds a position
     * can be called only by the contract owner
     *
     * @param provider        liquidity provider
     * @param poolToken       pool token address
     * @param reserveToken    reserve token address
     * @param poolAmount      pool token amount
     * @param reserveAmount   reserve token amount
     * @param reserveRateN    rate of 1 protected reserve token in units of the other reserve token (numerator)
     * @param reserveRateD    rate of 1 protected reserve token in units of the other reserve token (denominator)
     * @param timestamp       timestamp
     * @return new position id
     */
    function addPosition(
        address provider,
        IDSToken poolToken,
        IERC20Token reserveToken,
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

        // add the position
        uint256[] storage ids = _positionIdsByProvider[provider];
        uint256 id = _nextPositionId;
        _nextPositionId += 1;

        _positions[id] = Position({
            provider: provider,
            index: ids.length,
            poolToken: poolToken,
            reserveToken: reserveToken,
            poolAmount: toUint128(poolAmount),
            reserveAmount: toUint128(reserveAmount),
            reserveRateInfo: encodeReserveRateInfo(reserveRateN, reserveRateD, timestamp)
        });

        ids.push(id);

        emit PositionAdded(id, provider, poolToken, reserveToken, poolAmount, reserveAmount);
        return id;
    }

    /**
     * @dev updates an existing position pool/reserve amounts
     * can be called only by the contract owner
     *
     * @param id                  position id
     * @param newPoolAmount       new pool tokens amount
     * @param newReserveAmount    new reserve tokens amount
     */
    function updatePositionAmounts(
        uint256 id,
        uint256 newPoolAmount,
        uint256 newReserveAmount
    ) external override ownerOnly greaterThanZero(newPoolAmount) greaterThanZero(newReserveAmount) {
        // update the position
        Position storage pos = _positions[id];

        // validate input
        require(pos.provider != address(0), "ERR_INVALID_ID");

        IDSToken poolToken = pos.poolToken;
        IERC20Token reserveToken = pos.reserveToken;
        uint256 prevPoolAmount = uint256(pos.poolAmount);
        uint256 prevReserveAmount = uint256(pos.reserveAmount);
        pos.poolAmount = toUint128(newPoolAmount);
        pos.reserveAmount = toUint128(newReserveAmount);

        int256 deltaPoolAmount = int256(prevPoolAmount) - int256(newPoolAmount);
        int256 deltaReserveAmount = int256(prevReserveAmount) - int256(newReserveAmount);

        emit PositionUpdated(id, pos.provider, poolToken, reserveToken, deltaPoolAmount, deltaReserveAmount);
    }

    /**
     * @dev removes a position
     * can be called only by the contract owner
     *
     * @param id  position id
     */
    function removePosition(uint256 id) external override ownerOnly {
        // remove the position
        Position storage pos = _positions[id];

        // validate input
        address provider = pos.provider;
        require(provider != address(0), "ERR_INVALID_ID");

        uint256 index = pos.index;
        IDSToken poolToken = pos.poolToken;
        IERC20Token reserveToken = pos.reserveToken;
        uint256 poolAmount = uint256(pos.poolAmount);
        uint256 reserveAmount = uint256(pos.reserveAmount);
        delete _positions[id];

        uint256[] storage ids = _positionIdsByProvider[provider];
        uint256 length = ids.length;
        assert(length > 0);

        uint256 lastIndex = length - 1;
        if (index < lastIndex) {
            uint256 lastId = ids[lastIndex];
            ids[index] = lastId;
            _positions[lastId].index = index;
        }

        ids.pop();

        emit PositionRemoved(id, provider, poolToken, reserveToken, poolAmount, reserveAmount);
    }

    /**
     * @dev returns the number of network token locked balances for a given provider
     *
     * @param provider    locked balances provider
     * @return the number of network token locked balances
     */
    function lockedBalanceCount(address provider) external view returns (uint256) {
        return _lockedBalances[provider].length;
    }

    /**
     * @dev returns an existing locked network token balance details
     *
     * @param provider    locked balances provider
     * @param index       start index
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
     * @param provider    locked balances provider
     * @param startIndex  start index
     * @param endIndex    end index (exclusive)
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
     * @dev adds a locked network token balance
     * can be called only by the contract owner
     *
     * @param provider        liquidity provider
     * @param amount          token amount
     * @param expirationTime  lock expiration time
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
        validAddress(provider)
        notThis(provider)
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
     * can be called only by the contract owner
     *
     * @param provider    liquidity provider
     * @param index       index of the locked balance
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

    function toUint128(uint256 amount) private pure returns (uint128) {
        require(amount <= MAX_UINT128, "ERR_AMOUNT_TOO_HIGH");
        return uint128(amount);
    }

    function encodeReserveRateInfo(
        uint256 reserveRateN,
        uint256 reserveRateD,
        uint256 reserveRateT
    ) private pure returns (uint256) {
        assert(reserveRateN <= MAX_UINT112 && reserveRateD <= MAX_UINT112 && reserveRateT <= MAX_UINT32);
        return reserveRateN | (reserveRateD << 112) | (reserveRateT << 224);
    }

    function decodeReserveRateN(uint256 reserveRateInfo) private pure returns (uint256) {
        return reserveRateInfo & MAX_UINT112;
    }

    function decodeReserveRateD(uint256 reserveRateInfo) private pure returns (uint256) {
        return (reserveRateInfo >> 112) & MAX_UINT112;
    }

    function decodeReserveRateT(uint256 reserveRateInfo) private pure returns (uint256) {
        return reserveRateInfo >> 224;
    }

    /**
     * @dev seeds system balances
     * can be executed only by a seeder
     *
     * @param providers         provider addresses
     * @param amounts           network token amounts
     * @param expirationTimes   lock expiration times
     *
     * In order to handle a provider whose locked balances have changed,
     * we need to pass its address along with a "zero" locked balance before
     * passing its address along with any of the other (valid) locked balances.
     * The function will subsequently delete the entire locked balance array
     * of the given provider, and then refill it with the new set of values.
     */
    function seedLockedBalances(
        address[] calldata providers,
        uint256[] calldata amounts,
        uint256[] calldata expirationTimes
    ) external seederOnly {
        uint256 length = providers.length;
        for (uint256 i = 0; i < length; i++) {
            if (amounts[i] > 0 || expirationTimes[i] > 0) {
                _lockedBalances[providers[i]].push(
                    LockedBalance({ amount: amounts[i], expirationTime: expirationTimes[i] })
                );
            } else {
                delete _lockedBalances[providers[i]];
            }
        }
    }

    /**
     * @dev seeds a position
     * can be called only by the contract owner
     *
     * @param id              position ID
     * @param provider        liquidity provider
     * @param poolToken       pool token address
     * @param reserveToken    reserve token address
     * @param poolAmount      pool token amount
     * @param reserveAmount   reserve token amount
     * @param reserveRateN    rate of 1 protected reserve token in units of the other reserve token (numerator)
     * @param reserveRateD    rate of 1 protected reserve token in units of the other reserve token (denominator)
     * @param timestamp       timestamp
     */
    function seedPosition(
        uint256 id,
        address provider,
        IDSToken poolToken,
        IERC20Token reserveToken,
        uint256 poolAmount,
        uint256 reserveAmount,
        uint256 reserveRateN,
        uint256 reserveRateD,
        uint256 timestamp
    ) external override ownerOnly {
        uint256[] storage ids = _positionIdsByProvider[provider];

        _positions[id] = Position({
            provider: provider,
            index: ids.length,
            poolToken: poolToken,
            reserveToken: reserveToken,
            poolAmount: toUint128(poolAmount),
            reserveAmount: toUint128(reserveAmount),
            reserveRateInfo: encodeReserveRateInfo(reserveRateN, reserveRateD, timestamp)
        });

        ids.push(id);
    }
}
