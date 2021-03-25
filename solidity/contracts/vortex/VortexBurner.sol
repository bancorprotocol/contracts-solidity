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

contract VortexBurner is Owned, Utils, ReentrancyGuard, ContractRegistryClient {
    using SafeMath for uint256;
    using Math for uint256;
    using SafeERC20 for IERC20;

    uint32 private constant STANDARD_POOL_RESERVE_WEIGHT = 500000;

    IERC20 private immutable _networkToken;
    IERC20 private immutable _govToken;
    ITokenGovernance public immutable _govTokenGovernance;
    IVortexStats private immutable _stats;
    uint32 private _burnIncentiveFee;
    uint256 private _maxBurnIncentiveFeeAmount;

    // ensures that the fee is valid
    modifier validFee(uint32 fee) {
        _validFee(fee);
        _;
    }

    // error message binary size optimization
    function _validFee(uint32 fee) internal pure {
        require(fee <= PPM_RESOLUTION, "ERR_INVALID_FEE");
    }

    event BurnIncentiveFeeUpdated(
        uint32 prevBurnIncentiveFee,
        uint32 newBurnIncentiveFee,
        uint256 prevMaxBurnIncentiveFeeAmount,
        uint256 newMaxBurnIncentiveFeeAmount
    );

    event Burned(IERC20[] tokens, uint256[] amounts, uint256[] conversionAmounts, uint256 totalBurnedAmount);

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

    receive() external payable {}

    function stats() external view returns (IVortexStats) {
        return _stats;
    }

    function burnIncentiveFee() external view returns (uint32, uint256) {
        return (_burnIncentiveFee, _maxBurnIncentiveFeeAmount);
    }

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
                // the amount to burn.
                //
                // Please note that networkTokenConversionAmounts[i] will remain 0 in this case.
                totalGovTokenAmountToBurn = totalGovTokenAmountToBurn.add(amount);
            } else if (token == _networkToken) {
                // if the source token is the network token, don't try to convert it, but rather add its amount to the
                // total amount to convert to the governance token.
                grossNetworkTokenConversionAmount = grossNetworkTokenConversionAmount.add(amount);

                networkTokenConversionAmounts[i] = amount;
            } else {
                if (token != NATIVE_TOKEN_ADDRESS) {
                    // if the source token is a regular token, approve the converter to withdraw the token amount
                    ensureAllowance(token, network, amount);
                } else {
                    // if the source token is actually an ETH reserve, make sure to pass its value to the network.
                    value = amount;
                }

                // perform the actual conversion and optionally send ETH to the network
                uint256 networkTokenConversionAmount =
                    network.convertByPath2{ value: value }(path, amount, 1, address(this));

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

        _stats.setLastVortexTime(block.timestamp);
        _stats.incTotalBurnedAmount(totalGovTokenAmountToBurn);

        // burn all the converter governance tokens
        _govTokenGovernance.burn(totalGovTokenAmountToBurn);

        // transfer the incentive fee to the caller
        _networkToken.transfer(msg.sender, incentiveFeeAmount);

        emit Burned(tokens, amounts, networkTokenConversionAmounts, totalGovTokenAmountToBurn);
    }

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
        // check for duplicates in order to behave similarly to the vortex function.
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
                // the amount to burn.
                //
                // Please note that networkTokenConversionAmounts[i] will remain 0 in this case.
                totalGovTokenAmountToBurn = totalGovTokenAmountToBurn.add(amount);
            } else if (token == _networkToken) {
                // if the source token is the network token, don't try to convert it, but rather add its amount to the
                // total amount to convert to the governance token.
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

    function transferStatsOwnership(address newOwner) external ownerOnly {
        _stats.transferOwnership(newOwner);
    }

    function acceptStatsOwnership() external ownerOnly {
        _stats.acceptOwnership();
    }

    function transferNetworkFeeWalletOwnership(address newOwner) external ownerOnly {
        networkFeeWallet().transferOwnership(newOwner);
    }

    function acceptNetworkFeeOwnership() external ownerOnly {
        networkFeeWallet().acceptOwnership();
    }

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
            // handled in a special way during the burn itself.
            if (token == _networkToken || token == _govToken) {
                path[1] = address(0);
            } else {
                path[1] = address(networkTokenConverterAnchor(token, registry));
                path[2] = address(_networkToken);
            }

            paths[i] = path;

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

    function applyIncentiveFee(uint256 amount) private view returns (uint256, uint256) {
        uint256 fee = _burnIncentiveFee;
        if (fee == 0) {
            return (amount, 0);
        }

        uint256 incentiveAmount = Math.min(amount.mul(fee).div(PPM_RESOLUTION), _maxBurnIncentiveFeeAmount);

        return (amount.sub(incentiveAmount), incentiveAmount);
    }

    function networkTokenConverterAnchor(IERC20 token, IConverterRegistry converterRegistry)
        private
        view
        returns (IConverterAnchor)
    {
        IERC20[] memory reserveTokens = new IERC20[](2);
        reserveTokens[0] = _networkToken;
        reserveTokens[1] = token;

        uint32[] memory standardReserveWeights = new uint32[](2);
        standardReserveWeights[0] = STANDARD_POOL_RESERVE_WEIGHT;
        standardReserveWeights[1] = STANDARD_POOL_RESERVE_WEIGHT;

        IConverterAnchor anchor = converterRegistry.getLiquidityPoolByConfig(3, reserveTokens, standardReserveWeights);
        require(address(anchor) != address(0), "ERR_INVALID_RESERVE_TOKEN");

        return anchor;
    }

    function ensureAllowance(
        IERC20 token,
        BancorNetwork network,
        uint256 value
    ) private {
        address networkAddress = address(network);
        uint256 allowance = token.allowance(address(this), networkAddress);
        if (allowance < value) {
            if (allowance > 0) {
                token.safeApprove(networkAddress, 0);
            }
            token.safeApprove(networkAddress, value);
        }
    }

    function converterRegistry() private view returns (IConverterRegistry) {
        return IConverterRegistry(addressOf(CONVERTER_REGISTRY));
    }

    function bancorNetwork() private view returns (BancorNetwork) {
        return BancorNetwork(payable(addressOf(BANCOR_NETWORK)));
    }

    function networkSetting() private view returns (INetworkSettings) {
        return INetworkSettings(addressOf(NETWORK_SETTINGS));
    }

    function networkFeeWallet() private view returns (ITokenHolder) {
        return ITokenHolder(networkSetting().networkFeeWallet());
    }

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
