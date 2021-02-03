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

    uint32 private constant PPM_RESOLUTION = 1000000;

    IERC20Token public immutable networkToken;

    // list of whitelisted pools
    EnumerableSet.AddressSet private _poolWhitelist;

    // network token minting limits
    uint256 public override minNetworkTokenLiquidityForMinting = 1000e18;
    uint256 public override defaultNetworkTokenMintingLimit = 20000e18;
    mapping(IConverterAnchor => uint256) public override networkTokenMintingLimits;

    mapping(IConverterAnchor => mapping(IERC20Token => bool)) public override singleTokenStakingDisabled;

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
     * @dev triggered when the minimum amount of network token liquidity to allow minting is updated
     *
     * @param _prevMin  previous minimum amount of network token liquidity for minting
     * @param _newMin   new minimum amount of network token liquidity for minting
     */
    event MinNetworkTokenLiquidityForMintingUpdated(uint256 _prevMin, uint256 _newMin);

    /**
     * @dev triggered when the default network token minting limit is updated
     *
     * @param _prevDefault  previous default network token minting limit
     * @param _newDefault   new default network token minting limit
     */
    event DefaultNetworkTokenMintingLimitUpdated(uint256 _prevDefault, uint256 _newDefault);

    /**
     * @dev triggered when a pool network token minting limit is updated
     *
     * @param _poolAnchor   pool anchor
     * @param _prevLimit    previous limit
     * @param _newLimit     new limit
     */
    event NetworkTokenMintingLimitUpdated(IConverterAnchor indexed _poolAnchor, uint256 _prevLimit, uint256 _newLimit);

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
     * @dev triggered when single token staking is disabled or enabled
     *
     * @param _poolAnchor   pool anchor
     * @param _reserveToken reserve token
     * @param _state        true if disabled, false otherwise
     */
    event SingleTokenStakingDisabled(IConverterAnchor indexed _poolAnchor, IERC20Token indexed _reserveToken, bool _state);

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
        onlyOwner
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
        onlyOwner
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
    function poolWhitelist() external view override returns (address[] memory) {
        uint256 length = _poolWhitelist.length();
        address[] memory list = new address[](length);
        for (uint256 i = 0; i < length; i++) {
            list[i] = _poolWhitelist.at(i);
        }
        return list;
    }

    /**
     * @dev updates the minimum amount of network token liquidity to allow minting
     * can only be called by the contract owner
     *
     * @param _minimum    new minimum
     */
    function setMinNetworkTokenLiquidityForMinting(uint256 _minimum) external onlyOwner() {
        emit MinNetworkTokenLiquidityForMintingUpdated(minNetworkTokenLiquidityForMinting, _minimum);

        minNetworkTokenLiquidityForMinting = _minimum;
    }

    /**
     * @dev updates the default network token amount the system can mint into each pool
     * can only be called by the contract owner
     *
     * @param _limit    new limit
     */
    function setDefaultNetworkTokenMintingLimit(uint256 _limit) external onlyOwner() {
        emit DefaultNetworkTokenMintingLimitUpdated(defaultNetworkTokenMintingLimit, _limit);

        defaultNetworkTokenMintingLimit = _limit;
    }

    /**
     * @dev updates the amount of network tokens that the system can mint into a specific pool
     * can only be called by the contract owner
     *
     * @param _poolAnchor   pool anchor
     * @param _limit        new limit
     */
    function setNetworkTokenMintingLimit(IConverterAnchor _poolAnchor, uint256 _limit)
        external
        onlyOwner()
        validAddress(address(_poolAnchor))
    {
        emit NetworkTokenMintingLimitUpdated(_poolAnchor, networkTokenMintingLimits[_poolAnchor], _limit);

        networkTokenMintingLimits[_poolAnchor] = _limit;
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
     * @dev sets single token staking disabled or enabled
     * can only be called by the contract owner
     *
     * @param _poolAnchor   pool anchor
     * @param _reserveToken reserve token
     * @param _state        true if disabled, false otherwise
     */
    function disableSingleTokenStaking(
        IConverterAnchor _poolAnchor,
        IERC20Token _reserveToken,
        bool _state
    )
        external
        override
        onlyOwner()
    {
        emit SingleTokenStakingDisabled(_poolAnchor, _reserveToken, _state);

        singleTokenStakingDisabled[_poolAnchor][_reserveToken] = _state;
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
