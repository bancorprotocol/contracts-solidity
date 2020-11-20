// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "@openzeppelin/contracts/access/AccessControl.sol";

import "./interfaces/ILiquidityProtectionSettings.sol";
import "../utility/Utils.sol";

/**
 * @dev Liquidity Protection Settings contract
 */
contract LiquidityProtectionSettings is ILiquidityProtectionSettings, AccessControl, Utils {
    struct PoolIndex {
        bool isValid;
        uint256 value;
    }

    // the owner role is used to set the values in the store
    bytes32 public constant ROLE_OWNER = keccak256("ROLE_OWNER");

    uint32 private constant PPM_RESOLUTION = 1000000;

    // list of pools with less minting restrictions
    // mapping of pool anchor address -> index in the list of pools for quick access
    IConverterAnchor[] public highTierPools;
    mapping(IConverterAnchor => PoolIndex) private highTierPoolIndices;

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

    constructor() public {
        // set up administrative roles.
        _setRoleAdmin(ROLE_OWNER, ROLE_OWNER);

        // allow the deployer to initially govern the contract.
        _setupRole(ROLE_OWNER, msg.sender);
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
        // validate input
        PoolIndex storage poolIndex = highTierPoolIndices[_poolAnchor];
        require(!poolIndex.isValid, "ERR_POOL_ALREADY_EXISTS");

        poolIndex.value = highTierPools.length;
        highTierPools.push(_poolAnchor);
        poolIndex.isValid = true;
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
        // validate input
        PoolIndex storage poolIndex = highTierPoolIndices[_poolAnchor];
        require(poolIndex.isValid, "ERR_POOL_DOES_NOT_EXIST");

        uint256 index = poolIndex.value;
        uint256 length = highTierPools.length;
        assert(length > 0);

        uint256 lastIndex = length - 1;
        if (index < lastIndex) {
            IConverterAnchor lastAnchor = highTierPools[lastIndex];
            highTierPoolIndices[lastAnchor].value = index;
            highTierPools[index] = lastAnchor;
        }

        highTierPools.pop();
        delete highTierPoolIndices[_poolAnchor];
    }

    /**
     * @dev checks whether a given pool is a high tier one
     *
     * @param _poolAnchor pool anchor
     * @return true if the given pool is a high tier one, false otherwise
     */
    function isHighTierPool(IConverterAnchor _poolAnchor) public view override returns (bool) {
        return highTierPoolIndices[_poolAnchor].isValid;
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
}
