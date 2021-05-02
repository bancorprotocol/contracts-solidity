// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./IConverterAnchor.sol";

import "../../utility/interfaces/IOwned.sol";

import "../../token/interfaces/IReserveToken.sol";

/*
    Converter interface
*/
interface IConverter is IOwned {
    function converterType() external pure returns (uint16);

    function anchor() external view returns (IConverterAnchor);

    function isActive() external view returns (bool);

    function targetAmountAndFee(
        IReserveToken sourceToken,
        IReserveToken targetToken,
        uint256 sourceAmount
    ) external view returns (uint256, uint256);

    function convert(
        IReserveToken sourceToken,
        IReserveToken targetToken,
        uint256 sourceAmount,
        address trader,
        address payable beneficiary
    ) external payable returns (uint256);

    function conversionFee() external view returns (uint32);

    function maxConversionFee() external view returns (uint32);

    function reserveBalance(IReserveToken reserveToken) external view returns (uint256);

    receive() external payable;

    function transferAnchorOwnership(address newOwner) external;

    function acceptAnchorOwnership() external;

    function setConversionFee(uint32 fee) external;

    function addReserve(IReserveToken token, uint32 weight) external;

    function transferReservesOnUpgrade(address newConverter) external;

    function onUpgradeComplete() external;

    // deprecated, backward compatibility
    function token() external view returns (IConverterAnchor);

    function transferTokenOwnership(address newOwner) external;

    function acceptTokenOwnership() external;

    function reserveTokenCount() external view returns (uint16);

    function reserveTokens() external view returns (IReserveToken[] memory);

    function connectors(IReserveToken reserveToken)
        external
        view
        returns (
            uint256,
            uint32,
            bool,
            bool,
            bool
        );

    function getConnectorBalance(IReserveToken connectorToken) external view returns (uint256);

    function connectorTokens(uint256 index) external view returns (IReserveToken);

    function connectorTokenCount() external view returns (uint16);

    /**
     * @dev triggered when the converter is activated
     *
     * @param converterType converter type
     * @param anchor converter anchor
     * @param activated true if the converter was activated, false if it was deactivated
     */
    event Activation(uint16 indexed converterType, IConverterAnchor indexed anchor, bool indexed activated);

    /**
     * @dev triggered when a conversion between two tokens occurs
     *
     * @param sourceToken source reserve token
     * @param targetToken target reserve token
     * @param trader wallet that initiated the trade
     * @param sourceAmount input amount in units of the source token
     * @param targetAmount output amount minus conversion fee in units of the target token
     * @param conversionFee conversion fee in units of the target token
     */
    event Conversion(
        IReserveToken indexed sourceToken,
        IReserveToken indexed targetToken,
        address indexed trader,
        uint256 sourceAmount,
        uint256 targetAmount,
        int256 conversionFee
    );

    /**
     * @dev triggered when the rate between two tokens in the converter changes
     * note that the event might be dispatched for rate updates between any two tokens in the converter
     *
     * @param token1 address of the first token
     * @param token2 address of the second token
     * @param rateN rate of 1 unit of `token1` in `token2` (numerator)
     * @param rateD rate of 1 unit of `token1` in `token2` (denominator)
     */
    event TokenRateUpdate(address indexed token1, address indexed token2, uint256 rateN, uint256 rateD);

    /**
     * @dev triggered when the conversion fee is updated
     *
     * @param prevFee previous fee percentage, represented in units of PPM
     * @param newFee new fee percentage, represented in units of PPM
     */
    event ConversionFeeUpdate(uint32 prevFee, uint32 newFee);
}
