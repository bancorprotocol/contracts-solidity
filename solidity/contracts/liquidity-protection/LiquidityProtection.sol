// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;
import "../utility/ContractRegistryClient.sol";
import "../utility/ReentrancyGuard.sol";
import "../utility/Owned.sol";
import "../utility/SafeMath.sol";
import "../utility/Math.sol";
import "../utility/TokenHandler.sol";
import "../utility/Types.sol";
import "./interfaces/ILiquidityProtectionStore.sol";
import "../token/interfaces/IDSToken.sol";
import "../token/interfaces/IERC20Token.sol";
import "../converter/interfaces/IConverterAnchor.sol";
import "../converter/interfaces/IConverter.sol";
import "../converter/interfaces/IConverterRegistry.sol";

interface ILiquidityPoolV1Converter is IConverter {
    function addLiquidity(IERC20Token[] memory _reserveTokens, uint256[] memory _reserveAmounts, uint256 _minReturn) external payable;
    function removeLiquidity(uint256 _amount, IERC20Token[] memory _reserveTokens, uint256[] memory _reserveMinReturnAmounts) external;
    function recentAverageRate(IERC20Token _reserveToken) external view returns (uint256, uint256);
}

/**
  * @dev Liquidity Protection
*/
contract LiquidityProtection is TokenHandler, ContractRegistryClient, ReentrancyGuard {
    using SafeMath for uint256;
    using Math for *;

    struct ProtectedLiquidity {
        address provider;           // liquidity provider
        IDSToken poolToken;         // pool token address
        IERC20Token reserveToken;   // reserve token address
        uint256 poolAmount;         // pool token amount
        uint256 reserveAmount;      // reserve token amount
        uint256 reserveRateN;       // rate of 1 protected reserve token in units of the other reserve token (numerator)
        uint256 reserveRateD;       // rate of 1 protected reserve token in units of the other reserve token (denominator)
        uint256 timestamp;          // timestamp
    }

    IERC20Token internal constant ETH_RESERVE_ADDRESS = IERC20Token(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE);
    uint32 internal constant PPM_RESOLUTION = 1000000;
    uint256 internal constant MAX_UINT128 = 0xffffffffffffffffffffffffffffffff;

    // the address of the whitelist administrator
    address public whitelistAdmin;

    ILiquidityProtectionStore public immutable store;
    IDSToken public immutable networkToken;
    IDSToken public immutable govToken;

    // system network token balance limits
    uint256 public maxSystemNetworkTokenAmount = 500000e18;
    uint32 public maxSystemNetworkTokenRatio = 500000; // PPM units

    // number of seconds until any protection is in effect
    uint256 public minProtectionDelay = 30 days;

    // number of seconds until full protection is in effect
    uint256 public maxProtectionDelay = 100 days;

    // minimum amount of network tokens the system can mint as compensation for base token losses, default = 0.01 network tokens
    uint256 public minNetworkCompensation = 1e16;

    // number of seconds from liquidation to full network token release
    uint256 public lockDuration = 24 hours;

    // maximum deviation of the average rate from the actual rate
    uint32 public averageRateMaxDeviation = 20000; // PPM units

    // true if the contract is currently adding/removing liquidity from a converter, used for accepting ETH
    bool private updatingLiquidity = false;

    /**
      * @dev triggered when whitelist admin is updated
      *
      * @param _prevWhitelistAdmin  previous whitelist admin
      * @param _newWhitelistAdmin   new whitelist admin
    */
    event WhitelistAdminUpdated(
        address indexed _prevWhitelistAdmin,
        address indexed _newWhitelistAdmin
    );

    /**
      * @dev triggered when the system network token balance limits are updated
      *
      * @param _prevMaxSystemNetworkTokenAmount  previous maximum absolute balance in a pool
      * @param _newMaxSystemNetworkTokenAmount   new maximum absolute balance in a pool
      * @param _prevMaxSystemNetworkTokenRatio   previos maximum balance out of the total balance in a pool
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
      * @param _prevMaxProtectionDelay  previos seconds until full protection
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
    event MinNetworkCompensationUpdated(
        uint256 _prevMinNetworkCompensation,
        uint256 _newMinNetworkCompensation
    );

    /**
      * @dev triggered when the network token lock duration is updated
      *
      * @param _prevLockDuration  previous network token lock duration, in seconds
      * @param _newLockDuration   new network token lock duration, in seconds
    */
    event LockDurationUpdated(
        uint256 _prevLockDuration,
        uint256 _newLockDuration
    );

    /**
      * @dev triggered when the maximum deviation of the average rate from the actual rate is updated
      *
      * @param _prevAverageRateMaxDeviation previous maximum deviation of the average rate from the actual rate
      * @param _newAverageRateMaxDeviation  new maximum deviation of the average rate from the actual rate
    */
    event AverageRateMaxDeviationUpdated(
        uint32 _prevAverageRateMaxDeviation,
        uint32 _newAverageRateMaxDeviation
    );

    /**
      * @dev initializes a new LiquidityProtection contract
      *
      * @param _store           liquidity protection store
      * @param _networkToken    network token 
      * @param _govToken        governance token
      * @param _registry        contract registry
    */
    constructor(
        ILiquidityProtectionStore _store,
        IDSToken _networkToken,
        IDSToken _govToken,
        IContractRegistry _registry)
        ContractRegistryClient(_registry)
        public
        validAddress(address(_store))
        validAddress(address(_networkToken))
        validAddress(address(_govToken))
        validAddress(address(_registry))
        notThis(address(_store))
        notThis(address(_networkToken))
        notThis(address(_govToken))
        notThis(address(_registry))
    {
        whitelistAdmin = msg.sender;
        store = _store;
        networkToken = _networkToken;
        govToken = _govToken;
    }

    // ensures that the contract is currently removing liquidity from a converter
    modifier updatingLiquidityOnly() {
        _updatingLiquidityOnly();
        _;
    }

    // error message binary size optimization
    function _updatingLiquidityOnly() internal view {
        require(updatingLiquidity, "ERR_NOT_UPDATING_LIQUIDITY");
    }

    /**
      * @dev accept ETH
      * used when removing liquidity from ETH converters
    */
    receive() external payable updatingLiquidityOnly() {
    }

    /**
      * @dev transfers the ownership of the store
      * can only be called by the contract owner
      *
      * @param _newOwner    the new owner of the store
    */
    function transferStoreOwnership(address _newOwner) external ownerOnly {
        store.transferOwnership(_newOwner);
    }

    /**
      * @dev accepts the ownership of the store
      * can only be called by the contract owner
    */
    function acceptStoreOwnership() external ownerOnly {
        store.acceptOwnership();
    }

    /**
      * @dev transfers the ownership of the network token
      * can only be called by the contract owner
      *
      * @param _newOwner    the new owner of the network token
    */
    function transferNetworkTokenOwnership(address _newOwner) external ownerOnly {
        networkToken.transferOwnership(_newOwner);
    }

    /**
      * @dev accepts the ownership of the network token
      * can only be called by the contract owner
    */
    function acceptNetworkTokenOwnership() external ownerOnly {
        networkToken.acceptOwnership();
    }

    /**
      * @dev transfers the ownership of the governance token
      * can only be called by the contract owner
      *
      * @param _newOwner    the new owner of the governance token
    */
    function transferGovTokenOwnership(address _newOwner) external ownerOnly {
        govToken.transferOwnership(_newOwner);
    }

    /**
      * @dev accepts the ownership of the governance token
      * can only be called by the contract owner
    */
    function acceptGovTokenOwnership() external ownerOnly {
        govToken.acceptOwnership();
    }

    /**
      * @dev set the address of the whitelist admin
      * can only be called by the contract owner
      *
      * @param _whitelistAdmin  the address of the new whitelist admin
    */
    function setWhitelistAdmin(address _whitelistAdmin)
        external
        ownerOnly
        validAddress(_whitelistAdmin)
    {
        emit WhitelistAdminUpdated(whitelistAdmin, _whitelistAdmin);

        whitelistAdmin = _whitelistAdmin;
    }

    /**
      * @dev updates the system network token balance limits
      * can only be called by the contract owner
      *
      * @param _maxSystemNetworkTokenAmount  maximum absolute balance in a pool
      * @param _maxSystemNetworkTokenRatio   maximum balance out of the total balance in a pool (in PPM units)
    */
    function setSystemNetworkTokenLimits(uint256 _maxSystemNetworkTokenAmount, uint32 _maxSystemNetworkTokenRatio) external ownerOnly {
        require(_maxSystemNetworkTokenRatio <= PPM_RESOLUTION, "ERR_INVALID_MAX_RATIO");

        emit SystemNetworkTokenLimitsUpdated(maxSystemNetworkTokenAmount, _maxSystemNetworkTokenAmount, maxSystemNetworkTokenRatio,
            _maxSystemNetworkTokenRatio);

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
    function setProtectionDelays(uint256 _minProtectionDelay, uint256 _maxProtectionDelay) external ownerOnly {
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
    function setMinNetworkCompensation(uint256 _minCompensation) external ownerOnly {
        emit MinNetworkCompensationUpdated(minNetworkCompensation, _minCompensation);

        minNetworkCompensation = _minCompensation;
    }

    /**
      * @dev updates the network token lock duration
      * can only be called by the contract owner
      *
      * @param _lockDuration    network token lock duration, in seconds
    */
    function setLockDuration(uint256 _lockDuration) external ownerOnly {
        emit LockDurationUpdated(lockDuration, _lockDuration);

        lockDuration = _lockDuration;
    }

    /**
      * @dev sets the maximum deviation of the average rate from the actual rate
      * can only be called by the contract owner
      *
      * @param _averageRateMaxDeviation maximum deviation of the average rate from the actual rate
    */
    function setAverageRateMaxDeviation(uint32 _averageRateMaxDeviation) external ownerOnly {
        require(_averageRateMaxDeviation <= PPM_RESOLUTION, "ERR_INVALID_MAX_DEVIATION");
        emit AverageRateMaxDeviationUpdated(averageRateMaxDeviation, _averageRateMaxDeviation);

        averageRateMaxDeviation = _averageRateMaxDeviation;
    }

    /**
      * @dev adds a pool to the whitelist, or removes a pool from the whitelist
      * note that when a pool is whitelisted, it's not possible to remove liquidity anymore
      * removing a pool from the whitelist is an extreme measure in case of a base token compromise etc.
      * can only be called by the whitelist admin
      *
      * @param _poolAnchor  anchor of the pool
      * @param _add         true to add the pool to the whitelist, false to remove it from the whitelist
    */
    function whitelistPool(IConverterAnchor _poolAnchor, bool _add) external {
        require(msg.sender == whitelistAdmin || msg.sender == owner, "ERR_ACCESS_DENIED");

        // verify that the pool is supported
        require(isPoolSupported(_poolAnchor), "ERR_POOL_NOT_SUPPORTED");

        // add or remove the pool to/from the whitelist
        if (_add)
            store.addPoolToWhitelist(_poolAnchor);
        else
            store.removePoolFromWhitelist(_poolAnchor);
    }

    /**
      * @dev checks if protection is supported for the given pool
      * only standard pools are supported (2 reserves, 50%/50% weights)
      * note that the pool should still be whitelisted
      *
      * @param _poolAnchor  anchor of the pool
      * @return true if the pool is supported, false otherwise
    */
    function isPoolSupported(IConverterAnchor _poolAnchor) public view returns (bool) {
        // verify that the pool exists in the registry
        IConverterRegistry converterRegistry = IConverterRegistry(addressOf(CONVERTER_REGISTRY));
        require(converterRegistry.isAnchor(address(_poolAnchor)), "ERR_INVALID_ANCHOR");

        // get the converter
        IConverter converter = IConverter(payable(_poolAnchor.owner()));

        // verify that the converter has 2 reserves
        if (converter.connectorTokenCount() != 2) {
            return false;
        }

        // verify that one of the reserves is the network token
        IERC20Token reserve0Token = converter.connectorTokens(0);
        IERC20Token reserve1Token = converter.connectorTokens(1);
        if (reserve0Token != networkToken && reserve1Token != networkToken) {
            return false;
        }

        // verify that the reserve weights are exactly 50%/50%
        if (converterReserveWeight(converter, reserve0Token) != PPM_RESOLUTION / 2 ||
            converterReserveWeight(converter, reserve1Token) != PPM_RESOLUTION / 2) {
            return false;
        }

        return true;
    }

    /**
      * @dev adds protection to existing pool tokens
      * also mints new governance tokens for the caller
      *
      * @param _poolAnchor  anchor of the pool
      * @param _amount      amount of pool tokens to protect
    */
    function protectLiquidity(IConverterAnchor _poolAnchor, uint256 _amount)
        external
        protected
        greaterThanZero(_amount)
    {
        // verify that the pool is supported
        require(isPoolSupported(_poolAnchor), "ERR_POOL_NOT_SUPPORTED");
        require(store.isPoolWhitelisted(_poolAnchor), "ERR_POOL_NOT_WHITELISTED");

        // get the converter
        IConverter converter = IConverter(payable(_poolAnchor.owner()));

        // protect both reserves
        IDSToken poolToken = IDSToken(address(_poolAnchor));
        protectLiquidity(poolToken, converter, 0, _amount / 2);
        protectLiquidity(poolToken, converter, 1, _amount - _amount / 2);

        // transfer the pool tokens from the caller directly to the store
        safeTransferFrom(poolToken, msg.sender, address(store), _amount);
    }

    /**
      * @dev cancels the protection and returns the pool tokens to the caller
      * also burns governance tokens from the caller
      * must be called with the indices of both the base token and the network token protections
      *
      * @param _id1 id in the caller's list of protected liquidity
      * @param _id2 matching id in the caller's list of protected liquidity
    */
    function unprotectLiquidity(uint256 _id1, uint256 _id2) external protected {
        require(_id1 != _id2, "ERR_SAME_ID");

        ProtectedLiquidity memory liquidity1 = protectedLiquidity(_id1);
        ProtectedLiquidity memory liquidity2 = protectedLiquidity(_id2);

        // verify input & permissions
        require(liquidity1.provider == msg.sender && liquidity2.provider == msg.sender, "ERR_ACCESS_DENIED");

        // verify that the two protections were added together (using `protect`)
        require(
            liquidity1.poolToken == liquidity2.poolToken &&
            liquidity1.reserveToken != liquidity2.reserveToken &&
            (liquidity1.reserveToken == networkToken || liquidity2.reserveToken == networkToken) &&
            liquidity1.timestamp == liquidity2.timestamp &&
            liquidity1.poolAmount <= liquidity2.poolAmount.add(1) &&
            liquidity2.poolAmount <= liquidity1.poolAmount.add(1),
            "ERR_PROTECTIONS_MISMATCH");

        // burn the governance tokens from the caller
        govToken.destroy(msg.sender, liquidity1.reserveToken == networkToken ? liquidity1.reserveAmount : liquidity2.reserveAmount);

        // remove the protected liquidities from the store
        store.removeProtectedLiquidity(_id1);
        store.removeProtectedLiquidity(_id2);

        // transfer the pool tokens back to the caller
        store.withdrawTokens(liquidity1.poolToken, msg.sender, liquidity1.poolAmount.add(liquidity2.poolAmount));
    }

    /**
      * @dev adds protected liquidity to a pool
      * also mints new governance tokens for the caller if the caller adds network tokens
      *
      * @param _poolAnchor      anchor of the pool
      * @param _reserveToken    reserve token to add to the pool
      * @param _amount          amount of tokens to add to the pool
      * @return new protected liquidity id
    */
    function addLiquidity(IConverterAnchor _poolAnchor, IERC20Token _reserveToken, uint256 _amount)
        external
        payable
        protected
        greaterThanZero(_amount)
        returns (uint256)
    {
        // verify that the pool is supported & whitelisted
        require(isPoolSupported(_poolAnchor), "ERR_POOL_NOT_SUPPORTED");
        require(store.isPoolWhitelisted(_poolAnchor), "ERR_POOL_NOT_WHITELISTED");

        if (_reserveToken == networkToken) {
            require(msg.value == 0, "ERR_ETH_AMOUNT_MISMATCH");    
            return addNetworkTokenLiquidity(_poolAnchor, _amount);
        }

        // verify that ETH was passed with the call if needed
        uint256 val = _reserveToken == ETH_RESERVE_ADDRESS ? _amount : 0;
        require(msg.value == val, "ERR_ETH_AMOUNT_MISMATCH");
        return addBaseTokenLiquidity(_poolAnchor, _reserveToken, _amount);
    }

    /**
      * @dev adds protected network token liquidity to a pool
      * also mints new governance tokens for the caller
      *
      * @param _poolAnchor  anchor of the pool
      * @param _amount      amount of tokens to add to the pool
      * @return new protected liquidity id
    */
    function addNetworkTokenLiquidity(IConverterAnchor _poolAnchor, uint256 _amount) internal returns (uint256) {
        IDSToken poolToken = IDSToken(address(_poolAnchor));

        // get the rate between the pool token and the reserve
        Fraction memory tokenRate = poolTokenRate(poolToken, networkToken);

        // calculate the amount of pool tokens based on the amount of reserve tokens
        uint256 poolTokenAmount = _amount.mul(tokenRate.d).div(tokenRate.n);

        // remove the pool tokens from the system's ownership (will revert if not enough tokens are available)
        store.decSystemBalance(poolToken, poolTokenAmount);

        // add protected liquidity for the caller
        uint256 id = addProtectedLiquidity(msg.sender, poolToken, networkToken, poolTokenAmount, _amount);
        
        // burns the network tokens from the caller
        networkToken.destroy(msg.sender, _amount);

        // mint governance tokens to the caller
        govToken.issue(msg.sender, _amount);

        return id;
    }

    /**
      * @dev adds protected base token liquidity to a pool
      *
      * @param _poolAnchor  anchor of the pool
      * @param _baseToken   the base reserve token of the pool
      * @param _amount      amount of tokens to add to the pool
      * @return new protected liquidity id
    */
    function addBaseTokenLiquidity(IConverterAnchor _poolAnchor, IERC20Token _baseToken, uint256 _amount) internal returns (uint256) {
        IDSToken poolToken = IDSToken(address(_poolAnchor));

        // get the reserve balances
        ILiquidityPoolV1Converter converter = ILiquidityPoolV1Converter(payable(_poolAnchor.owner()));
        (uint256 reserveBalanceBase, uint256 reserveBalanceNetwork) = converterReserveBalances(converter, _baseToken, networkToken);

        // calculate and mint the required amount of network tokens for adding liquidity
        uint256 networkLiquidityAmount = _amount.mul(reserveBalanceNetwork).div(reserveBalanceBase);

        // verify network token limits
        // note that the amount is divided by 2 since it's not possible to liquidate one reserve only
        Fraction memory poolRate = poolTokenRate(poolToken, networkToken);
        uint256 newSystemBalance = store.systemBalance(poolToken);
        newSystemBalance = (newSystemBalance.mul(poolRate.n).div(poolRate.d) / 2).add(networkLiquidityAmount);

        require(newSystemBalance <= maxSystemNetworkTokenAmount, "ERR_MAX_AMOUNT_REACHED");
        require(newSystemBalance.mul(PPM_RESOLUTION) <= newSystemBalance.add(reserveBalanceNetwork).mul(maxSystemNetworkTokenRatio), "ERR_MAX_RATIO_REACHED");

        // issue new network tokens to the system
        networkToken.issue(address(this), networkLiquidityAmount);

        // transfer the base tokens from the caller and approve the converter
        ensureAllowance(networkToken, address(converter), networkLiquidityAmount);
        if (_baseToken != ETH_RESERVE_ADDRESS) {
            safeTransferFrom(_baseToken, msg.sender, address(this), _amount);
            ensureAllowance(_baseToken, address(converter), _amount);
        }

        // add liquidity
        addLiquidity(converter, _baseToken, networkToken, _amount, networkLiquidityAmount, msg.value);

        // transfer the new pool tokens to the store
        uint256 poolTokenAmount = poolToken.balanceOf(address(this));
        safeTransfer(poolToken, address(store), poolTokenAmount);

        // the system splits the pool tokens with the caller
        // increase the system's pool token balance and add protected liquidity for the caller
        store.incSystemBalance(poolToken, poolTokenAmount - poolTokenAmount / 2); // account for rounding errors
        return addProtectedLiquidity(msg.sender, poolToken, _baseToken, poolTokenAmount / 2, _amount);
    }

    /**
      * @dev transfers protected liquidity to a new provider
      *
      * @param _id          protected liquidity id
      * @param _newProvider new provider
      * @return new protected liquidity id
    */
    function transferLiquidity(uint256 _id, address _newProvider)
        external
        protected
        validAddress(_newProvider)
        notThis(_newProvider)
        returns (uint256)
    {
        ProtectedLiquidity memory liquidity = protectedLiquidity(_id);

        // verify input & permissions
        require(liquidity.provider == msg.sender, "ERR_ACCESS_DENIED");
        
        // remove the protected liquidity from the current provider
        store.removeProtectedLiquidity(_id);

        // add the protected liquidity to the new provider
        return store.addProtectedLiquidity(
            _newProvider,
            liquidity.poolToken,
            liquidity.reserveToken,
            liquidity.poolAmount,
            liquidity.reserveAmount,
            liquidity.reserveRateN,
            liquidity.reserveRateD,
            liquidity.timestamp);
    }

    /**
      * @dev returns the expected/actual amounts the provider will receive for removing liquidity
      * it's also possible to provide the remove liquidity time to get an estimation
      * for the return at that given point
      *
      * @param _id              protected liquidity id
      * @param _portion         portion of liquidity to remove, in PPM
      * @param _removeTimestamp time at which the liquidity is removed
      * @return expected return amount in the reserve token
      * @return actual return amount in the reserve token
      * @return compensation in the network token
    */
    function removeLiquidityReturn(
        uint256 _id,
        uint32 _portion,
        uint256 _removeTimestamp
    ) external view returns (uint256, uint256, uint256)
    {
        // verify input
        require(_portion > 0 && _portion <= PPM_RESOLUTION, "ERR_INVALID_PERCENT");

        ProtectedLiquidity memory liquidity = protectedLiquidity(_id);

        // verify input
        require(liquidity.provider != address(0), "ERR_INVALID_ID");
        require(_removeTimestamp >= liquidity.timestamp, "ERR_INVALID_TIMESTAMP");

        // calculate the portion of the liquidity to remove
        if (_portion != PPM_RESOLUTION) {
            liquidity.poolAmount = liquidity.poolAmount.mul(_portion).div(PPM_RESOLUTION);
            liquidity.reserveAmount = liquidity.reserveAmount.mul(_portion).div(PPM_RESOLUTION);
        }

        Fraction memory addRate = Fraction({ n: liquidity.reserveRateN, d: liquidity.reserveRateD });
        Fraction memory removeRate = reserveTokenRate(liquidity.poolToken, liquidity.reserveToken);
        uint256 targetAmount = removeLiquidityTargetAmount(
            liquidity.poolToken,
            liquidity.reserveToken,
            liquidity.poolAmount,
            liquidity.reserveAmount,
            addRate,
            removeRate,
            liquidity.timestamp,
            _removeTimestamp);

        // for network token, the return amount is identical to the target amount
        if (liquidity.reserveToken == networkToken) {
            return (targetAmount, targetAmount, 0);
        }

        // handle base token return

        // calculate the amount of pool tokens required for liquidation
        // note that the amount is doubled since it's not possible to liquidate one reserve only
        Fraction memory poolRate = poolTokenRate(liquidity.poolToken, liquidity.reserveToken);
        uint256 poolAmount = targetAmount.mul(poolRate.d).mul(2).div(poolRate.n);

        // limit the amount of pool tokens by the amount the system/caller holds
        uint256 availableBalance = store.systemBalance(liquidity.poolToken).add(liquidity.poolAmount);
        poolAmount = poolAmount > availableBalance ? availableBalance : poolAmount;

        // calculate the base token amount received by liquidating the pool tokens
        // note that the amount is divided by 2 since the pool amount represents both reserves
        uint256 baseAmount = poolAmount.mul(poolRate.n).div(poolRate.d).div(2);
        uint256 networkAmount = 0;

        // calculate the compensation if still needed
        if (baseAmount < targetAmount) {
            uint256 delta = targetAmount - baseAmount;

            // calculate the delta in network tokens
            delta = delta.mul(removeRate.n).div(removeRate.d);

            // the delta might be very small due to precision loss
            // in which case no compensation will take place (gas optimization)
            if (delta >= _minNetworkCompensation()) {
                networkAmount = delta;
            }
        }

        return (targetAmount, baseAmount, networkAmount);
    }

    /**
      * @dev removes protected liquidity from a pool
      * also burns governance tokens from the caller if the caller removes network tokens
      *
      * @param _id      id in the caller's list of protected liquidity
      * @param _portion portion of liquidity to remove, in PPM
    */
    function removeLiquidity(uint256 _id, uint32 _portion) external protected {
        require(_portion > 0 && _portion <= PPM_RESOLUTION, "ERR_INVALID_PERCENT");

        ProtectedLiquidity memory liquidity = protectedLiquidity(_id);
        Fraction memory addRate = Fraction({ n: liquidity.reserveRateN, d: liquidity.reserveRateD });

        // verify input & permissions
        require(liquidity.provider == msg.sender, "ERR_ACCESS_DENIED");

        // verify that the pool is whitelisted
        require(store.isPoolWhitelisted(liquidity.poolToken), "ERR_POOL_NOT_WHITELISTED");

        if (_portion == PPM_RESOLUTION) {
            // remove the pool tokens from the provider
            store.removeProtectedLiquidity(_id);
        }
        else {
            // remove portion of the pool tokens from the provider
            uint256 fullPoolAmount = liquidity.poolAmount;
            uint256 fullReserveAmount = liquidity.reserveAmount;
            liquidity.poolAmount = liquidity.poolAmount.mul(_portion).div(PPM_RESOLUTION);
            liquidity.reserveAmount = liquidity.reserveAmount.mul(_portion).div(PPM_RESOLUTION);

            store.updateProtectedLiquidityAmounts(_id, fullPoolAmount - liquidity.poolAmount, fullReserveAmount - liquidity.reserveAmount);
        }

        // add the pool tokens to the system
        store.incSystemBalance(liquidity.poolToken, liquidity.poolAmount);

        // if removing network token liquidity, burn the governance tokens from the caller
        if (liquidity.reserveToken == networkToken) {
            govToken.destroy(msg.sender, liquidity.reserveAmount);
        }

        // get the current rate between the reserves (recent average)
        Fraction memory currentRate = reserveTokenRate(liquidity.poolToken, liquidity.reserveToken);

        // get the target token amount
        uint256 targetAmount = removeLiquidityTargetAmount(
            liquidity.poolToken,
            liquidity.reserveToken,
            liquidity.poolAmount,
            liquidity.reserveAmount,
            addRate,
            currentRate,
            liquidity.timestamp,
            time());

        // remove network token liquidity
        if (liquidity.reserveToken == networkToken) {
            // mint network tokens for the caller and lock them
            networkToken.issue(address(store), targetAmount);
            lockTokens(msg.sender, targetAmount);
            return;
        }

        // remove base token liquidity

        // calculate the amount of pool tokens required for liquidation
        // note that the amount is doubled since it's not possible to liquidate one reserve only
        Fraction memory poolRate = poolTokenRate(liquidity.poolToken, liquidity.reserveToken);
        uint256 poolAmount = targetAmount.mul(poolRate.d).mul(2).div(poolRate.n);

        // limit the amount of pool tokens by the amount the system holds
        uint256 systemBalance = store.systemBalance(liquidity.poolToken);
        poolAmount = poolAmount > systemBalance ? systemBalance : poolAmount;

        // withdraw the pool tokens from the store
        store.decSystemBalance(liquidity.poolToken, poolAmount);
        store.withdrawTokens(liquidity.poolToken, address(this), poolAmount);

        // remove liquidity
        removeLiquidity(liquidity.poolToken, poolAmount, liquidity.reserveToken, networkToken);

        // transfer the base tokens to the caller
        uint256 baseBalance;
        if (liquidity.reserveToken == ETH_RESERVE_ADDRESS) {
            baseBalance = address(this).balance;
            msg.sender.transfer(baseBalance);
        }
        else {
            baseBalance = liquidity.reserveToken.balanceOf(address(this));
            safeTransfer(liquidity.reserveToken, msg.sender, baseBalance);
        }
        
        // compensate the caller with network tokens if still needed
        if (baseBalance < targetAmount) {
            uint256 delta = targetAmount - baseBalance;

            // calculate the delta in network tokens
            delta = delta.mul(currentRate.n).div(currentRate.d);

            // the delta might be very small due to precision loss
            // in which case no compensation will take place (gas optimization)
            if (delta >= _minNetworkCompensation()) {
                // check if there's enough network token balance, otherwise mint more
                uint256 networkBalance = networkToken.balanceOf(address(this));
                if (networkBalance < delta) {
                    networkToken.issue(address(this), delta - networkBalance);
                }

                // lock network tokens for the caller
                safeTransfer(networkToken, address(store), delta);
                lockTokens(msg.sender, delta);
            }
        }

        // if the contract still holds network token, burn them
        uint256 networkBalance = networkToken.balanceOf(address(this));
        if (networkBalance > 0) {
            networkToken.destroy(address(this), networkBalance);
        }
    }

    /**
      * @dev returns the amount the provider will receive for removing liquidity
      * it's also possible to provide the remove liquidity rate & time to get an estimation
      * for the return at that given point
      *
      * @param _poolToken       pool token
      * @param _reserveToken    reserve token
      * @param _poolAmount      pool token amount when the liquidity was added
      * @param _reserveAmount   reserve token amount that was added
      * @param _addRate         rate of 1 reserve token in the other reserve token units when the liquidity was added
      * @param _removeRate      rate of 1 reserve token in the other reserve token units when the liquidity is removed
      * @param _addTimestamp    time at which the liquidity was added
      * @param _removeTimestamp time at which the liquidity is removed
      * @return amount received for removing liquidity
    */
    function removeLiquidityTargetAmount(
        IDSToken _poolToken,
        IERC20Token _reserveToken,
        uint256 _poolAmount,
        uint256 _reserveAmount,
        Fraction memory _addRate,
        Fraction memory _removeRate,
        uint256 _addTimestamp,
        uint256 _removeTimestamp)
        internal view returns (uint256)
    {
        // get the adjusted amount of reserve tokens based on the exposure and rate changes
        uint256 outputAmount = adjustedAmount(_poolToken, _reserveToken, _poolAmount, _addRate, _removeRate);

        // calculate the protection level
        Fraction memory level = protectionLevel(_addTimestamp, _removeTimestamp);

        // no protection, return the amount as is
        if (level.n == 0) {
            return outputAmount;
        }

        // protection is in effect, calculate loss / compensation
        Fraction memory loss = impLoss(_addRate, _removeRate);
        (uint256 compN, uint256 compD) = Math.reducedRatio(loss.n.mul(level.n), loss.d.mul(level.d), MAX_UINT128);
        return outputAmount.add(_reserveAmount.mul(compN).div(compD));
    }

    /**
      * @dev allows the caller to claim network token balance that is no longer locked
      * note that the function can revert if the range is too large
      *
      * @param _startIndex  start index in the caller's list of locked balances
      * @param _endIndex    end index in the caller's list of locked balances (exclusive)
    */
    function claimBalance(uint256 _startIndex, uint256 _endIndex) external protected {
        // get the locked balances from the store
        (uint256[] memory amounts, uint256[] memory expirationTimes) = store.lockedBalanceRange(
            msg.sender,
            _startIndex,
            _endIndex
        );

        uint256 totalAmount = 0;
        uint256 length = amounts.length;
        assert(length == expirationTimes.length);

        // reverse iteration since we're removing from the list
        for (uint256 i = length; i > 0; i--) {
            uint256 index = i - 1;
            if (expirationTimes[index] > time()) {
                continue;
            }

            // remove the locked balance item
            store.removeLockedBalance(msg.sender, _startIndex + index);
            totalAmount = totalAmount.add(amounts[index]);
        }

        if (totalAmount > 0) {
            // transfer the tokens to the caller in a single call
            store.withdrawTokens(networkToken, msg.sender, totalAmount);
        }
    }

    /**
      * @dev returns the ROI for removing liquidity in the current state after providing liquidity with the given args
      * the function assumes full protection is in effect
      * return value is in PPM and can be larger than PPM_RESOLUTION for positive ROI, 1M = 0% ROI
      *
      * @param _poolToken       pool token
      * @param _reserveToken    reserve token
      * @param _reserveAmount   reserve token amount that was added
      * @param _poolRateN       rate of 1 pool token in reserve token units when the liquidity was added (numerator)
      * @param _poolRateD       rate of 1 pool token in reserve token units when the liquidity was added (denominator)
      * @param _reserveRateN    rate of 1 reserve token in the other reserve token units when the liquidity was added (numerator)
      * @param _reserveRateD    rate of 1 reserve token in the other reserve token units when the liquidity was added (denominator)
      * @return ROI in PPM
    */
    function poolROI(
        IDSToken _poolToken,
        IERC20Token _reserveToken,
        uint256 _reserveAmount,
        uint256 _poolRateN,
        uint256 _poolRateD,
        uint256 _reserveRateN,
        uint256 _reserveRateD
    ) external view returns (uint256)
    {
        // calculate the amount of pool tokens based on the amount of reserve tokens
        uint256 poolAmount = _reserveAmount.mul(_poolRateD).div(_poolRateN);

        // get the add/remove rates
        Fraction memory addRate = Fraction({ n: _reserveRateN, d: _reserveRateD });
        Fraction memory removeRate = reserveTokenRate(_poolToken, _reserveToken);

        // get the current return
        uint256 protectedReturn = removeLiquidityTargetAmount(
            _poolToken,
            _reserveToken,
            poolAmount,
            _reserveAmount,
            addRate,
            removeRate,
            time().sub(maxProtectionDelay),
            time()
        );

        // calculate the ROI as the ratio between the current fully protecteda return and the initial amount
        return protectedReturn.mul(PPM_RESOLUTION).div(_reserveAmount);
    }

    /**
      * @dev utility to protect existing liquidity
      * also mints new governance tokens for the caller when protecting the network token reserve
      *
      * @param _poolAnchor      pool anchor
      * @param _converter       pool converter
      * @param _reserveIndex    index of the reserve to protect
      * @param _poolAmount      amount of pool tokens to protect
    */
    function protectLiquidity(IDSToken _poolAnchor, IConverter _converter, uint256 _reserveIndex, uint256 _poolAmount) internal {
        // get the reserves token
        IERC20Token reserveToken = _converter.connectorTokens(_reserveIndex);

        // get the pool token rate
        IDSToken poolToken = IDSToken(address(_poolAnchor));
        Fraction memory reserveRate = poolTokenRate(poolToken, reserveToken);

        // calculate the reserve balance based on the amount provided and the current pool token rate
        uint256 reserveAmount = _poolAmount.mul(reserveRate.n).div(reserveRate.d);

        // protect the liquidity
        addProtectedLiquidity(msg.sender, poolToken, reserveToken, _poolAmount, reserveAmount);

        // for network token liquidity, mint governance tokens to the caller
        if (reserveToken == networkToken) {
            govToken.issue(msg.sender, reserveAmount);
        }
    }

    /**
      * @dev adds protected liquidity for the caller to the store
      *
      * @param _provider        protected liquidity provider
      * @param _poolToken       pool token
      * @param _reserveToken    reserve token
      * @param _poolAmount      amount of pool tokens to protect
      * @param _reserveAmount   amount of reserve tokens to protect
      * @return new protected liquidity id
    */
    function addProtectedLiquidity(
        address _provider,
        IDSToken _poolToken,
        IERC20Token _reserveToken,
        uint256 _poolAmount,
        uint256 _reserveAmount)
        internal
        returns (uint256)
    {
        Fraction memory rate = reserveTokenRate(_poolToken, _reserveToken);
        return store.addProtectedLiquidity(_provider, _poolToken, _reserveToken, _poolAmount, _reserveAmount, rate.n, rate.d, time());
    }

    /**
      * @dev locks network tokens for the provider and emits the tokens locked event
      *
      * @param _provider    tokens provider
      * @param _amount      amount of network tokens
    */
    function lockTokens(address _provider, uint256 _amount) internal {
        uint256 expirationTime = time().add(lockDuration);
        store.addLockedBalance(_provider, _amount, expirationTime);
    }

    /**
      * @dev returns the rate of 1 pool token in reserve token units
      *
      * @param _poolToken       pool token
      * @param _reserveToken    reserve token
    */
    function poolTokenRate(IDSToken _poolToken, IERC20Token _reserveToken) internal view returns (Fraction memory) {
        // get the pool token supply
        uint256 poolTokenSupply = _poolToken.totalSupply();

        // get the reserve balance
        IConverter converter = IConverter(payable(_poolToken.owner()));
        uint256 reserveBalance = converter.getConnectorBalance(_reserveToken);

        // for standard pools, 50% of the pool supply value equals the value of each reserve
        return Fraction({ n: reserveBalance.mul(2), d: poolTokenSupply });
    }

    /**
      * @dev returns the rate of 1 reserve token in the other reserve token units
      *
      * @param _poolToken       pool token
      * @param _reserveToken    reserve token
    */
    function reserveTokenRate(IDSToken _poolToken, IERC20Token _reserveToken) internal view returns (Fraction memory) {
        ILiquidityPoolV1Converter converter = ILiquidityPoolV1Converter(payable(_poolToken.owner()));

        IERC20Token otherReserve = converter.connectorTokens(0);
        if (otherReserve == _reserveToken) {
            otherReserve = converter.connectorTokens(1);
        }

        (uint256 currentRateN, uint256 currentRateD) = converterReserveBalances(converter, otherReserve, _reserveToken);
        (uint256 n, uint256 d) = converter.recentAverageRate(_reserveToken);

        uint256 min = currentRateN.mul(d).mul(PPM_RESOLUTION - averageRateMaxDeviation).mul(PPM_RESOLUTION - averageRateMaxDeviation);
        uint256 mid = currentRateD.mul(n).mul(PPM_RESOLUTION - averageRateMaxDeviation).mul(PPM_RESOLUTION);
        uint256 max = currentRateN.mul(d).mul(PPM_RESOLUTION).mul(PPM_RESOLUTION);
        require(min <= mid && mid <= max, "ERR_INVALID_RATE");

        return Fraction(n, d);
    }

    /**
      * @dev utility to add liquidity to a converter
      *
      * @param _converter       converter
      * @param _reserveToken1   reserve token 1
      * @param _reserveToken2   reserve token 2
      * @param _reserveAmount1  reserve amount 1
      * @param _reserveAmount2  reserve amount 2
      * @param _value           ETH amount to add
    */
    function addLiquidity(
        ILiquidityPoolV1Converter _converter,
        IERC20Token _reserveToken1,
        IERC20Token _reserveToken2,
        uint256 _reserveAmount1,
        uint256 _reserveAmount2,
        uint256 _value)
        internal
    {
        IERC20Token[] memory reserveTokens = new IERC20Token[](2);
        uint256[] memory amounts = new uint256[](2);
        reserveTokens[0] = _reserveToken1;
        reserveTokens[1] = _reserveToken2;
        amounts[0] = _reserveAmount1;
        amounts[1] = _reserveAmount2;

        // ensure that the contract can receive ETH
        updatingLiquidity = true;
        _converter.addLiquidity{value: _value}(reserveTokens, amounts, 1);
        updatingLiquidity = false;
    }

    /**
      * @dev utility to remove liquidity from a converter
      *
      * @param _poolToken       pool token of the converter
      * @param _poolAmount      amount of pool tokens to remove
      * @param _reserveToken1   reserve token 1
      * @param _reserveToken2   reserve token 2
    */
    function removeLiquidity(
        IDSToken _poolToken,
        uint256 _poolAmount,
        IERC20Token _reserveToken1,
        IERC20Token _reserveToken2)
        internal
    {
        ILiquidityPoolV1Converter converter = ILiquidityPoolV1Converter(payable(_poolToken.owner()));

        IERC20Token[] memory reserveTokens = new IERC20Token[](2);
        uint256[] memory minReturns = new uint256[](2);
        reserveTokens[0] = _reserveToken1;
        reserveTokens[1] = _reserveToken2;
        minReturns[0] = 1;
        minReturns[1] = 1;

        // ensure that the contract can receive ETH
        updatingLiquidity = true;
        converter.removeLiquidity(_poolAmount, reserveTokens, minReturns);
        updatingLiquidity = false;
    }

    /**
      * @dev returns a protected liquidity from the store
      *
      * @param _id  protected liquidity id
      * @return protected liquidity
    */
    function protectedLiquidity(uint256 _id) internal view returns (ProtectedLiquidity memory) {
        ProtectedLiquidity memory liquidity;
        (
            liquidity.provider,
            liquidity.poolToken,
            liquidity.reserveToken,
            liquidity.poolAmount,
            liquidity.reserveAmount,
            liquidity.reserveRateN,
            liquidity.reserveRateD,
            liquidity.timestamp
        ) = store.protectedLiquidity(_id);

        return liquidity;
    }

    /**
      * @dev returns the adjusted amount of reserve tokens based on the exposure and rate changes
      *
      * @param _poolToken       pool token
      * @param _reserveToken    reserve token
      * @param _poolAmount      pool token amount when the liquidity was added
      * @param _addRate         rate of 1 reserve token in the other reserve token units when the liquidity was added
      * @param _removeRate      rate of 1 reserve token in the other reserve token units when the liquidity is removed
      * @return adjusted amount of reserve tokens
    */
    function adjustedAmount(
        IDSToken _poolToken,
        IERC20Token _reserveToken,
        uint256 _poolAmount,
        Fraction memory _addRate,
        Fraction memory _removeRate)
        internal view returns (uint256)
    {
        Fraction memory poolRate = poolTokenRate(_poolToken, _reserveToken);
        Fraction memory poolFactor = poolTokensFactor(_addRate, _removeRate);

        (uint256 poolRateN, uint256 poolRateD) = Math.reducedRatio(_poolAmount.mul(poolRate.n), poolRate.d, MAX_UINT128);
        (uint256 poolFactorN, uint256 poolFactorD) = Math.reducedRatio(poolFactor.n, poolFactor.d, MAX_UINT128);

        return poolRateN.mul(poolFactorN).div(poolRateD.mul(poolFactorD));
    }

    /**
      * @dev returns the impermanent loss incurred due to the change in rates between the reserve tokens
      * the loss is returned in percentages (Fraction)
      *
      * @param _prevRate    previous rate between the reserves
      * @param _newRate     new rate between the reserves
    */
    function impLoss(Fraction memory _prevRate, Fraction memory _newRate) internal pure returns (Fraction memory) {
        uint256 ratioN = _newRate.n.mul(_prevRate.d);
        uint256 ratioD = _newRate.d.mul(_prevRate.n);

        // no need for SafeMath - can't overflow
        uint256 prod = ratioN * ratioD;
        uint256 root = prod / ratioN == ratioD ? Math.floorSqrt(prod) : Math.floorSqrt(ratioN) * Math.floorSqrt(ratioD);
        uint256 sum = ratioN.add(ratioD);
        return Fraction({ n: sum.sub(root.mul(2)), d: sum });
    }

    /**
      * @dev returns the factor that should be applied to the amount of pool tokens based
      * on exposure and change in rates between the reserve tokens
      * the factor is returned in percentages (Fraction)
      *
      * @param _prevRate    previous rate between the reserves
      * @param _newRate     new rate between the reserves
    */
    function poolTokensFactor(Fraction memory _prevRate, Fraction memory _newRate) internal pure returns (Fraction memory) {
        uint256 ratioN = _newRate.n.mul(_prevRate.d);
        uint256 ratioD = _newRate.d.mul(_prevRate.n);
        return Fraction({ n: ratioN.mul(2), d: ratioN.add(ratioD) });
    }

    /**
      * @dev returns the protection level based on the timestamp and protection delays
      * the protection level is returned as a Fraction
      *
      * @param _addTimestamp    time at which the liquidity was added
      * @param _removeTimestamp time at which the liquidity is removed
    */
    function protectionLevel(uint256 _addTimestamp, uint256 _removeTimestamp) internal view returns (Fraction memory) {
        uint256 timeElapsed = _removeTimestamp.sub(_addTimestamp);
        if (timeElapsed < minProtectionDelay) {
            return Fraction({ n: 0, d: 1 });
        }

        if (timeElapsed >= maxProtectionDelay) {
            return Fraction({ n: 1, d: 1 });
        }

        return Fraction({ n: timeElapsed, d: maxProtectionDelay });
    }

    /**
      * @dev utility, checks whether allowance for the given spender exists and approves one if it doesn't.
      * note that we use the non standard erc-20 interface in which `approve` has no return value so that
      * this function will work for both standard and non standard tokens
      *
      * @param _token   token to check the allowance in
      * @param _spender approved address
      * @param _value   allowance amount
    */
    function ensureAllowance(IERC20Token _token, address _spender, uint256 _value) private {
        uint256 allowance = _token.allowance(address(this), _spender);
        if (allowance < _value) {
            if (allowance > 0)
                safeApprove(_token, _spender, 0);
            safeApprove(_token, _spender, _value);
        }
    }

    // utility to get the reserve balances
    function converterReserveBalances(IConverter _converter, IERC20Token _reserveToken1, IERC20Token _reserveToken2) private view returns (uint256, uint256) {
        return (_converter.getConnectorBalance(_reserveToken1), _converter.getConnectorBalance(_reserveToken2));
    }

    // utility to get the reserve weight (including from older converters that don't support the new converterReserveWeight function)
    function converterReserveWeight(IConverter _converter, IERC20Token _reserveToken) private view returns (uint32) {
        (, uint32 weight,,,) = _converter.connectors(_reserveToken);
        return weight;
    }

    bytes4 private constant CONVERTER_VERSION_FUNC_SELECTOR = bytes4(keccak256("version()"));

    // using a static call to identify converter version
    // the function had a different signature in older converters but in the worst case,
    // these converters won't be supported (revert) until they are upgraded
    function converterVersion(IConverter _converter) internal view returns (uint16) {
        bytes memory data = abi.encodeWithSelector(CONVERTER_VERSION_FUNC_SELECTOR);
        (bool success, bytes memory returnData) = address(_converter).staticcall{ gas: 4000 }(data);

        if (success && returnData.length == 32) {
            return abi.decode(returnData, (uint16));
        }

        return 0;
    }

    /**
      * @dev returns minimum network tokens compensation
      * utility to allow overrides for tests
    */
    function _minNetworkCompensation() internal view virtual returns (uint256) {
        return minNetworkCompensation;
    }

    /**
      * @dev returns the current time
      * utility to allow overrides for tests
    */
    function time() internal view virtual returns (uint256) {
        return block.timestamp;
    }
}
