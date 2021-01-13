// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/EnumerableSet.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

import "./interfaces/ILiquidityProtectionStats.sol";
import "../utility/Utils.sol";
import "../token/interfaces/IDSToken.sol";
import "../token/interfaces/IERC20Token.sol";

/**
 * @dev This contract aggregates the statistics of the liquidity protection mechanism.
 */
contract LiquidityProtectionStats is ILiquidityProtectionStats, AccessControl, Utils {
    using EnumerableSet for EnumerableSet.AddressSet;
    using SafeMath for uint256;

    bytes32 public constant ROLE_SUPERVISOR = keccak256("ROLE_SUPERVISOR");
    bytes32 public constant ROLE_SEEDER = keccak256("ROLE_SEEDER");
    bytes32 public constant ROLE_OWNER = keccak256("ROLE_OWNER");

    mapping(IDSToken => uint256) private _totalPoolAmounts;
    mapping(IDSToken => mapping(IERC20Token => uint256)) private _totalReserveAmounts;
    mapping(IDSToken => mapping(IERC20Token => mapping(address => uint256))) private _totalProviderAmounts;

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
     * can only be executed only by an owner
     *
     * @param provider          liquidity provider address
     * @param poolToken         pool token address
     * @param reserveToken      reserve token address
     * @param poolAmount        pool token amount
     * @param reserveAmount     reserve token amount
     */
    function increaseTotalAmounts(
        address provider,
        IDSToken poolToken,
        IERC20Token reserveToken,
        uint256 poolAmount,
        uint256 reserveAmount
    ) external override ownerOnly {
        _totalPoolAmounts[poolToken] = _totalPoolAmounts[poolToken].add(poolAmount);
        _totalReserveAmounts[poolToken][reserveToken] = _totalReserveAmounts[poolToken][reserveToken].add(
            reserveAmount
        );
        _totalProviderAmounts[poolToken][reserveToken][provider] = _totalProviderAmounts[poolToken][reserveToken][
            provider
        ]
            .add(reserveAmount);
    }

    /**
     * @dev decreases the total amounts
     * can only be executed only by an owner
     *
     * @param provider          liquidity provider address
     * @param poolToken         pool token address
     * @param reserveToken      reserve token address
     * @param poolAmount        pool token amount
     * @param reserveAmount     reserve token amount
     */
    function decreaseTotalAmounts(
        address provider,
        IDSToken poolToken,
        IERC20Token reserveToken,
        uint256 poolAmount,
        uint256 reserveAmount
    ) external override ownerOnly {
        _totalPoolAmounts[poolToken] = _totalPoolAmounts[poolToken].sub(poolAmount);
        _totalReserveAmounts[poolToken][reserveToken] = _totalReserveAmounts[poolToken][reserveToken].sub(
            reserveAmount
        );
        _totalProviderAmounts[poolToken][reserveToken][provider] = _totalProviderAmounts[poolToken][reserveToken][
            provider
        ]
            .sub(reserveAmount);
    }

    /**
     * @dev adds a pool to the list of pools of a liquidity provider
     * can only be executed only by an owner
     *
     * @param provider  liquidity provider address
     * @param poolToken pool token address
     */
    function addProviderPool(address provider, IDSToken poolToken) external override ownerOnly returns (bool) {
        return _providerPools[provider].add(address(poolToken));
    }

    /**
     * @dev removes a pool from the list of pools of a liquidity provider
     * can only be executed only by an owner
     *
     * @param provider  liquidity provider address
     * @param poolToken pool token address
     */
    function removeProviderPool(address provider, IDSToken poolToken) external override ownerOnly returns (bool) {
        return _providerPools[provider].remove(address(poolToken));
    }

    /**
     * @dev returns the total amount of protected pool tokens
     *
     * @param poolToken pool token address
     * @return total amount of protected pool tokens
     */
    function totalPoolAmount(IDSToken poolToken) external view override returns (uint256) {
        return _totalPoolAmounts[poolToken];
    }

    /**
     * @dev returns the total amount of protected reserve tokens
     *
     * @param poolToken     pool token address
     * @param reserveToken  reserve token address
     * @return total amount of protected reserve tokens
     */
    function totalReserveAmount(IDSToken poolToken, IERC20Token reserveToken) external view override returns (uint256) {
        return _totalReserveAmounts[poolToken][reserveToken];
    }

    /**
     * @dev returns the total amount of a liquidity provider's protected reserve tokens
     *
     * @param poolToken     pool token address
     * @param reserveToken  reserve token address
     * @param provider      liquidity provider address
     * @return total amount of the liquidity provider's protected reserve tokens
     */
    function totalProviderAmount(
        IDSToken poolToken,
        IERC20Token reserveToken,
        address provider
    ) external view override returns (uint256) {
        return _totalProviderAmounts[poolToken][reserveToken][provider];
    }

    /**
     * @dev returns the list of pools of a liquidity provider
     *
     * @param provider  liquidity provider address
     * @return pool tokens
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
     * can only be executed only by a seeder
     *
     * @param tokens    pool token addresses
     * @param amounts   pool token amounts
     */
    function seedPoolAmounts(IDSToken[] calldata tokens, uint256[] calldata amounts) external seederOnly {
        uint256 length = tokens.length;
        for (uint256 i = 0; i < length; i++) {
            _totalPoolAmounts[tokens[i]] = amounts[i];
        }
    }

    /**
     * @dev seeds the total amount of protected reserve tokens
     * can only be executed only by a seeder
     *
     * @param tokens    pool token addresses
     * @param reserves  reserve token addresses
     * @param amounts   reserve token amounts
     */
    function seedReserveAmounts(
        IDSToken[] calldata tokens,
        IERC20Token[] calldata reserves,
        uint256[] calldata amounts
    ) external seederOnly {
        uint256 length = tokens.length;
        for (uint256 i = 0; i < length; i++) {
            _totalReserveAmounts[tokens[i]][reserves[i]] = amounts[i];
        }
    }

    /**
     * @dev seeds the total amount of protected reserve tokens per liquidity provider
     * can only be executed only by a seeder
     *
     * @param tokens    pool token addresses
     * @param reserves  reserve token addresses
     * @param providers liquidity provider addresses
     * @param amounts   reserve token amounts
     */
    function seedProviderAmounts(
        IDSToken[] calldata tokens,
        IERC20Token[] calldata reserves,
        address[] calldata providers,
        uint256[] calldata amounts
    ) external seederOnly {
        uint256 length = tokens.length;
        for (uint256 i = 0; i < length; i++) {
            _totalProviderAmounts[tokens[i]][reserves[i]][providers[i]] = amounts[i];
            _providerPools[providers[i]].add(address(tokens[i]));
        }
    }
}
