// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;
import "./interfaces/ILiquidityProtectionStats.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "../utility/Utils.sol";
import "../token/interfaces/IDSToken.sol";
import "../token/interfaces/IERC20Token.sol";

/**
 * @dev This contract aggregates the statistics of the liquidity protection mechanism.
 */
contract LiquidityProtectionStats is ILiquidityProtectionStats, AccessControl, Utils {
    bytes32 public constant ROLE_OWNER = keccak256("ROLE_OWNER");
    bytes32 public constant ROLE_SEEDER = keccak256("ROLE_SEEDER");

    mapping(IDSToken => uint256) public totalProtectedPoolAmount;
    mapping(IDSToken => mapping(IERC20Token => uint256)) public totalProtectedReserveAmount;
    mapping(IDSToken => mapping(IERC20Token => mapping(address => uint256))) public totalProtectedProviderAmount;

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

    /**
     * @dev sets the total protected pool token amount for a given pool
     *
     * @param _poolToken    pool token address
     * @param _amount       total protected amount
     */
    function setTotalProtectedPoolAmount(
        IDSToken _poolToken,
        uint256 _amount
    ) external override ownerOnly {
        totalProtectedPoolAmount[_poolToken] = _amount;
    }

    /**
     * @dev sets the total protected reserve amount for a given pool
     *
     * @param _poolToken        pool token address
     * @param _reserveToken     reserve token address
     * @param _amount           total protected amount
     */
    function setTotalProtectedReserveAmount(
        IDSToken _poolToken,
        IERC20Token _reserveToken,
        uint256 _amount
    ) external override ownerOnly {
        totalProtectedReserveAmount[_poolToken][_reserveToken] = _amount;
    }

    /**
     * @dev sets the total protected provider amount for a given pool and a given reserve
     *
     * @param _poolToken        pool token address
     * @param _reserveToken     reserve token address
     * @param _provider         provider address
     * @param _amount           total protected amount
     */
    function setTotalProtectedProviderAmount(
        IDSToken _poolToken,
        IERC20Token _reserveToken,
        address _provider,
        uint256 _amount
    ) external override ownerOnly {
        totalProtectedProviderAmount[_poolToken][_reserveToken][_provider] = _amount;
    }

    function seed(
        address[] memory _tokens,
        address[] memory _reserve0s,
        address[] memory _reserve1s,
        address[] memory _providers,
        uint256[] memory _poolAmounts,
        uint256[] memory _reserve0Amounts,
        uint256[] memory _reserve1Amounts,
        uint256[] memory _provider0Amounts,
        uint256[] memory _provider1Amounts
    ) external seederOnly {
        uint256 length = _tokens.length;
        require(length == _reserve0s.length);
        require(length == _reserve1s.length);
        require(length == _providers.length);
        require(length == _poolAmounts.length);
        require(length == _reserve0Amounts.length);
        require(length == _reserve1Amounts.length);
        require(length == _provider0Amounts.length);
        require(length == _provider1Amounts.length);
        for (uint256 i = 0; i < length; i++) {
            totalProtectedPoolAmount[IDSToken(_tokens[i])] = _poolAmounts[i];
            totalProtectedReserveAmount[IDSToken(_tokens[i])][IERC20Token(_reserve0s[i])] = _reserve0Amounts[i];
            totalProtectedReserveAmount[IDSToken(_tokens[i])][IERC20Token(_reserve1s[i])] = _reserve1Amounts[i];
            totalProtectedProviderAmount[IDSToken(_tokens[i])][IERC20Token(_reserve0s[i])][_providers[i]] = _provider0Amounts[i];
            totalProtectedProviderAmount[IDSToken(_tokens[i])][IERC20Token(_reserve1s[i])][_providers[i]] = _provider1Amounts[i];
        }
    }
}
