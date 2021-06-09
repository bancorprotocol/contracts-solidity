// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

import "./interfaces/ILiquidityProtectionSystemStore.sol";

import "../utility/Utils.sol";

/**
 * @dev This contract aggregates the system balances of the liquidity protection mechanism.
 */
contract LiquidityProtectionSystemStore is ILiquidityProtectionSystemStore, AccessControl, Utils {
    using SafeMath for uint256;

    bytes32 public constant ROLE_SUPERVISOR = keccak256("ROLE_SUPERVISOR");
    bytes32 public constant ROLE_OWNER = keccak256("ROLE_OWNER");

    // system balances
    mapping(IERC20 => uint256) private _systemBalances;

    // network tokens minted
    mapping(IConverterAnchor => uint256) private _networkTokensMinted;

    // allows execution only by an owner
    modifier ownerOnly {
        _hasRole(ROLE_OWNER);
        _;
    }

    // error message binary size optimization
    function _hasRole(bytes32 role) internal view {
        require(hasRole(role, msg.sender), "ERR_ACCESS_DENIED");
    }

    /**
     * @dev triggered when the system balance for a given token is updated
     */
    event SystemBalanceUpdated(IERC20 indexed token, uint256 prevAmount, uint256 newAmount);

    /**
     * @dev triggered when the amount of network tokens minted into a specific pool is updated
     */
    event NetworkTokensMintedUpdated(IConverterAnchor indexed poolAnchor, uint256 prevAmount, uint256 newAmount);

    constructor() public {
        // set up administrative roles
        _setRoleAdmin(ROLE_SUPERVISOR, ROLE_SUPERVISOR);
        _setRoleAdmin(ROLE_OWNER, ROLE_SUPERVISOR);

        // allow the deployer to initially govern the contract
        _setupRole(ROLE_SUPERVISOR, msg.sender);
    }

    /**
     * @dev returns the system balance for a given token
     */
    function systemBalance(IERC20 token) external view override returns (uint256) {
        return _systemBalances[token];
    }

    /**
     * @dev increases the system balance for a given token
     *
     * Requirements:
     *
     * - the caller must have the ROLE_OWNER role
     */
    function incSystemBalance(IERC20 token, uint256 amount) external override ownerOnly validAddress(address(token)) {
        uint256 prevAmount = _systemBalances[token];
        uint256 newAmount = prevAmount.add(amount);
        _systemBalances[token] = newAmount;

        emit SystemBalanceUpdated(token, prevAmount, newAmount);
    }

    /**
     * @dev decreases the system balance for a given token
     *
     * Requirements:
     *
     * - the caller must have the ROLE_OWNER role
     */
    function decSystemBalance(IERC20 token, uint256 amount) external override ownerOnly validAddress(address(token)) {
        uint256 prevAmount = _systemBalances[token];
        uint256 newAmount = prevAmount.sub(amount);
        _systemBalances[token] = newAmount;

        emit SystemBalanceUpdated(token, prevAmount, newAmount);
    }

    /**
     * @dev returns the amount of network tokens minted into a specific pool
     */
    function networkTokensMinted(IConverterAnchor poolAnchor) external view override returns (uint256) {
        return _networkTokensMinted[poolAnchor];
    }

    /**
     * @dev increases the amount of network tokens minted into a specific pool
     *
     * Requirements:
     *
     * - the caller must have the ROLE_OWNER role
     */
    function incNetworkTokensMinted(IConverterAnchor poolAnchor, uint256 amount)
        external
        override
        ownerOnly
        validAddress(address(poolAnchor))
    {
        uint256 prevAmount = _networkTokensMinted[poolAnchor];
        uint256 newAmount = prevAmount.add(amount);
        _networkTokensMinted[poolAnchor] = newAmount;

        emit NetworkTokensMintedUpdated(poolAnchor, prevAmount, newAmount);
    }

    /**
     * @dev decreases the amount of network tokens minted into a specific pool
     *
     * Requirements:
     *
     * - the caller must have the ROLE_OWNER role
     */
    function decNetworkTokensMinted(IConverterAnchor poolAnchor, uint256 amount)
        external
        override
        ownerOnly
        validAddress(address(poolAnchor))
    {
        uint256 prevAmount = _networkTokensMinted[poolAnchor];
        uint256 newAmount = prevAmount > amount ? prevAmount - amount : 0;
        _networkTokensMinted[poolAnchor] = newAmount;

        emit NetworkTokensMintedUpdated(poolAnchor, prevAmount, newAmount);
    }
}
