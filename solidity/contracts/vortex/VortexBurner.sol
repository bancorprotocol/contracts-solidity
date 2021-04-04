// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/math/Math.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "@bancor/token-governance/contracts/ITokenGovernance.sol";

import "../converter/interfaces/IConverterRegistry.sol";
import "../converter/interfaces/IConverter.sol";

import "../utility/ContractRegistryClient.sol";
import "../utility/Owned.sol";
import "../utility/Utils.sol";
import "../utility/TokenHolder.sol";
import "../utility/ReentrancyGuard.sol";

import "../INetworkSettings.sol";
import "../IBancorNetwork.sol";

/**
 * @dev This contract provides any user to trigger a network fee burning event
 */
contract VortexBurner is Owned, Utils, ReentrancyGuard, ContractRegistryClient {
    using SafeMath for uint256;
    using Math for uint256;
    using SafeERC20 for IERC20;

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
     *
     * @param prevBurnReward the previous burn reward (in units of PPM)
     * @param newBurnReward the new burn reward (in units of PPM)
     * @param prevMaxBurnRewardAmount the previous maximum burn reward
     * @param newMaxBurnRewardAmount the new maximum burn reward
     */
    event BurnRewardUpdated(
        uint32 prevBurnReward,
        uint32 newBurnReward,
        uint256 prevMaxBurnRewardAmount,
        uint256 newMaxBurnRewardAmount
    );

    /**
     * @dev triggered during conversion of a single token during the burning event
     *
     * @param token the converted token
     * @param sourceAmount the amount of the converted token
     * @param targetAmount the network token amount the token were converted to
     */
    event Converted(IERC20 token, uint256 sourceAmount, uint256 targetAmount);

    /**
     * @dev triggered after a completed burning event
     *
     * @param tokens the converted tokens
     * @param sourceAmount the total network token amount the tokens were converted to
     * @param burnedAmount the total burned amount in the burning event
     */
    event Burned(IERC20[] tokens, uint256 sourceAmount, uint256 burnedAmount);

    /**
     * @dev initializes a new VortexBurner contract
     *
     * @param networkToken the address of the network token
     * @param govTokenGovernance the address of the governance token security module
     * @param registry the address of the contract registry
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
     *
     * @return the burn reward percentage and its maximum amount
     */
    function burnReward() external view returns (uint32, uint256) {
        return (_burnReward, _maxBurnRewardAmount);
    }

    /**
     * @dev allows the owner to set the burn reward percentage and its maximum amount
     *
     * @param newBurnReward the percentage of the converted network tokens to be sent to the caller of the burning event (in units of PPM)
     * @param newMaxBurnRewardAmount the maximum burn reward to be sent to the caller of the burning event
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
     *
     * @return total amount of the burned governance tokens
     */
    function totalBurnedAmount() external view returns (uint256) {
        return _totalBurnedAmount;
    }

    /**
     * @dev converts the provided tokens to governance tokens and burns them
     *
     * @param tokens the tokens to convert
     */
    function burn(IERC20[] calldata tokens) external protected {
        ITokenHolder feeWallet = networkFeeWallet();

        // retrieve the burning strategy
        Strategy memory strategy = burnStrategy(tokens, feeWallet);

        // withdraw all token/ETH amounts to the contract
        feeWallet.withdrawTokensMultiple(tokens, address(this), strategy.amounts);

        // convert all amounts to the network token and record conversion amounts
        IBancorNetwork network = bancorNetwork();

        for (uint256 i = 0; i < strategy.paths.length; ++i) {
            // avoid empty conversions
            uint256 amount = strategy.amounts[i];
            if (amount == 0) {
                continue;
            }

            address[] memory path = strategy.paths[i];
            IERC20 token = IERC20(path[0]);
            uint256 value = 0;

            if (token == _networkToken || token == _govToken) {
                // if the source token is the network or the governance token, we won't try to convert it, but rather
                // include its amount in either the total amount of tokens to convert or burn.
                continue;
            }

            if (token == NATIVE_TOKEN_ADDRESS) {
                // if the source token is actually an ETH reserve, make sure to pass its value to the network
                value = amount;
            } else {
                // if the source token is a regular token, approve the network to withdraw the token amount
                ensureAllowance(token, network, amount);
            }

            // perform the actual conversion and optionally send ETH to the network
            uint256 targetAmount = network.convertByPath{ value: value }(path, amount, 1, address(this), address(0), 0);

            emit Converted(token, amount, targetAmount);
        }

        // calculate the burn reward and reduce it from the total amount to convert
        (uint256 sourceAmount, uint256 burnRewardAmount) = netNetworkConversionAmounts();

        // in case there are network tokens to burn, convert them to the governance token
        if (sourceAmount > 0) {
            // approve the network to withdraw the network token amount
            ensureAllowance(_networkToken, network, sourceAmount);

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

        emit Burned(tokens, sourceAmount + burnRewardAmount, govTokenBalance);
    }

    /**
     * @dev transfers the ownership of the network fee wallet
     *
     * @param newOwner the new owner of the network fee wallet
     */
    function transferNetworkFeeWalletOwnership(address newOwner) external ownerOnly {
        networkFeeWallet().transferOwnership(newOwner);
    }

    /**
     * @dev accepts the ownership of he network fee wallet
     */
    function acceptNetworkFeeOwnership() external ownerOnly {
        networkFeeWallet().acceptOwnership();
    }

    /**
     * @dev returns the burning strategy for the specified tokens
     *
     * @param tokens the tokens to convert
     *
     * @return the the burning strategy for the specified tokens
     */
    function burnStrategy(IERC20[] calldata tokens, ITokenHolder feeWallet) private view returns (Strategy memory) {
        IConverterRegistry registry = converterRegistry();

        Strategy memory strategy =
            Strategy({
                paths: new address[][](tokens.length),
                amounts: new uint256[](tokens.length),
                govPath: new address[](3)
            });

        for (uint256 i = 0; i < tokens.length; ++i) {
            IERC20 token = tokens[i];

            address[] memory path = new address[](3);
            path[0] = address(token);

            // don't look up for a converter for either the network or the governance token, since they are going to be
            // handled in a special way during the burn itself
            if (token != _networkToken && token != _govToken) {
                path[1] = address(networkTokenConverterAnchor(token, registry));
                path[2] = address(_networkToken);
            }

            strategy.paths[i] = path;

            // make sure to retrieve the balance of either an ERC20 or an ETH reserve
            if (token == NATIVE_TOKEN_ADDRESS) {
                strategy.amounts[i] = address(feeWallet).balance;
            } else {
                strategy.amounts[i] = token.balanceOf(address(feeWallet));
            }
        }

        // get the governance token converter path
        strategy.govPath[0] = address(_networkToken);
        strategy.govPath[1] = address(networkTokenConverterAnchor(_govToken, registry));
        strategy.govPath[2] = address(_govToken);

        return strategy;
    }

    /**
     * @dev applies the burn reward on the whole balance and returns the net amount and the reward
     *
     * @return network token target amount
     * @return burn reward amount
     */
    function netNetworkConversionAmounts() private view returns (uint256, uint256) {
        uint256 amount = _networkToken.balanceOf(address(this));
        uint256 burnRewardAmount = Math.min(amount.mul(_burnReward) / PPM_RESOLUTION, _maxBurnRewardAmount);

        return (amount - burnRewardAmount, burnRewardAmount);
    }

    /**
     * @dev finds the converter anchor of the 50/50 standard pool converter between the specified token and the network token
     *
     * @param token the source token
     * @param converterRegistry the converter registry
     *
     * @return the converter anchor of the 50/50 standard pool converter between the specified token
     */
    function networkTokenConverterAnchor(IERC20 token, IConverterRegistry converterRegistry)
        private
        view
        returns (IConverterAnchor)
    {
        // initialize both the source and the target tokens
        IERC20[] memory reserveTokens = new IERC20[](2);
        reserveTokens[0] = _networkToken;
        reserveTokens[1] = token;

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
     * @dev ensures that the network is able to pull the tokens from this contact
     *
     * @param token the source token
     * @param network the address of the network contract
     * @param amount the token amount to approve
     */
    function ensureAllowance(
        IERC20 token,
        IBancorNetwork network,
        uint256 amount
    ) private {
        address networkAddress = address(network);
        uint256 allowance = token.allowance(address(this), networkAddress);
        if (allowance < amount) {
            if (allowance > 0) {
                token.safeApprove(networkAddress, 0);
            }
            token.safeApprove(networkAddress, amount);
        }
    }

    /**
     * @dev returns the converter registry
     *
     * @return the converter registry
     */
    function converterRegistry() private view returns (IConverterRegistry) {
        return IConverterRegistry(addressOf(CONVERTER_REGISTRY));
    }

    /**
     * @dev returns the network contract
     *
     * @return the network contract
     */
    function bancorNetwork() private view returns (IBancorNetwork) {
        return IBancorNetwork(payable(addressOf(BANCOR_NETWORK)));
    }

    /**
     * @dev returns the network settings contract
     *
     * @return the network settings contract
     */
    function networkSetting() private view returns (INetworkSettings) {
        return INetworkSettings(addressOf(NETWORK_SETTINGS));
    }

    /**
     * @dev returns the network fee wallet
     *
     * @return the network fee wallet
     */
    function networkFeeWallet() private view returns (ITokenHolder) {
        return ITokenHolder(networkSetting().networkFeeWallet());
    }
}
