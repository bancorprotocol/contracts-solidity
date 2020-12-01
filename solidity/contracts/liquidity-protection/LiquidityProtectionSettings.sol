// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/EnumerableSet.sol";

import "./interfaces/ILiquidityProtectionSettings.sol";
import "../converter/interfaces/IConverter.sol";
import "../converter/interfaces/IConverterRegistry.sol";
import "../token/interfaces/IERC20Token.sol";
import "../utility/ContractRegistryClient.sol";
import "../utility/Utils.sol";

/**
 * @dev Liquidity Protection Settings contract
 */
contract LiquidityProtectionSettings is ILiquidityProtectionSettings, AccessControl, ContractRegistryClient {
    using EnumerableSet for EnumerableSet.AddressSet;

    // the owner role is used to set the values in the store
    bytes32 public constant ROLE_OWNER = keccak256("ROLE_OWNER");

    // the whitelist admin role is responsible for managing pools whitelist
    bytes32 public constant ROLE_WHITELIST_ADMIN = keccak256("ROLE_WHITELIST_ADMIN");

    uint32 private constant PPM_RESOLUTION = 1000000;

    IERC20Token public immutable networkToken;

    // list of whitelisted pools and mapping of pool anchor address
    EnumerableSet.AddressSet private _poolWhitelist;

    // list of pools with less minting restrictions
    EnumerableSet.AddressSet private _highTierPools;

    // system network token balance limits
    uint256 public override maxSystemNetworkTokenAmount = 1000000e18;
    uint32 public override maxSystemNetworkTokenRatio = 500000; // PPM units

    // number of seconds until any protection is in effect
    uint256 public override minProtectionDelay = 30 days;

    // number of seconds until full protection is in effect
    uint256 public override maxProtectionDelay = 100 days;

    // minimum amount of network tokens the system can mint as compensation for base token losses, default = 0.01 network tokens
    uint256 public override minNetworkCompensation = 1e16;

    // number of seconds from liquidation to full network token release
    uint256 public override lockDuration = 24 hours;

    // maximum deviation of the average rate from the spot rate
    uint32 public override averageRateMaxDeviation = 5000; // PPM units

    /**
     * @dev triggered when the pool whitelist is updated
     *
     * @param _poolAnchor  pool anchor
     * @param _added       true if the pool was added to the whitelist, false if it was removed
     */
    event PoolWhitelistUpdated(IConverterAnchor indexed _poolAnchor, bool _added);

    /**
     * @dev triggered when the system network token balance limits are updated
     *
     * @param _prevMaxSystemNetworkTokenAmount  previous maximum absolute balance in a pool
     * @param _newMaxSystemNetworkTokenAmount   new maximum absolute balance in a pool
     * @param _prevMaxSystemNetworkTokenRatio   previous maximum balance out of the total balance in a pool
     * @param _newMaxSystemNetworkTokenRatio    new maximum balance out of the total balance in a pool
     */
    event SystemNetworkTokenLimitsUpdated(
        uint256 _prevMaxSystemNetworkTokenAmount,
        uint256 _newMaxSystemNetworkTokenAmount,
        uint256 _prevMaxSystemNetworkTokenRatio,
        uint256 _newMaxSystemNetworkTokenRatio
    );

    /**
     * @dev triggered when the protection delays are updated
     *
     * @param _prevMinProtectionDelay  previous seconds until the protection starts
     * @param _newMinProtectionDelay   new seconds until the protection starts
     * @param _prevMaxProtectionDelay  previous seconds until full protection
     * @param _newMaxProtectionDelay   new seconds until full protection
     */
    event ProtectionDelaysUpdated(
        uint256 _prevMinProtectionDelay,
        uint256 _newMinProtectionDelay,
        uint256 _prevMaxProtectionDelay,
        uint256 _newMaxProtectionDelay
    );

    /**
     * @dev triggered when the minimum network token compensation is updated
     *
     * @param _prevMinNetworkCompensation  previous minimum network token compensation
     * @param _newMinNetworkCompensation   new minimum network token compensation
     */
    event MinNetworkCompensationUpdated(uint256 _prevMinNetworkCompensation, uint256 _newMinNetworkCompensation);

    /**
     * @dev triggered when the network token lock duration is updated
     *
     * @param _prevLockDuration  previous network token lock duration, in seconds
     * @param _newLockDuration   new network token lock duration, in seconds
     */
    event LockDurationUpdated(uint256 _prevLockDuration, uint256 _newLockDuration);

    /**
     * @dev triggered when the maximum deviation of the average rate from the spot rate is updated
     *
     * @param _prevAverageRateMaxDeviation previous maximum deviation of the average rate from the spot rate
     * @param _newAverageRateMaxDeviation  new maximum deviation of the average rate from the spot rate
     */
    event AverageRateMaxDeviationUpdated(uint32 _prevAverageRateMaxDeviation, uint32 _newAverageRateMaxDeviation);

    /**
     * @dev initializes a new LiquidityProtectionSettings contract
     *
     * @param _registry contract registry
     * @param _networkToken the network token
     */
    constructor(IERC20Token _networkToken, IContractRegistry _registry)
        public
        ContractRegistryClient(_registry)
        validAddress(address(_networkToken))
        notThis(address(_networkToken))
    {
        // set up administrative roles.
        _setRoleAdmin(ROLE_OWNER, ROLE_OWNER);
        _setRoleAdmin(ROLE_WHITELIST_ADMIN, ROLE_OWNER);

        // allow the deployer to initially govern the contract.
        _setupRole(ROLE_OWNER, msg.sender);

        networkToken = _networkToken;
    }

    modifier onlyOwner() {
        _onlyOwner();
        _;
    }

    // error message binary size optimization
    function _onlyOwner() internal view {
        require(hasRole(ROLE_OWNER, msg.sender), "ERR_ACCESS_DENIED");
    }

    modifier onlyWhitelistAdmin() {
        _onlyWhitelistAdmin();
        _;
    }

    // error message binary size optimization
    function _onlyWhitelistAdmin() internal view {
        require(hasRole(ROLE_WHITELIST_ADMIN, msg.sender), "ERR_ACCESS_DENIED");
    }

    // ensures that the portion is valid
    modifier validPortion(uint32 _portion) {
        _validPortion(_portion);
        _;
    }

    // error message binary size optimization
    function _validPortion(uint32 _portion) internal pure {
        require(_portion > 0 && _portion <= PPM_RESOLUTION, "ERR_INVALID_PORTION");
    }

    /**
     * @dev adds a pool to the whitelist
     * can only be called by the contract owner
     *
     * @param _poolAnchor pool anchor
     */
    function addPoolToWhitelist(IConverterAnchor _poolAnchor)
        external
        override
        onlyWhitelistAdmin
        validAddress(address(_poolAnchor))
        notThis(address(_poolAnchor))
    {
        require(_poolWhitelist.add(address(_poolAnchor)), "ERR_POOL_ALREADY_WHITELISTED");

        emit PoolWhitelistUpdated(_poolAnchor, true);
    }

    /**
     * @dev removes a pool from the whitelist
     * can only be called by the contract owner
     *
     * @param _poolAnchor pool anchor
     */
    function removePoolFromWhitelist(IConverterAnchor _poolAnchor)
        external
        override
        onlyWhitelistAdmin
        validAddress(address(_poolAnchor))
        notThis(address(_poolAnchor))
    {
        require(_poolWhitelist.remove(address(_poolAnchor)), "ERR_POOL_NOT_WHITELISTED");

        emit PoolWhitelistUpdated(_poolAnchor, false);
    }

    /**
     * @dev checks whether a given pool is whitelisted
     *
     * @param _poolAnchor pool anchor
     * @return true if the given pool is whitelisted, false otherwise
     */
    function isPoolWhitelisted(IConverterAnchor _poolAnchor) external view override returns (bool) {
        return _poolWhitelist.contains(address(_poolAnchor));
    }

    /**
     * @dev returns pools whitelist
     *
     * @return pools whitelist
     */
    function poolWhitelist() external view returns (address[] memory) {
        uint256 length = _poolWhitelist.length();
        address[] memory list = new address[](length);
        for (uint256 i = 0; i < length; ++i) {
            list[i] = _poolWhitelist.at(i);
        }
        return list;
    }

    /**
     * @dev adds a high tier pool
     * can only be called by the contract owner
     *
     * @param _poolAnchor pool anchor
     */
    function addHighTierPool(IConverterAnchor _poolAnchor)
        external
        override
        onlyOwner
        validAddress(address(_poolAnchor))
        notThis(address(_poolAnchor))
    {
        require(_highTierPools.add(address(_poolAnchor)), "ERR_POOL_ALREADY_EXISTS");
    }

    /**
     * @dev removes a high tier pool
     * can only be called by the contract owner
     *
     * @param _poolAnchor pool anchor
     */
    function removeHighTierPool(IConverterAnchor _poolAnchor)
        external
        override
        onlyOwner
        validAddress(address(_poolAnchor))
        notThis(address(_poolAnchor))
    {
        require(_highTierPools.remove(address(_poolAnchor)), "ERR_POOL_DOES_NOT_EXIST");
    }

    /**
     * @dev checks whether a given pool is a high tier one
     *
     * @param _poolAnchor pool anchor
     * @return true if the given pool is a high tier one, false otherwise
     */
    function isHighTierPool(IConverterAnchor _poolAnchor) external view override returns (bool) {
        return _highTierPools.contains(address(_poolAnchor));
    }

    /**
     * @dev returns high tier pools
     *
     * @return high tier pools
     */
    function highTierPools() external view returns (address[] memory) {
        uint256 length = _highTierPools.length();
        address[] memory list = new address[](length);
        for (uint256 i = 0; i < length; ++i) {
            list[i] = _highTierPools.at(i);
        }
        return list;
    }

    /**
     * @dev updates the system network token balance limits
     * can only be called by the contract owner
     *
     * @param _maxSystemNetworkTokenAmount  maximum absolute balance in a pool
     * @param _maxSystemNetworkTokenRatio   maximum balance out of the total balance in a pool (in PPM units)
     */
    function setSystemNetworkTokenLimits(uint256 _maxSystemNetworkTokenAmount, uint32 _maxSystemNetworkTokenRatio)
        external
        override
        onlyOwner()
        validPortion(_maxSystemNetworkTokenRatio)
    {
        emit SystemNetworkTokenLimitsUpdated(
            maxSystemNetworkTokenAmount,
            _maxSystemNetworkTokenAmount,
            maxSystemNetworkTokenRatio,
            _maxSystemNetworkTokenRatio
        );

        maxSystemNetworkTokenAmount = _maxSystemNetworkTokenAmount;
        maxSystemNetworkTokenRatio = _maxSystemNetworkTokenRatio;
    }

    /**
     * @dev updates the protection delays
     * can only be called by the contract owner
     *
     * @param _minProtectionDelay  seconds until the protection starts
     * @param _maxProtectionDelay  seconds until full protection
     */
    function setProtectionDelays(uint256 _minProtectionDelay, uint256 _maxProtectionDelay)
        external
        override
        onlyOwner()
    {
        require(_minProtectionDelay < _maxProtectionDelay, "ERR_INVALID_PROTECTION_DELAY");

        emit ProtectionDelaysUpdated(minProtectionDelay, _minProtectionDelay, maxProtectionDelay, _maxProtectionDelay);

        minProtectionDelay = _minProtectionDelay;
        maxProtectionDelay = _maxProtectionDelay;
    }

    /**
     * @dev updates the minimum network token compensation
     * can only be called by the contract owner
     *
     * @param _minCompensation new minimum compensation
     */
    function setMinNetworkCompensation(uint256 _minCompensation) external override onlyOwner() {
        emit MinNetworkCompensationUpdated(minNetworkCompensation, _minCompensation);

        minNetworkCompensation = _minCompensation;
    }

    /**
     * @dev updates the network token lock duration
     * can only be called by the contract owner
     *
     * @param _lockDuration    network token lock duration, in seconds
     */
    function setLockDuration(uint256 _lockDuration) external override onlyOwner() {
        emit LockDurationUpdated(lockDuration, _lockDuration);

        lockDuration = _lockDuration;
    }

    /**
     * @dev sets the maximum deviation of the average rate from the spot rate
     * can only be called by the contract owner
     *
     * @param _averageRateMaxDeviation maximum deviation of the average rate from the spot rate
     */
    function setAverageRateMaxDeviation(uint32 _averageRateMaxDeviation)
        external
        override
        onlyOwner()
        validPortion(_averageRateMaxDeviation)
    {
        emit AverageRateMaxDeviationUpdated(averageRateMaxDeviation, _averageRateMaxDeviation);

        averageRateMaxDeviation = _averageRateMaxDeviation;
    }

    /**
     * @dev checks if protection is supported for the given pool
     * only standard pools are supported (2 reserves, 50%/50% weights)
     * note that the pool should still be whitelisted
     *
     * @param _poolAnchor  anchor of the pool
     * @return true if the pool is supported, false otherwise
     */
    function isPoolSupported(IConverterAnchor _poolAnchor) external view override returns (bool) {
        IERC20Token tmpNetworkToken = networkToken;

        // verify that the pool exists in the registry
        IConverterRegistry converterRegistry = IConverterRegistry(addressOf(CONVERTER_REGISTRY));
        require(converterRegistry.isAnchor(address(_poolAnchor)), "ERR_INVALID_ANCHOR");

        // get the converter
        IConverter converter = IConverter(payable(ownedBy(_poolAnchor)));

        // verify that the converter has 2 reserves
        if (converter.connectorTokenCount() != 2) {
            return false;
        }

        // verify that one of the reserves is the network token
        IERC20Token reserve0Token = converter.connectorTokens(0);
        IERC20Token reserve1Token = converter.connectorTokens(1);
        if (reserve0Token != tmpNetworkToken && reserve1Token != tmpNetworkToken) {
            return false;
        }

        // verify that the reserve weights are exactly 50%/50%
        if (
            converterReserveWeight(converter, reserve0Token) != PPM_RESOLUTION / 2 ||
            converterReserveWeight(converter, reserve1Token) != PPM_RESOLUTION / 2
        ) {
            return false;
        }

        return true;
    }

    // utility to get the reserve weight (including from older converters that don't support the new converterReserveWeight function)
    function converterReserveWeight(IConverter _converter, IERC20Token _reserveToken) private view returns (uint32) {
        (, uint32 weight, , , ) = _converter.connectors(_reserveToken);
        return weight;
    }

    // utility to get the owner
    function ownedBy(IOwned _owned) private view returns (address) {
        return _owned.owner();
    }
}
