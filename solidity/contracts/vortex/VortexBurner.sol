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
import "../BancorNetwork.sol";

import "./interfaces/IVortexStats.sol";

/**
 * @dev This contract provides any user to perform a vortex
 */
contract VortexBurner is Owned, Utils, ReentrancyGuard, ContractRegistryClient {
    using SafeMath for uint256;
    using Math for uint256;
    using SafeERC20 for IERC20;

    // the vortex is only designed to work with 50/50 standard pool converters
    uint32 private constant STANDARD_POOL_RESERVE_WEIGHT = 500000;

    // the address of the network token
    IERC20 private immutable _networkToken;

    // the address of the governance token
    IERC20 private immutable _govToken;

    // the address of the governance token security module
    ITokenGovernance public immutable _govTokenGovernance;

    // the address of the vortex stats contract
    IVortexStats private immutable _stats;

    // the percentage of the converted network tokens to be sent to the caller of the vortex (in units of PPM)
    uint32 private _burnIncentiveFee;

    // the maximum incentive fee to be sent to the caller of the vortex
    uint256 private _maxBurnIncentiveFeeAmount;

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
     * @dev triggered after a completed vortex
     *
     * @param tokens the converted tokens
     * @param amounts the amounts of the converted tokens
     * @param conversionAmounts the network token amounts the tokens were converted to
     * @param totalBurnedAmount the total burned amount in this vortex
     */
    event Burned(IERC20[] tokens, uint256[] amounts, uint256[] conversionAmounts, uint256 totalBurnedAmount);

    /**
     * @dev initializes a new VortexContract contract
     *
     * @param networkToken the address of the network token
     * @param govTokenGovernance the address of the governance token security module
     * @param stats the address of the vortex stats contract
     * @param burnIncentiveFee the percentage of the converted network tokens to be sent to the caller of the vortex (in units of PPM)
     * @param maxBurnIncentiveFeeAmount the maximum incentive fee to be sent to the caller of the vortex
     * @param registry the address of the contract registry
     */
    constructor(
        IERC20 networkToken,
        ITokenGovernance govTokenGovernance,
        IVortexStats stats,
        uint32 burnIncentiveFee,
        uint256 maxBurnIncentiveFeeAmount,
        IContractRegistry registry
    )
        public
        validAddress(address(networkToken))
        validAddress(address(govTokenGovernance))
        validAddress(address(stats))
        validFee(burnIncentiveFee)
        ContractRegistryClient(registry)
    {
        _networkToken = networkToken;
        _govTokenGovernance = govTokenGovernance;
        _govToken = govTokenGovernance.token();
        _stats = stats;

        _burnIncentiveFee = burnIncentiveFee;
        _maxBurnIncentiveFeeAmount = maxBurnIncentiveFeeAmount;
    }

    // ensures that the fee is valid
    modifier validFee(uint32 fee) {
        _validFee(fee);
        _;
    }

    // error message binary size optimization
    function _validFee(uint32 fee) internal pure {
        require(fee <= PPM_RESOLUTION, "ERR_INVALID_FEE");
    }

    /**
     * @dev ETH receive callback
     */
    receive() external payable {}

    /**
     * @dev returns the address of the vortex stats contract
     *
     * @return the address of the vortex stats contract
     */
    function stats() external view returns (IVortexStats) {
        return _stats;
    }

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
     * @param newBurnIncentiveNetworkFee the percentage of the converted network tokens to be sent to the caller of the vortex (in units of PPM)
     * @param newMaxBurnIncentiveFeeAmount the maximum incentive fee to be sent to the caller of the vortex
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
     * @dev converts the provided tokens to governance tokens and burns them
     *
     * @param tokens the tokens to convert
     */
    function vortex(IERC20[] calldata tokens) external protected {
        ITokenHolder feeWallet = networkFeeWallet();

        // retrieve conversion paths and the amounts to burn
        (address[][] memory paths, uint256[] memory amounts, address[] memory govPath) =
            vortexStrategy(tokens, feeWallet);

        // withdraw all token/ETH amounts to the contract
        feeWallet.withdrawTokensMultiple(tokens, address(this), amounts);

        // convert all amounts to the network token and record conversion amounts
        BancorNetwork network = bancorNetwork();

        uint256[] memory networkTokenConversionAmounts = new uint256[](tokens.length);
        uint256 grossNetworkTokenConversionAmount = 0;
        uint256 totalGovTokenAmountToBurn = 0;

        for (uint256 i = 0; i < paths.length; ++i) {
            // avoid empty conversions
            uint256 amount = amounts[i];
            if (amount == 0) {
                continue;
            }

            address[] memory path = paths[i];
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
                    network.convertByPath2{ value: value }(path, amount, 1, address(this));

                // update network conversion amounts
                networkTokenConversionAmounts[i] = networkTokenConversionAmount;
                grossNetworkTokenConversionAmount = grossNetworkTokenConversionAmount.add(networkTokenConversionAmount);
            }
        }

        // calculate the burn incentive fee and reduce it from the total amount to convert
        (uint256 netNetworkTokenConversionAmount, uint256 incentiveFeeAmount) =
            applyIncentiveFee(grossNetworkTokenConversionAmount);

        // approve the governance token converter to withdraw the network token amount
        ensureAllowance(_networkToken, network, netNetworkTokenConversionAmount);

        // convert all network token amounts to the governance token
        totalGovTokenAmountToBurn = totalGovTokenAmountToBurn.add(
            network.convertByPath2(govPath, netNetworkTokenConversionAmount, 1, address(this))
        );

        // update the stats of the vortex
        _stats.setLastVortexTime(block.timestamp);
        _stats.incTotalBurnedAmount(totalGovTokenAmountToBurn);

        // burn all the converter governance tokens
        _govTokenGovernance.burn(totalGovTokenAmountToBurn);

        // transfer the incentive fee to the caller
        _networkToken.transfer(msg.sender, incentiveFeeAmount);

        emit Burned(tokens, amounts, networkTokenConversionAmounts, totalGovTokenAmountToBurn);
    }

    /**
     * @dev returns the result of the conversion the provided tokens to the governance token and its burn
     *
     * @param tokens the tokens to convert
     *
     * @return the amounts of the converted tokens
     * @return the network token amounts the tokens were converted to
     * @return the total burned amount in this vortex
     * @return the incentive fee resulting from this vortex
     */
    function availableVortex(IERC20[] calldata tokens)
        external
        view
        returns (
            uint256[] memory,
            uint256[] memory,
            uint256,
            uint256
        )
    {
        // check for duplicates in order to behave similarly to the vortex function
        require(!hasDuplicates(tokens), "ERR_INVALID_TOKEN_LIST");

        // retrieve conversion paths and the amounts to burn
        (address[][] memory paths, uint256[] memory amounts, address[] memory govPath) =
            vortexStrategy(tokens, networkFeeWallet());

        // get all network token conversion amounts
        BancorNetwork network = bancorNetwork();

        uint256[] memory networkTokenConversionAmounts = new uint256[](tokens.length);
        uint256 grossNetworkTokenConversionAmount = 0;
        uint256 totalGovTokenAmountToBurn = 0;

        for (uint256 i = 0; i < paths.length; ++i) {
            // avoid empty conversions
            uint256 amount = amounts[i];
            if (amount == 0) {
                continue;
            }

            address[] memory path = paths[i];
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
        (uint256 netNetworkTokenConversionAmount, uint256 incentiveFeeAmount) =
            applyIncentiveFee(grossNetworkTokenConversionAmount);

        // convert all network token amounts to the governance token
        totalGovTokenAmountToBurn = totalGovTokenAmountToBurn.add(
            network.rateByPath(govPath, netNetworkTokenConversionAmount)
        );
        require(totalGovTokenAmountToBurn > 0, "ERR_ZERO_TARGET_AMOUNT");

        return (amounts, networkTokenConversionAmounts, totalGovTokenAmountToBurn, incentiveFeeAmount);
    }

    /**
     * @dev transfers the ownership of the stats
     *
     * @param newOwner the new owner of the stats
     */
    function transferStatsOwnership(address newOwner) external ownerOnly {
        _stats.transferOwnership(newOwner);
    }

    /**
     * @dev accepts the ownership of the stats
     */
    function acceptStatsOwnership() external ownerOnly {
        _stats.acceptOwnership();
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
     * @dev returns the vortex conversion strategy for the specified tokens
     *
     * @param tokens the tokens to convert
     *
     * @return the conversion paths for each of tokens to convert
     * @return the conversion amounts for each of tokens to convert
     * @return the conversion path for the last network to governance tokens conversion
     */
    function vortexStrategy(IERC20[] calldata tokens, ITokenHolder feeWallet)
        private
        view
        returns (
            address[][] memory,
            uint256[] memory,
            address[] memory
        )
    {
        IConverterRegistry registry = converterRegistry();

        // create conversion paths and collect available token amounts
        address[][] memory paths = new address[][](tokens.length);
        uint256[] memory amounts = new uint256[](tokens.length);

        for (uint256 i = 0; i < tokens.length; ++i) {
            IERC20 token = tokens[i];

            address[] memory path = new address[](3);
            path[0] = address(token);

            // don't look up for a converter for either the network or the governance token, since they are going to be
            // handled in a special way during the burn itself
            if (token == _networkToken || token == _govToken) {
                path[1] = address(0);
            } else {
                path[1] = address(networkTokenConverterAnchor(token, registry));
                path[2] = address(_networkToken);
            }

            paths[i] = path;

            // make sure to retrieve the balance of either an ERC20 or an ETH reserve
            if (token == NATIVE_TOKEN_ADDRESS) {
                amounts[i] = address(feeWallet).balance;
            } else {
                amounts[i] = token.balanceOf(address(feeWallet));
            }
        }

        // get the governance token converter path
        address[] memory govPath = new address[](3);
        govPath[0] = address(_networkToken);
        govPath[1] = address(networkTokenConverterAnchor(_govToken, registry));
        govPath[2] = address(_govToken);

        return (paths, amounts, govPath);
    }

    /**
     * @dev applies the burn incentive fee on the provided amount and returns the net amount and the fee
     *
     * @param amount the network tokens amount
     *
     * @return the net amount
     * @return the fee amount
     */
    function applyIncentiveFee(uint256 amount) private view returns (uint256, uint256) {
        uint256 fee = _burnIncentiveFee;

        if (fee == 0) {
            return (amount, 0);
        }

        uint256 incentiveAmount = Math.min(amount.mul(fee).div(PPM_RESOLUTION), _maxBurnIncentiveFeeAmount);

        return (amount.sub(incentiveAmount), incentiveAmount);
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
        IConverterAnchor anchor = converterRegistry.getLiquidityPoolByConfig(3, reserveTokens, standardReserveWeights);
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
        BancorNetwork network,
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
    function bancorNetwork() private view returns (BancorNetwork) {
        return BancorNetwork(payable(addressOf(BANCOR_NETWORK)));
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
