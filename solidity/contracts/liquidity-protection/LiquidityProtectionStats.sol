// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/EnumerableSet.sol";

import "./interfaces/ILiquidityProtectionStats.sol";
import "../utility/Utils.sol";
import "../utility/SafeMath.sol";
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

    mapping(IDSToken => uint256) private _totalPoolAmount;
    mapping(IDSToken => mapping(IERC20Token => uint256)) private _totalReserveAmount;
    mapping(IDSToken => mapping(IERC20Token => mapping(address => uint256))) private _totalProviderAmount;

    mapping(address => EnumerableSet.AddressSet) private _providerPools;

    // allows execution by the owner only
    modifier ownerOnly {
        require(hasRole(ROLE_OWNER, msg.sender), "ERR_ACCESS_DENIED");
        _;
    }

    // allows execution by the seeder only
    modifier seederOnly {
        require(hasRole(ROLE_SEEDER, msg.sender), "ERR_ACCESS_DENIED");
        _;
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
        _totalPoolAmount[poolToken] = _totalPoolAmount[poolToken].add(poolAmount);
        _totalReserveAmount[poolToken][reserveToken] = _totalReserveAmount[poolToken][reserveToken].add(reserveAmount);
        _totalProviderAmount[poolToken][reserveToken][provider] = _totalProviderAmount[poolToken][reserveToken][provider].add(reserveAmount);
    }

    /**
     * @dev decreases the total amounts
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
        _totalPoolAmount[poolToken] = _totalPoolAmount[poolToken].sub(poolAmount);
        _totalReserveAmount[poolToken][reserveToken] = _totalReserveAmount[poolToken][reserveToken].sub(reserveAmount);
        _totalProviderAmount[poolToken][reserveToken][provider] = _totalProviderAmount[poolToken][reserveToken][provider].sub(reserveAmount);
    }

    /**
     * @dev adds a pool to the list of pools of a liquidity provider
     *
     * @param provider  liquidity provider address
     * @param poolToken pool token address
     */
    function addProviderPool(
        address provider,
        IDSToken poolToken
    ) external override ownerOnly returns (bool) {
        return _providerPools[provider].add(address(poolToken));
    }

    /**
     * @dev removes a pool from the list of pools of a liquidity provider
     *
     * @param provider  liquidity provider address
     * @param poolToken pool token address
     */
    function removeProviderPool(
        address provider,
        IDSToken poolToken
    ) external override ownerOnly returns (bool) {
        return _providerPools[provider].remove(address(poolToken));
    }

    /**
     * @dev returns the total amount of protected pool tokens
     *
     * @param poolToken pool token address
     * @return total amount of protected pool tokens
     */
    function totalPoolAmount(
        IDSToken poolToken
    ) external view override returns (uint256) {
        return _totalPoolAmount[poolToken];
    }

    /**
     * @dev returns the total amount of protected reserve tokens
     *
     * @param poolToken     pool token address
     * @param reserveToken  reserve token address
     * @return total amount of protected reserve tokens
     */
    function totalReserveAmount(
        IDSToken poolToken,
        IERC20Token reserveToken
    ) external view override returns (uint256) {
        return _totalReserveAmount[poolToken][reserveToken];
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
        return _totalProviderAmount[poolToken][reserveToken][provider];
    }

    /**
     * @dev returns the list of pools of a liquidity provider
     *
     * @param provider  liquidity provider address
     * @return pool tokens
     */
    function providerPools(
        address provider
    ) external view override returns (IDSToken[] memory) {
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
     * @param tokens    pool token addresses
     * @param amounts   pool token amounts
     */
    function seedPoolAmounts(
        IDSToken[] calldata tokens,
        uint256[] calldata amounts
    ) external seederOnly {
        uint256 length = tokens.length;
        for (uint256 i = 0; i < length; i++) {
            _totalPoolAmount[tokens[i]] = amounts[i];
        }
    }

    /**
     * @dev seeds the total amount of protected reserve tokens
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
            _totalReserveAmount[tokens[i]][reserves[i]] = amounts[i];
        }
    }

    /**
     * @dev seeds the total amount of protected reserve tokens per liquidity provider
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
            _totalProviderAmount[tokens[i]][reserves[i]][providers[i]] = amounts[i];
            _providerPools[providers[i]].add(address(tokens[i]));
        }
    }
}
