// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "./IConversionPathFinder.sol";

import "./utility/ContractRegistryClient.sol";

import "./converter/interfaces/IConverter.sol";
import "./converter/interfaces/IConverterAnchor.sol";
import "./converter/interfaces/IConverterRegistry.sol";

/**
 * @dev This contract allows generating a conversion path between any token pair in the Bancor Network.
 * The path can then be used in various functions in the BancorNetwork contract.
 *
 * See the BancorNetwork contract for conversion path format.
 */
contract ConversionPathFinder is IConversionPathFinder, ContractRegistryClient {
    IERC20 private _anchorToken;

    /**
     * @dev initializes a new ConversionPathFinder instance
     */
    constructor(IContractRegistry registry) public ContractRegistryClient(registry) {}

    /**
     * @dev returns the address of the anchor token
     */
    function anchorToken() external view returns (IERC20) {
        return _anchorToken;
    }

    /**
     * @dev updates the anchor token
     *
     * Requirements:
     *
     * - the caller must be the owner of the contract
     */
    function setAnchorToken(IERC20 newAnchorToken) external ownerOnly {
        _anchorToken = newAnchorToken;
    }

    /**
     * @dev generates a conversion path between a given pair of tokens in the Bancor Network
     */
    function findPath(IReserveToken sourceToken, IReserveToken targetToken)
        external
        view
        override
        returns (address[] memory)
    {
        IConverterRegistry converterRegistry = IConverterRegistry(_addressOf(CONVERTER_REGISTRY));
        address[] memory sourcePath = _getPath(sourceToken, converterRegistry);
        address[] memory targetPath = _getPath(targetToken, converterRegistry);
        return _getShortestPath(sourcePath, targetPath);
    }

    /**
     * @dev generates a conversion path between a given token and the anchor token
     */
    function _getPath(IReserveToken reserveToken, IConverterRegistry converterRegistry)
        private
        view
        returns (address[] memory)
    {
        if (address(reserveToken) == address(_anchorToken)) {
            return _getInitialArray(address(reserveToken));
        }

        address[] memory anchors;
        if (converterRegistry.isAnchor(address(reserveToken))) {
            anchors = _getInitialArray(address(reserveToken));
        } else {
            anchors = converterRegistry.getConvertibleTokenAnchors(reserveToken);
        }

        for (uint256 n = 0; n < anchors.length; n++) {
            IConverter converter = IConverter(payable(IConverterAnchor(anchors[n]).owner()));
            uint256 connectorTokenCount = converter.connectorTokenCount();
            for (uint256 i = 0; i < connectorTokenCount; ++i) {
                IReserveToken connectorToken = converter.connectorTokens(i);
                if (connectorToken != reserveToken) {
                    address[] memory path = _getPath(connectorToken, converterRegistry);
                    if (path.length > 0) {
                        return _getExtendedArray(address(reserveToken), anchors[n], path);
                    }
                }
            }
        }

        return new address[](0);
    }

    /**
     * @dev merges two paths with a common suffix into one
     */
    function _getShortestPath(address[] memory sourcePath, address[] memory targetPath)
        private
        pure
        returns (address[] memory)
    {
        if (sourcePath.length > 0 && targetPath.length > 0) {
            uint256 i = sourcePath.length;
            uint256 j = targetPath.length;
            while (i > 0 && j > 0 && sourcePath[i - 1] == targetPath[j - 1]) {
                i--;
                j--;
            }

            address[] memory path = new address[](i + j + 1);
            for (uint256 m = 0; m <= i; m++) {
                path[m] = sourcePath[m];
            }
            for (uint256 n = j; n > 0; n--) {
                path[path.length - n] = targetPath[n - 1];
            }

            uint256 length = 0;
            for (uint256 p = 0; p < path.length; p += 1) {
                for (uint256 q = p + 2; q < path.length - (p % 2); q += 2) {
                    if (path[p] == path[q]) {
                        p = q;
                    }
                }
                path[length++] = path[p];
            }

            return _getPartialArray(path, length);
        }

        return new address[](0);
    }

    /**
     * @dev creates a new array containing a single item
     */
    function _getInitialArray(address item) private pure returns (address[] memory) {
        address[] memory newArray = new address[](1);
        newArray[0] = item;

        return newArray;
    }

    /**
     * @dev prepends two items to the beginning of an array
     */
    function _getExtendedArray(
        address item0,
        address item1,
        address[] memory array
    ) private pure returns (address[] memory) {
        address[] memory newArray = new address[](2 + array.length);
        newArray[0] = item0;
        newArray[1] = item1;
        for (uint256 i = 0; i < array.length; ++i) {
            newArray[2 + i] = array[i];
        }
        return newArray;
    }

    /**
     * @dev extracts the prefix of a given array
     */
    function _getPartialArray(address[] memory array, uint256 length) private pure returns (address[] memory) {
        address[] memory newArray = new address[](length);
        for (uint256 i = 0; i < length; ++i) {
            newArray[i] = array[i];
        }
        return newArray;
    }
}
