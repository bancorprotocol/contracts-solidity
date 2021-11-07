// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/EnumerableSet.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

import "./interfaces/ILiquidityProtectionStats.sol";

/**
 * @dev This contract aggregates the statistics of the liquidity protection mechanism.
 */
contract LiquidityProtectionStats is ILiquidityProtectionStats, AccessControl {
    using EnumerableSet for EnumerableSet.AddressSet;
    using SafeMath for uint256;

    bytes32 public constant ROLE_SUPERVISOR = keccak256("ROLE_SUPERVISOR");
    bytes32 public constant ROLE_SEEDER = keccak256("ROLE_SEEDER");
    bytes32 public constant ROLE_OWNER = keccak256("ROLE_OWNER");

    mapping(IDSToken => uint256) private _totalPoolAmounts;
    mapping(IDSToken => mapping(IReserveToken => uint256)) private _totalReserveAmounts;
    mapping(address => mapping(IDSToken => mapping(IReserveToken => uint256))) private _totalProviderAmounts;

    mapping(address => EnumerableSet.AddressSet) private _providerPools;

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

    constructor() public {
        // set up administrative roles
        _setRoleAdmin(ROLE_SUPERVISOR, ROLE_SUPERVISOR);
        _setRoleAdmin(ROLE_SEEDER, ROLE_SUPERVISOR);
        _setRoleAdmin(ROLE_OWNER, ROLE_SUPERVISOR);

        // allow the deployer to initially govern the contract
        _setupRole(ROLE_SUPERVISOR, msg.sender);
    }

    /**
     * @dev increases the total amounts
     *
     * Requirements:
     *
     * - the caller must have the ROLE_OWNER role
     */
    function increaseTotalAmounts(
        address provider,
        IDSToken poolToken,
        IReserveToken reserveToken,
        uint256 poolAmount,
        uint256 reserveAmount
    ) external override ownerOnly {
        _totalPoolAmounts[poolToken] = _totalPoolAmounts[poolToken].add(poolAmount);
        _totalReserveAmounts[poolToken][reserveToken] = _totalReserveAmounts[poolToken][reserveToken].add(
            reserveAmount
        );
        _totalProviderAmounts[provider][poolToken][reserveToken] = _totalProviderAmounts[provider][poolToken][
            reserveToken
        ]
            .add(reserveAmount);
    }

    /**
     * @dev decreases the total amounts
     *
     * Requirements:
     *
     * - the caller must have the ROLE_OWNER role
     */
    function decreaseTotalAmounts(
        address provider,
        IDSToken poolToken,
        IReserveToken reserveToken,
        uint256 poolAmount,
        uint256 reserveAmount
    ) external override ownerOnly {
        _totalPoolAmounts[poolToken] = _totalPoolAmounts[poolToken].sub(poolAmount);
        _totalReserveAmounts[poolToken][reserveToken] = _totalReserveAmounts[poolToken][reserveToken].sub(
            reserveAmount
        );
        _totalProviderAmounts[provider][poolToken][reserveToken] = _totalProviderAmounts[provider][poolToken][
            reserveToken
        ]
            .sub(reserveAmount);
    }

    /**
     * @dev adds a pool to the list of pools of a liquidity provider
     *
     * Requirements:
     *
     * - the caller must have the ROLE_OWNER role
     */
    function addProviderPool(address provider, IDSToken poolToken) external override ownerOnly returns (bool) {
        return _providerPools[provider].add(address(poolToken));
    }

    /**
     * @dev removes a pool from the list of pools of a liquidity provider
     *
     * Requirements:
     *
     * - the caller must have the ROLE_OWNER role
     */
    function removeProviderPool(address provider, IDSToken poolToken) external override ownerOnly returns (bool) {
        return _providerPools[provider].remove(address(poolToken));
    }

    /**
     * @dev returns the total amount of protected pool tokens
     */
    function totalPoolAmount(IDSToken poolToken) external view override returns (uint256) {
        return _totalPoolAmounts[poolToken];
    }

    /**
     * @dev returns the total amount of protected reserve tokens
     */
    function totalReserveAmount(IDSToken poolToken, IReserveToken reserveToken)
        external
        view
        override
        returns (uint256)
    {
        return _totalReserveAmounts[poolToken][reserveToken];
    }

    /**
     * @dev returns the total amount of a liquidity provider's protected reserve tokens
     */
    function totalProviderAmount(
        address provider,
        IDSToken poolToken,
        IReserveToken reserveToken
    ) external view override returns (uint256) {
        return _totalProviderAmounts[provider][poolToken][reserveToken];
    }

    /**
     * @dev returns the list of pools of a liquidity provider
     */
    function providerPools(address provider) external view override returns (IDSToken[] memory) {
        EnumerableSet.AddressSet storage set = _providerPools[provider];
        uint256 length = set.length();
        IDSToken[] memory arr = new IDSToken[](length);
        for (uint256 i = 0; i < length; i++) {
            arr[i] = IDSToken(set.at(i));
        }
        return arr;
    }

    /**
     * @dev seeds the total amount of protected pool tokens
     *
     * Requirements:
     *
     * - the caller must have the ROLE_SEEDER role
     */
    function seedPoolAmounts(IDSToken[] calldata poolTokens, uint256[] calldata poolAmounts) external seederOnly {
        uint256 length = poolTokens.length;
        for (uint256 i = 0; i < length; i++) {
            _totalPoolAmounts[poolTokens[i]] = poolAmounts[i];
        }
    }

    /**
     * @dev seeds the total amount of protected reserve tokens
     *
     * Requirements:
     *
     * - the caller must have the ROLE_SEEDER role
     */
    function seedReserveAmounts(
        IDSToken[] calldata poolTokens,
        IReserveToken[] calldata reserveTokens,
        uint256[] calldata reserveAmounts
    ) external seederOnly {
        uint256 length = poolTokens.length;
        for (uint256 i = 0; i < length; i++) {
            _totalReserveAmounts[poolTokens[i]][reserveTokens[i]] = reserveAmounts[i];
        }
    }

    /**
     * @dev seeds the total amount of protected reserve tokens per liquidity provider
     *
     * Requirements:
     *
     * - the caller must have the ROLE_SEEDER role
     */
    function seedProviderAmounts(
        address[] calldata providers,
        IDSToken[] calldata poolTokens,
        IReserveToken[] calldata reserveTokens,
        uint256[] calldata reserveAmounts
    ) external seederOnly {
        uint256 length = providers.length;
        for (uint256 i = 0; i < length; i++) {
            _totalProviderAmounts[providers[i]][poolTokens[i]][reserveTokens[i]] = reserveAmounts[i];
        }
    }

    /**
     * @dev seeds the list of pools per liquidity provider
     *
     * Requirements:
     *
     * - the caller must have the ROLE_SEEDER role
     */
    function seedProviderPools(address[] calldata providers, IDSToken[] calldata poolTokens) external seederOnly {
        uint256 length = providers.length;
        for (uint256 i = 0; i < length; i++) {
            _providerPools[providers[i]].add(address(poolTokens[i]));
        }
    }
}
