// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/EnumerableSet.sol";

import "./interfaces/ILiquidityProtectionSettings.sol";
import "../converter/interfaces/IConverter.sol";
import "../converter/interfaces/IConverterRegistry.sol";
import "../utility/ContractRegistryClient.sol";
import "../utility/Utils.sol";

/**
 * @dev Liquidity Protection Settings contract
 */
contract LiquidityProtectionSettings is ILiquidityProtectionSettings, AccessControl, ContractRegistryClient {
    using SafeMath for uint256;
    using EnumerableSet for EnumerableSet.AddressSet;

    // the owner role is used to update the settings
    bytes32 public constant ROLE_OWNER = keccak256("ROLE_OWNER");

    IERC20 private immutable _networkToken;

    // list of whitelisted pools
    EnumerableSet.AddressSet private _poolWhitelist;

    // list of subscribers
    EnumerableSet.AddressSet private _subscribers;

    // network token minting limits
    uint256 private _minNetworkTokenLiquidityForMinting = 1000e18;
    uint256 private _defaultNetworkTokenMintingLimit = 20000e18;
    mapping(IConverterAnchor => uint256) private _networkTokenMintingLimits;

    // permission of adding liquidity for a given reserve on a given pool
    mapping(IConverterAnchor => mapping(IERC20 => bool)) private _addLiquidityDisabled;

    // number of seconds until any protection is in effect
    uint256 private _minProtectionDelay = 30 days;

    // number of seconds until full protection is in effect
    uint256 private _maxProtectionDelay = 100 days;

    // minimum amount of network tokens that the system can mint as compensation for base token losses
    uint256 private _minNetworkCompensation = 1e16; // = 0.01 network tokens

    // number of seconds from liquidation to full network token release
    uint256 private _lockDuration = 24 hours;

    // maximum deviation of the average rate from the spot rate
    uint32 private _averageRateMaxDeviation = 5000; // PPM units

    /**
     * @dev triggered when the pool whitelist is updated
     *
     * @param poolAnchor    pool anchor
     * @param added         true if the pool was added to the whitelist, false if it was removed
     */
    event PoolWhitelistUpdated(IConverterAnchor indexed poolAnchor, bool added);

    /**
     * @dev triggered when a subscriber is added or removed
     *
     * @param subscriber    subscriber
     * @param added         true if the subscriber was added, false if it was removed
     */
    event SubscriberUpdated(ILiquidityProtectionEventsSubscriber indexed subscriber, bool added);

    /**
     * @dev triggered when the minimum amount of network token liquidity to allow minting is updated
     *
     * @param prevMin   previous minimum amount of network token liquidity for minting
     * @param newMin    new minimum amount of network token liquidity for minting
     */
    event MinNetworkTokenLiquidityForMintingUpdated(uint256 prevMin, uint256 newMin);

    /**
     * @dev triggered when the default network token minting limit is updated
     *
     * @param prevDefault   previous default network token minting limit
     * @param newDefault    new default network token minting limit
     */
    event DefaultNetworkTokenMintingLimitUpdated(uint256 prevDefault, uint256 newDefault);

    /**
     * @dev triggered when a pool network token minting limit is updated
     *
     * @param poolAnchor    pool anchor
     * @param prevLimit     previous limit
     * @param newLimit      new limit
     */
    event NetworkTokenMintingLimitUpdated(IConverterAnchor indexed poolAnchor, uint256 prevLimit, uint256 newLimit);

    /**
     * @dev triggered when the protection delays are updated
     *
     * @param prevMinProtectionDelay    previous seconds until the protection starts
     * @param newMinProtectionDelay     new seconds until the protection starts
     * @param prevMaxProtectionDelay    previous seconds until full protection
     * @param newMaxProtectionDelay     new seconds until full protection
     */
    event ProtectionDelaysUpdated(
        uint256 prevMinProtectionDelay,
        uint256 newMinProtectionDelay,
        uint256 prevMaxProtectionDelay,
        uint256 newMaxProtectionDelay
    );

    /**
     * @dev triggered when the minimum network token compensation is updated
     *
     * @param prevMinNetworkCompensation    previous minimum network token compensation
     * @param newMinNetworkCompensation     new minimum network token compensation
     */
    event MinNetworkCompensationUpdated(uint256 prevMinNetworkCompensation, uint256 newMinNetworkCompensation);

    /**
     * @dev triggered when the network token lock duration is updated
     *
     * @param prevLockDuration  previous network token lock duration, in seconds
     * @param newLockDuration   new network token lock duration, in seconds
     */
    event LockDurationUpdated(uint256 prevLockDuration, uint256 newLockDuration);

    /**
     * @dev triggered when the maximum deviation of the average rate from the spot rate is updated
     *
     * @param prevAverageRateMaxDeviation   previous maximum deviation of the average rate from the spot rate
     * @param newAverageRateMaxDeviation    new maximum deviation of the average rate from the spot rate
     */
    event AverageRateMaxDeviationUpdated(uint32 prevAverageRateMaxDeviation, uint32 newAverageRateMaxDeviation);

    /**
     * @dev triggered when adding liquidity is disabled or enabled for a given reserve on a given pool
     *
     * @param poolAnchor    pool anchor
     * @param reserveToken  reserve token
     * @param disabled      true if disabled, false otherwise
     */
    event AddLiquidityDisabled(IConverterAnchor indexed poolAnchor, IERC20 indexed reserveToken, bool disabled);

    /**
     * @dev initializes a new LiquidityProtectionSettings contract
     *
     * @param registry  contract registry
     * @param token     the network token
     */
    constructor(IERC20 token, IContractRegistry registry)
        public
        ContractRegistryClient(registry)
        validExternalAddress(address(token))
    {
        // set up administrative roles.
        _setRoleAdmin(ROLE_OWNER, ROLE_OWNER);

        // allow the deployer to initially govern the contract.
        _setupRole(ROLE_OWNER, msg.sender);

        _networkToken = token;
    }

    modifier onlyOwner() {
        _onlyOwner();
        _;
    }

    // error message binary size optimization
    function _onlyOwner() internal view {
        require(hasRole(ROLE_OWNER, msg.sender), "ERR_ACCESS_DENIED");
    }

    /**
     * @dev returns the network token
     *
     * @return the network token
     */
    function networkToken() external view returns (IERC20) {
        return _networkToken;
    }

    /**
     * @dev returns the minimum network token liquidity for minting
     *
     * @return the minimum network token liquidity for minting
     */
    function minNetworkTokenLiquidityForMinting() external view override returns (uint256) {
        return _minNetworkTokenLiquidityForMinting;
    }

    /**
     * @dev returns the default network token minting limit
     *
     * @return the default network token minting limit
     */
    function defaultNetworkTokenMintingLimit() external view override returns (uint256) {
        return _defaultNetworkTokenMintingLimit;
    }

    /**
     * @dev returns the network token minting limit for a given pool
     *
     * @param poolAnchor    pool anchor
     * @return the network token minting limit for a given pool
     */
    function networkTokenMintingLimits(IConverterAnchor poolAnchor) external view override returns (uint256) {
        return _networkTokenMintingLimits[poolAnchor];
    }

    /**
     * @dev returns the permission of adding liquidity for a given reserve on a given pool
     *
     * @param poolAnchor    pool anchor
     * @param reserveToken  reserve token
     * @return true if adding liquidity is disabled, false otherwise
     */
    function addLiquidityDisabled(IConverterAnchor poolAnchor, IERC20 reserveToken)
        external
        view
        override
        returns (bool)
    {
        return _addLiquidityDisabled[poolAnchor][reserveToken];
    }

    /**
     * @dev returns the minimum number of seconds until any protection is in effect
     *
     * @return the minimum number of seconds until any protection is in effect
     */
    function minProtectionDelay() external view override returns (uint256) {
        return _minProtectionDelay;
    }

    /**
     * @dev returns the maximum number of seconds until full protection is in effect
     *
     * @return the maximum number of seconds until full protection is in effect
     */
    function maxProtectionDelay() external view override returns (uint256) {
        return _maxProtectionDelay;
    }

    /**
     * @dev returns the minimum amount of network tokens that the system can mint as compensation for base token losses
     *
     * @return the minimum amount of network tokens that the system can mint as compensation for base token losses
     */
    function minNetworkCompensation() external view override returns (uint256) {
        return _minNetworkCompensation;
    }

    /**
     * @dev returns the number of seconds from liquidation to full network token release
     *
     * @return the number of seconds from liquidation to full network token release
     */
    function lockDuration() external view override returns (uint256) {
        return _lockDuration;
    }

    /**
     * @dev returns the maximum deviation of the average rate from the spot rate
     *
     * @return the maximum deviation of the average rate from the spot rate
     */
    function averageRateMaxDeviation() external view override returns (uint32) {
        return _averageRateMaxDeviation;
    }

    /**
     * @dev adds a pool to the whitelist
     * can only be called by the contract owner
     *
     * @param poolAnchor    pool anchor
     */
    function addPoolToWhitelist(IConverterAnchor poolAnchor) external onlyOwner validAddress(address(poolAnchor)) {
        require(_poolWhitelist.add(address(poolAnchor)), "ERR_POOL_ALREADY_WHITELISTED");

        emit PoolWhitelistUpdated(poolAnchor, true);
    }

    /**
     * @dev removes a pool from the whitelist
     * can only be called by the contract owner
     *
     * @param poolAnchor    pool anchor
     */
    function removePoolFromWhitelist(IConverterAnchor poolAnchor) external onlyOwner {
        require(_poolWhitelist.remove(address(poolAnchor)), "ERR_POOL_NOT_WHITELISTED");

        emit PoolWhitelistUpdated(poolAnchor, false);
    }

    /**
     * @dev checks whether a given pool is whitelisted
     *
     * @param poolAnchor    pool anchor
     * @return true if the given pool is whitelisted, false otherwise
     */
    function isPoolWhitelisted(IConverterAnchor poolAnchor) external view override returns (bool) {
        return _poolWhitelist.contains(address(poolAnchor));
    }

    /**
     * @dev returns pools whitelist
     *
     * @return pools whitelist
     */
    function poolWhitelist() external view override returns (address[] memory) {
        uint256 length = _poolWhitelist.length();
        address[] memory list = new address[](length);
        for (uint256 i = 0; i < length; i++) {
            list[i] = _poolWhitelist.at(i);
        }
        return list;
    }

    /**
     * @dev adds a subscriber
     * can only be called by the contract owner
     *
     * @param subscriber    subscriber address
     */
    function addSubscriber(ILiquidityProtectionEventsSubscriber subscriber)
        external
        onlyOwner
        validExternalAddress(address(subscriber))
    {
        require(_subscribers.add(address(subscriber)), "ERR_SUBSCRIBER_ALREADY_SET");

        emit SubscriberUpdated(subscriber, true);
    }

    /**
     * @dev removes a subscriber
     * can only be called by the contract owner
     *
     * @param subscriber    subscriber address
     */
    function removeSubscriber(ILiquidityProtectionEventsSubscriber subscriber) external onlyOwner {
        require(_subscribers.remove(address(subscriber)), "ERR_INVALID_SUBSCRIBER");

        emit SubscriberUpdated(subscriber, false);
    }

    /**
     * @dev returns subscribers list
     *
     * @return subscribers list
     */
    function subscribers() external view override returns (address[] memory) {
        uint256 length = _subscribers.length();
        address[] memory list = new address[](length);
        for (uint256 i = 0; i < length; i++) {
            list[i] = _subscribers.at(i);
        }
        return list;
    }

    /**
     * @dev updates the minimum amount of network token liquidity to allow minting
     * can only be called by the contract owner
     *
     * @param amount   the minimum amount of network token liquidity to allow minting
     */
    function setMinNetworkTokenLiquidityForMinting(uint256 amount) external onlyOwner() {
        emit MinNetworkTokenLiquidityForMintingUpdated(_minNetworkTokenLiquidityForMinting, amount);

        _minNetworkTokenLiquidityForMinting = amount;
    }

    /**
     * @dev updates the default amount of network token that the system can mint into each pool
     * can only be called by the contract owner
     *
     * @param amount    the default amount of network token that the system can mint into each pool
     */
    function setDefaultNetworkTokenMintingLimit(uint256 amount) external onlyOwner() {
        emit DefaultNetworkTokenMintingLimitUpdated(_defaultNetworkTokenMintingLimit, amount);

        _defaultNetworkTokenMintingLimit = amount;
    }

    /**
     * @dev updates the amount of network tokens that the system can mint into a specific pool
     * can only be called by the contract owner
     *
     * @param poolAnchor    pool anchor
     * @param amount        the amount of network tokens that the system can mint into a specific pool
     */
    function setNetworkTokenMintingLimit(IConverterAnchor poolAnchor, uint256 amount)
        external
        onlyOwner()
        validAddress(address(poolAnchor))
    {
        emit NetworkTokenMintingLimitUpdated(poolAnchor, _networkTokenMintingLimits[poolAnchor], amount);

        _networkTokenMintingLimits[poolAnchor] = amount;
    }

    /**
     * @dev updates the protection delays
     * can only be called by the contract owner
     *
     * @param minDelay   seconds until the protection starts
     * @param maxDelay   seconds until full protection
     */
    function setProtectionDelays(uint256 minDelay, uint256 maxDelay) external onlyOwner() {
        require(minDelay < maxDelay, "ERR_INVALID_PROTECTION_DELAY");

        emit ProtectionDelaysUpdated(_minProtectionDelay, minDelay, _maxProtectionDelay, maxDelay);

        _minProtectionDelay = minDelay;
        _maxProtectionDelay = maxDelay;
    }

    /**
     * @dev updates the minimum amount of network token compensation
     * can only be called by the contract owner
     *
     * @param amount    the minimum amount of network token compensation
     */
    function setMinNetworkCompensation(uint256 amount) external onlyOwner() {
        emit MinNetworkCompensationUpdated(_minNetworkCompensation, amount);

        _minNetworkCompensation = amount;
    }

    /**
     * @dev updates the network token lock duration
     * can only be called by the contract owner
     *
     * @param duration  network token lock duration, in seconds
     */
    function setLockDuration(uint256 duration) external onlyOwner() {
        emit LockDurationUpdated(_lockDuration, duration);

        _lockDuration = duration;
    }

    /**
     * @dev sets the maximum deviation of the average rate from the spot rate
     * can only be called by the contract owner
     *
     * @param deviation maximum deviation of the average rate from the spot rate
     */
    function setAverageRateMaxDeviation(uint32 deviation) external onlyOwner() validPortion(deviation) {
        emit AverageRateMaxDeviationUpdated(_averageRateMaxDeviation, deviation);

        _averageRateMaxDeviation = deviation;
    }

    /**
     * @dev disables or enables adding liquidity for a given reserve on a given pool
     * can only be called by the contract owner
     *
     * @param poolAnchor    pool anchor
     * @param reserveToken  reserve token
     * @param disable       true to disable, false otherwise
     */
    function disableAddLiquidity(
        IConverterAnchor poolAnchor,
        IERC20 reserveToken,
        bool disable
    ) external onlyOwner() {
        emit AddLiquidityDisabled(poolAnchor, reserveToken, disable);

        _addLiquidityDisabled[poolAnchor][reserveToken] = disable;
    }

    /**
     * @dev checks if protection is supported for the given pool
     * only standard pools are supported (2 reserves, 50%/50% weights)
     * note that the pool should still be whitelisted
     *
     * @param poolAnchor    anchor of the pool
     * @return true if the pool is supported, false otherwise
     */
    function isPoolSupported(IConverterAnchor poolAnchor) external view override returns (bool) {
        IERC20 tmpNetworkToken = _networkToken;

        // verify that the pool exists in the registry
        IConverterRegistry converterRegistry = IConverterRegistry(addressOf(CONVERTER_REGISTRY));
        require(converterRegistry.isAnchor(address(poolAnchor)), "ERR_INVALID_ANCHOR");

        // get the converter
        IConverter converter = IConverter(payable(poolAnchor.owner()));

        // verify that the converter has 2 reserves
        if (converter.connectorTokenCount() != 2) {
            return false;
        }

        // verify that one of the reserves is the network token
        IERC20 reserve0Token = converter.connectorTokens(0);
        IERC20 reserve1Token = converter.connectorTokens(1);
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
    function converterReserveWeight(IConverter converter, IERC20 reserveToken) private view returns (uint32) {
        (, uint32 weight, , , ) = converter.connectors(reserveToken);
        return weight;
    }
}
