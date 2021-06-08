// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/math/Math.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "@bancor/token-governance/contracts/ITokenGovernance.sol";

import "../converter/interfaces/IConverterRegistry.sol";
import "../converter/interfaces/IConverter.sol";

import "../utility/ContractRegistryClient.sol";
import "../utility/Owned.sol";
import "../utility/Utils.sol";
import "../utility/interfaces/ITokenHolder.sol";

import "../token/ReserveToken.sol";

import "../INetworkSettings.sol";
import "../IBancorNetwork.sol";

/**
 * @dev This contract provides any user to trigger a network fee burning event
 */
contract VortexBurner is Owned, Utils, ReentrancyGuard, ContractRegistryClient {
    using SafeMath for uint256;
    using Math for uint256;
    using ReserveToken for IReserveToken;
    using SafeERC20 for IERC20;
    using SafeERC20Ex for IERC20;

    struct Strategy {
        address[][] paths;
        uint256[] amounts;
        address[] govPath;
    }

    // the mechanism is only designed to work with 50/50 standard pool converters
    uint32 private constant STANDARD_POOL_RESERVE_WEIGHT = PPM_RESOLUTION / 2;

    // the type of the standard pool converter
    uint16 private constant STANDARD_POOL_CONVERTER_TYPE = 3;

    // the address of the network token
    IERC20 private immutable _networkToken;

    // the address of the governance token
    IERC20 private immutable _govToken;

    // the address of the governance token security module
    ITokenGovernance private immutable _govTokenGovernance;

    // the percentage of the converted network tokens to be sent to the caller of the burning event (in units of PPM)
    uint32 private _burnReward;

    // the maximum burn reward to be sent to the caller of the burning event
    uint256 private _maxBurnRewardAmount;

    // stores the total amount of the burned governance tokens
    uint256 private _totalBurnedAmount;

    /**
     * @dev triggered when the burn reward has been changed
     */
    event BurnRewardUpdated(
        uint32 prevBurnReward,
        uint32 newBurnReward,
        uint256 prevMaxBurnRewardAmount,
        uint256 newMaxBurnRewardAmount
    );

    /**
     * @dev triggered during conversion of a single token during the burning event
     */
    event Converted(IReserveToken reserveToken, uint256 sourceAmount, uint256 targetAmount);

    /**
     * @dev triggered after a completed burning event
     */
    event Burned(IReserveToken[] reserveTokens, uint256 sourceAmount, uint256 burnedAmount);

    /**
     * @dev initializes a new VortexBurner contract
     */
    constructor(
        IERC20 networkToken,
        ITokenGovernance govTokenGovernance,
        IContractRegistry registry
    )
        public
        ContractRegistryClient(registry)
        validAddress(address(networkToken))
        validAddress(address(govTokenGovernance))
    {
        _networkToken = networkToken;
        _govTokenGovernance = govTokenGovernance;
        _govToken = govTokenGovernance.token();
    }

    /**
     * @dev ETH receive callback
     */
    receive() external payable {}

    /**
     * @dev returns the burn reward percentage and its maximum amount
     */
    function burnReward() external view returns (uint32, uint256) {
        return (_burnReward, _maxBurnRewardAmount);
    }

    /**
     * @dev allows the owner to set the burn reward percentage and its maximum amount
     *
     * Requirements:
     *
     * - the caller must be the owner of the contract
     */
    function setBurnReward(uint32 newBurnReward, uint256 newMaxBurnRewardAmount)
        external
        ownerOnly
        validFee(newBurnReward)
    {
        emit BurnRewardUpdated(_burnReward, newBurnReward, _maxBurnRewardAmount, newMaxBurnRewardAmount);

        _burnReward = newBurnReward;
        _maxBurnRewardAmount = newMaxBurnRewardAmount;
    }

    /**
     * @dev returns the total amount of the burned governance tokens
     */
    function totalBurnedAmount() external view returns (uint256) {
        return _totalBurnedAmount;
    }

    /**
     * @dev converts the provided tokens to governance tokens and burns them
     */
    function burn(IReserveToken[] calldata reserveTokens) external nonReentrant {
        ITokenHolder feeWallet = _networkFeeWallet();

        // retrieve the burning strategy
        Strategy memory strategy = _burnStrategy(reserveTokens, feeWallet);

        // withdraw all token/ETH amounts to the contract
        feeWallet.withdrawTokensMultiple(reserveTokens, address(this), strategy.amounts);

        // convert all amounts to the network token and record conversion amounts
        IBancorNetwork network = _bancorNetwork();

        for (uint256 i = 0; i < strategy.paths.length; ++i) {
            // avoid empty conversions
            uint256 amount = strategy.amounts[i];
            if (amount == 0) {
                continue;
            }

            address[] memory path = strategy.paths[i];
            IReserveToken reserveToken = IReserveToken(path[0]);
            uint256 value = 0;

            if (address(reserveToken) == address(_networkToken) || address(reserveToken) == address(_govToken)) {
                // if the source token is the network or the governance token, we won't try to convert it, but rather
                // include its amount in either the total amount of tokens to convert or burn.
                continue;
            }

            if (reserveToken.isNativeToken()) {
                // if the source token is actually an ETH reserve, make sure to pass its value to the network
                value = amount;
            } else {
                // if the source token is a regular token, approve the network to withdraw the token amount
                reserveToken.ensureApprove(address(network), amount);
            }

            // perform the actual conversion and optionally send ETH to the network
            uint256 targetAmount = network.convertByPath{ value: value }(path, amount, 1, address(this), address(0), 0);

            emit Converted(reserveToken, amount, targetAmount);
        }

        // calculate the burn reward and reduce it from the total amount to convert
        (uint256 sourceAmount, uint256 burnRewardAmount) = _netNetworkConversionAmounts();

        // in case there are network tokens to burn, convert them to the governance token
        if (sourceAmount > 0) {
            // approve the network to withdraw the network token amount
            _networkToken.ensureApprove(address(network), sourceAmount);

            // convert the entire network token amount to the governance token
            network.convertByPath(strategy.govPath, sourceAmount, 1, address(this), address(0), 0);
        }

        // get the governance token balance
        uint256 govTokenBalance = _govToken.balanceOf(address(this));
        require(govTokenBalance > 0, "ERR_ZERO_BURN_AMOUNT");

        // update the stats of the burning event
        _totalBurnedAmount = _totalBurnedAmount.add(govTokenBalance);

        // burn the entire governance token balance
        _govTokenGovernance.burn(govTokenBalance);

        // if there is a burn reward, transfer it to the caller
        if (burnRewardAmount > 0) {
            _networkToken.transfer(msg.sender, burnRewardAmount);
        }

        emit Burned(reserveTokens, sourceAmount + burnRewardAmount, govTokenBalance);
    }

    /**
     * @dev transfers the ownership of the network fee wallet
     *
     * Requirements:
     *
     * - the caller must be the owner of the contract
     */
    function transferNetworkFeeWalletOwnership(address newOwner) external ownerOnly {
        _networkFeeWallet().transferOwnership(newOwner);
    }

    /**
     * @dev accepts the ownership of he network fee wallet
     */
    function acceptNetworkFeeOwnership() external ownerOnly {
        _networkFeeWallet().acceptOwnership();
    }

    /**
     * @dev returns the burning strategy for the specified tokens
     */
    function _burnStrategy(IReserveToken[] calldata reserveTokens, ITokenHolder feeWallet)
        private
        view
        returns (Strategy memory)
    {
        IConverterRegistry registry = _converterRegistry();

        Strategy memory strategy =
            Strategy({
                paths: new address[][](reserveTokens.length),
                amounts: new uint256[](reserveTokens.length),
                govPath: new address[](3)
            });

        for (uint256 i = 0; i < reserveTokens.length; ++i) {
            IReserveToken reserveToken = reserveTokens[i];

            address[] memory path = new address[](3);
            path[0] = address(reserveToken);

            // don't look up for a converter for either the network or the governance token, since they are going to be
            // handled in a special way during the burn itself
            if (address(reserveToken) != address(_networkToken) && address(reserveToken) != address(_govToken)) {
                path[1] = address(_networkTokenConverterAnchor(reserveToken, registry));
                path[2] = address(_networkToken);
            }

            strategy.paths[i] = path;

            // make sure to retrieve the balance of either an ERC20 or an ETH reserve
            strategy.amounts[i] = reserveToken.balanceOf(address(feeWallet));
        }

        // get the governance token converter path
        strategy.govPath[0] = address(_networkToken);
        strategy.govPath[1] = address(_networkTokenConverterAnchor(IReserveToken(address(_govToken)), registry));
        strategy.govPath[2] = address(_govToken);

        return strategy;
    }

    /**
     * @dev applies the burn reward on the whole balance and returns the net amount and the reward
     */
    function _netNetworkConversionAmounts() private view returns (uint256, uint256) {
        uint256 amount = _networkToken.balanceOf(address(this));
        uint256 burnRewardAmount = Math.min(amount.mul(_burnReward) / PPM_RESOLUTION, _maxBurnRewardAmount);

        return (amount - burnRewardAmount, burnRewardAmount);
    }

    /**
     * @dev finds the converter anchor of the 50/50 standard pool converter between the specified token and the network token
     */
    function _networkTokenConverterAnchor(IReserveToken reserveToken, IConverterRegistry converterRegistry)
        private
        view
        returns (IConverterAnchor)
    {
        // initialize both the source and the target tokens
        IReserveToken[] memory reserveTokens = new IReserveToken[](2);
        reserveTokens[0] = IReserveToken(address(_networkToken));
        reserveTokens[1] = reserveToken;

        // make sure to only look up for 50/50 converters
        uint32[] memory standardReserveWeights = new uint32[](2);
        standardReserveWeights[0] = STANDARD_POOL_RESERVE_WEIGHT;
        standardReserveWeights[1] = STANDARD_POOL_RESERVE_WEIGHT;

        // find the standard pool converter between the specified token and the network token
        IConverterAnchor anchor =
            converterRegistry.getLiquidityPoolByConfig(
                STANDARD_POOL_CONVERTER_TYPE,
                reserveTokens,
                standardReserveWeights
            );
        require(address(anchor) != address(0), "ERR_INVALID_RESERVE_TOKEN");

        return anchor;
    }

    /**
     * @dev returns the converter registry
     */
    function _converterRegistry() private view returns (IConverterRegistry) {
        return IConverterRegistry(_addressOf(CONVERTER_REGISTRY));
    }

    /**
     * @dev returns the network contract
     */
    function _bancorNetwork() private view returns (IBancorNetwork) {
        return IBancorNetwork(payable(_addressOf(BANCOR_NETWORK)));
    }

    /**
     * @dev returns the network settings contract
     */
    function _networkSetting() private view returns (INetworkSettings) {
        return INetworkSettings(_addressOf(NETWORK_SETTINGS));
    }

    /**
     * @dev returns the network fee wallet
     */
    function _networkFeeWallet() private view returns (ITokenHolder) {
        return ITokenHolder(_networkSetting().networkFeeWallet());
    }
}
