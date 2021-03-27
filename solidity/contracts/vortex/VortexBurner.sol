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

    struct NetNetworkTokenConversionAmounts {
        uint256 amount;
        uint256 incentiveFeeAmount;
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
    ITokenGovernance public immutable _govTokenGovernance;

    // the percentage of the converted network tokens to be sent to the caller of the burning event (in units of PPM)
    uint32 private _burnIncentiveFee;

    // the maximum incentive fee to be sent to the caller of the burning event
    uint256 private _maxBurnIncentiveFeeAmount;

    // stores the total amount of the burned governance tokens
    uint256 private _totalBurnedAmount;

    /**
     * @dev triggered when the burn incentive fee has been changed
     *
     * @param prevBurnIncentiveFee the previous burn incentive fee (in units of PPM)
     * @param newBurnIncentiveFee the new burn incentive fee (in units of PPM)
     * @param prevMaxBurnIncentiveFeeAmount the previous maximum burn incentive fee
     * @param newMaxBurnIncentiveFeeAmount the new maximum burn incentive fee
     */
    event BurnIncentiveFeeUpdated(
        uint32 prevBurnIncentiveFee,
        uint32 newBurnIncentiveFee,
        uint256 prevMaxBurnIncentiveFeeAmount,
        uint256 newMaxBurnIncentiveFeeAmount
    );

    /**
     * @dev triggered after a completed burning event
     *
     * @param tokens the converted tokens
     * @param amounts the amounts of the converted tokens
     * @param conversionAmounts the network token amounts the tokens were converted to
     * @param totalBurnedAmount the total burned amount in this burning event
     */
    event Burned(IERC20[] tokens, uint256[] amounts, uint256[] conversionAmounts, uint256 totalBurnedAmount);

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
     * @dev returns the burn incentive fee and its maximum amount
     *
     * @return the burn incentive fee and its maximum amount
     */
    function burnIncentiveFee() external view returns (uint32, uint256) {
        return (_burnIncentiveFee, _maxBurnIncentiveFeeAmount);
    }

    /**
     * @dev allows the owner to set the burn incentive fee and its maximum amount
     *
     * @param newBurnIncentiveNetworkFee the percentage of the converted network tokens to be sent to the caller of the burning event (in units of PPM)
     * @param newMaxBurnIncentiveFeeAmount the maximum incentive fee to be sent to the caller of the burning event
     */
    function setBurnIncentiveFee(uint32 newBurnIncentiveNetworkFee, uint256 newMaxBurnIncentiveFeeAmount)
        external
        ownerOnly
        validFee(newBurnIncentiveNetworkFee)
    {
        emit BurnIncentiveFeeUpdated(
            _burnIncentiveFee,
            newBurnIncentiveNetworkFee,
            _maxBurnIncentiveFeeAmount,
            newMaxBurnIncentiveFeeAmount
        );

        _burnIncentiveFee = newBurnIncentiveNetworkFee;
        _maxBurnIncentiveFeeAmount = newMaxBurnIncentiveFeeAmount;
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

        uint256[] memory networkTokenConversionAmounts = new uint256[](tokens.length);
        uint256 grossNetworkTokenConversionAmount = 0;
        uint256 totalGovTokenAmountToBurn = 0;

        for (uint256 i = 0; i < strategy.paths.length; ++i) {
            // avoid empty conversions
            uint256 amount = strategy.amounts[i];
            if (amount == 0) {
                continue;
            }

            address[] memory path = strategy.paths[i];
            IERC20 token = IERC20(path[0]);
            uint256 value = 0;

            if (token == _govToken) {
                // if the source token is the governance token, don't try to convert it either, but rather include it in
                // the amount to burn
                //
                // Please note that networkTokenConversionAmounts[i] will remain 0 in this case
                totalGovTokenAmountToBurn = totalGovTokenAmountToBurn.add(amount);
            } else if (token == _networkToken) {
                // if the source token is the network token, don't try to convert it, but rather add its amount to the
                // total amount to convert to the governance token
                grossNetworkTokenConversionAmount = grossNetworkTokenConversionAmount.add(amount);

                networkTokenConversionAmounts[i] = amount;
            } else {
                if (token != NATIVE_TOKEN_ADDRESS) {
                    // if the source token is a regular token, approve the converter to withdraw the token amount
                    ensureAllowance(token, network, amount);
                } else {
                    // if the source token is actually an ETH reserve, make sure to pass its value to the network
                    value = amount;
                }

                // perform the actual conversion and optionally send ETH to the network
                uint256 networkTokenConversionAmount =
                    network.convertByPath{ value: value }(path, amount, 1, address(this), address(0), 0);

                // update network conversion amounts
                networkTokenConversionAmounts[i] = networkTokenConversionAmount;
                grossNetworkTokenConversionAmount = grossNetworkTokenConversionAmount.add(networkTokenConversionAmount);
            }
        }

        // calculate the burn incentive fee and reduce it from the total amount to convert
        NetNetworkTokenConversionAmounts memory netNetworkTokenConversionAmounts =
            netNetworkConversionAmounts(grossNetworkTokenConversionAmount);

        // approve the governance token converter to withdraw the network token amount
        ensureAllowance(_networkToken, network, netNetworkTokenConversionAmounts.amount);

        // convert all network token amounts to the governance token
        totalGovTokenAmountToBurn = totalGovTokenAmountToBurn.add(
            network.convertByPath(
                strategy.govPath,
                netNetworkTokenConversionAmounts.amount,
                1,
                address(this),
                address(0),
                0
            )
        );

        // update the stats of the burning event
        _totalBurnedAmount = _totalBurnedAmount.add(totalGovTokenAmountToBurn);

        // burn all the converter governance tokens
        _govTokenGovernance.burn(totalGovTokenAmountToBurn);

        // transfer the incentive fee to the caller
        _networkToken.transfer(msg.sender, netNetworkTokenConversionAmounts.incentiveFeeAmount);

        emit Burned(tokens, strategy.amounts, networkTokenConversionAmounts, totalGovTokenAmountToBurn);
    }

    /**
     * @dev returns the result of the conversion the provided tokens to the governance token and its burn
     *
     * @param tokens the tokens to convert
     *
     * @return the amounts of the converted tokens
     * @return the network token amounts the tokens were converted to
     * @return the total burned amount in this burning event
     * @return the incentive fee resulting from this burning event
     */
    function availableForBurning(IERC20[] calldata tokens)
        external
        view
        returns (
            uint256[] memory,
            uint256[] memory,
            uint256,
            uint256
        )
    {
        // check for duplicates in order to behave similarly to the burn function
        require(!hasDuplicates(tokens), "ERR_INVALID_TOKEN_LIST");

        // retrieve the burning strategy
        Strategy memory strategy = burnStrategy(tokens, networkFeeWallet());

        IBancorNetwork network = bancorNetwork();

        uint256[] memory networkTokenConversionAmounts = new uint256[](tokens.length);
        uint256 grossNetworkTokenConversionAmount = 0;
        uint256 totalGovTokenAmountToBurn = 0;

        for (uint256 i = 0; i < strategy.paths.length; ++i) {
            // avoid empty conversions
            uint256 amount = strategy.amounts[i];
            if (amount == 0) {
                continue;
            }

            address[] memory path = strategy.paths[i];
            IERC20 token = IERC20(path[0]);
            if (token == _govToken) {
                // if the source token is the governance token, don't try to convert it either, but rather include it in
                // the amount to burn
                //
                // Please note that networkTokenConversionAmounts[i] will remain 0 in this case
                totalGovTokenAmountToBurn = totalGovTokenAmountToBurn.add(amount);
            } else if (token == _networkToken) {
                // if the source token is the network token, don't try to convert it, but rather add its amount to the
                // total amount to convert to the governance token
                grossNetworkTokenConversionAmount = grossNetworkTokenConversionAmount.add(amount);

                networkTokenConversionAmounts[i] = amount;
            } else {
                // calculate the expected target amount
                uint256 networkTokenConversionAmount = network.rateByPath(path, amount);
                require(networkTokenConversionAmount > 0, "ERR_ZERO_TARGET_AMOUNT");

                networkTokenConversionAmounts[i] = networkTokenConversionAmount;
                grossNetworkTokenConversionAmount = grossNetworkTokenConversionAmount.add(networkTokenConversionAmount);
            }
        }

        // calculate the burn incentive fee and reduce it from the total amount to convert
        NetNetworkTokenConversionAmounts memory netNetworkTokenConversionAmounts =
            netNetworkConversionAmounts(grossNetworkTokenConversionAmount);

        // convert all network token amounts to the governance token
        totalGovTokenAmountToBurn = totalGovTokenAmountToBurn.add(
            network.rateByPath(strategy.govPath, netNetworkTokenConversionAmounts.amount)
        );
        require(totalGovTokenAmountToBurn > 0, "ERR_ZERO_TARGET_AMOUNT");

        return (
            strategy.amounts,
            networkTokenConversionAmounts,
            totalGovTokenAmountToBurn,
            netNetworkTokenConversionAmounts.incentiveFeeAmount
        );
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
     * @dev applies the burn incentive fee on the provided amount and returns the net amount and the fee
     *
     * @param amount the network tokens amount
     *
     * @return the network token conversion and incentive fee amounts
     */
    function netNetworkConversionAmounts(uint256 amount)
        private
        view
        returns (NetNetworkTokenConversionAmounts memory)
    {
        uint256 incentiveFeeAmount =
            Math.min(amount.mul(_burnIncentiveFee) / PPM_RESOLUTION, _maxBurnIncentiveFeeAmount);

        return
            NetNetworkTokenConversionAmounts({
                amount: amount - incentiveFeeAmount,
                incentiveFeeAmount: incentiveFeeAmount
            });
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

    /**
     * @dev returns whether the provided list of tokens include duplicates
     *
     * @param tokens the list of tokens to check
     *
     * @return whether the provided list of tokens include duplicates
     */
    function hasDuplicates(IERC20[] calldata tokens) private pure returns (bool) {
        for (uint256 i = 0; i < tokens.length; ++i) {
            for (uint256 j = i + 1; j < tokens.length; ++j) {
                if (tokens[i] == tokens[j]) {
                    return true;
                }
            }
        }

        return false;
    }
}
