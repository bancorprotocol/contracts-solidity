pragma solidity 0.4.26;
import './utility/ContractRegistryClient.sol';
import './converter/interfaces/IBancorConverterRegistry.sol';
import './converter/interfaces/IBancorConverter.sol';
import './token/interfaces/ISmartToken.sol';

/**
  * @dev The BancorNetworkPathFinder contract allows generating a conversion path between any token pair in the Bancor Network.
  * The path can then be used in various functions in the BancorNetwork contract.
  *
  * See the BancorNetwork contract for conversion path format.
*/
contract BancorNetworkPathFinder is ContractRegistryClient {
    address public anchorToken;

    /**
      * @dev initializes a new BancorNetworkPathFinder instance
      * 
      * @param _registry address of a contract registry contract
    */
    constructor(IContractRegistry _registry) ContractRegistryClient(_registry) public {
    }

    /**
      * @dev updates the anchor token
      * 
      * @param _anchorToken address of the anchor token
    */
    function setAnchorToken(address _anchorToken) public ownerOnly {
        anchorToken = _anchorToken;
    }

    /**
      * @dev generates and returns the conversion path between a given token pair in the Bancor Network
      * 
      * @param _sourceToken address of the source token
      * @param _targetToken address of the target token
      * 
      * @return path from the source token to the target token
    */
    function generatePath(address _sourceToken, address _targetToken) public view returns (address[] memory) {
        IBancorConverterRegistry converterRegistry = IBancorConverterRegistry(addressOf(BANCOR_CONVERTER_REGISTRY));
        address[] memory sourcePath = getPath(_sourceToken, converterRegistry);
        address[] memory targetPath = getPath(_targetToken, converterRegistry);
        return getShortestPath(sourcePath, targetPath);
    }

    /**
      * @dev generates and returns the conversion path between a given token and the anchor token
      * 
      * @param _token               address of the token
      * @param _converterRegistry   address of the converter registry
      * 
      * @return path from the input token to the anchor token
    */
    function getPath(address _token, IBancorConverterRegistry _converterRegistry) private view returns (address[] memory) {
        if (_token == anchorToken)
            return getInitialArray(_token);

        address[] memory smartTokens;
        if (_converterRegistry.isSmartToken(_token))
            smartTokens = getInitialArray(_token);
        else
            smartTokens = _converterRegistry.getConvertibleTokenSmartTokens(_token);

        for (uint256 n = 0; n < smartTokens.length; n++) {
            IBancorConverter converter = IBancorConverter(ISmartToken(smartTokens[n]).owner());
            uint256 connectorTokenCount = converter.connectorTokenCount();
            for (uint256 i = 0; i < connectorTokenCount; i++) {
                address connectorToken = converter.connectorTokens(i);
                if (connectorToken != _token) {
                    address[] memory path = getPath(connectorToken, _converterRegistry);
                    if (path.length > 0)
                        return getExtendedArray(_token, smartTokens[n], path);
                }
            }
        }

        return new address[](0);
    }

    /**
      * @dev merges two paths with a common suffix into one
      * 
      * @param _sourcePath address of the source path
      * @param _targetPath address of the target path
      * 
      * @return merged path
    */
    function getShortestPath(address[] memory _sourcePath, address[] memory _targetPath) private pure returns (address[] memory) {
        if (_sourcePath.length > 0 && _targetPath.length > 0) {
            uint256 i = _sourcePath.length;
            uint256 j = _targetPath.length;
            while (i > 0 && j > 0 && _sourcePath[i - 1] == _targetPath[j - 1]) {
                i--;
                j--;
            }

            address[] memory path = new address[](i + j + 1);
            for (uint256 m = 0; m <= i; m++)
                path[m] = _sourcePath[m];
            for (uint256 n = j; n > 0; n--)
                path[path.length - n] = _targetPath[n - 1];

            uint256 length = 0;
            for (uint256 p = 0; p < path.length; p += 1) {
                for (uint256 q = p + 2; q < path.length - p % 2; q += 2) {
                    if (path[p] == path[q])
                        p = q;
                }
                path[length++] = path[p];
            }

            return getPartialArray(path, length);
        }

        return new address[](0);
    }

    /**
      * @dev creates a new array containing a single item
      * 
      * @param _item item
      * 
      * @return initial array
    */
    function getInitialArray(address _item) private pure returns (address[] memory) {
        address[] memory array = new address[](1);
        array[0] = _item;
        return array;
    }

    /**
      * @dev prepends two items to the beginning of an array
      * 
      * @param _item0 first item
      * @param _item1 second item
      * @param _array initial array
      * 
      * @return extended array
    */
    function getExtendedArray(address _item0, address _item1, address[] memory _array) private pure returns (address[] memory) {
        address[] memory array = new address[](2 + _array.length);
        array[0] = _item0;
        array[1] = _item1;
        for (uint256 i = 0; i < _array.length; i++)
            array[2 + i] = _array[i];
        return array;
    }

    /**
      * @dev extracts the prefix of a given array
      * 
      * @param _array given array
      * @param _length prefix length
      * 
      * @return partial array
    */
    function getPartialArray(address[] memory _array, uint256 _length) private pure returns (address[] memory) {
        address[] memory array = new address[](_length);
        for (uint256 i = 0; i < _length; i++)
            array[i] = _array[i];
        return array;
    }
}
