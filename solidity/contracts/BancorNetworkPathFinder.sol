pragma solidity 0.4.26;
import './utility/ContractRegistryClient.sol';
import './converter/interfaces/IBancorConverterRegistry.sol';
import './converter/interfaces/IBancorConverter.sol';
import './token/interfaces/ISmartToken.sol';

/**
  * @dev The BancorNetworkPathFinder contract allows for retrieving the conversion path between any pair of tokens in the Bancor Network.
  * This conversion path can then be used in various functions on the BancorNetwork contract (see this contract for more details on conversion paths).
*/
contract BancorNetworkPathFinder is ContractRegistryClient {
    address public anchorToken;
    address public converterRegistry;

    /**
      * @dev initializes a new BancorNetworkPathFinder instance
      * 
      * @param _registry    address of a contract registry contract
    */
    constructor(IContractRegistry _registry) ContractRegistryClient(_registry) public {
        anchorToken = addressOf(BNT_TOKEN);
        anchorToken = addressOf(BANCOR_CONVERTER_REGISTRY);
    }

    /**
      * @dev updates the anchor token to point to the most recent BNT token deployed
      * 
      * Note that this function needs to be called only when the BNT token has been redeployed
    */
    function updateAnchorToken() external {
        address temp = addressOf(BNT_TOKEN);
        require(anchorToken != temp);
        anchorToken = temp;
    }

    /**
      * @dev updates the converter registry to point to the most recent converter registry deployed
      * 
      * Note that this function needs to be called only when the converter registry has been redeployed
    */
    function updateConverterRegistry() external {
        address temp = addressOf(BANCOR_CONVERTER_REGISTRY);
        require(converterRegistry != temp);
        converterRegistry = temp;
    }

    /**
      * @dev retrieves the conversion path between a given pair of tokens in the Bancor Network
      * 
      * @param _sourceToken address of the source token
      * @param _targetToken address of the target token
      * 
      * @return path from the source token to the target token
    */
    function get(address _sourceToken, address _targetToken) public view returns (address[] memory) {
        assert(anchorToken == addressOf(BNT_TOKEN));
        assert(converterRegistry == addressOf(BANCOR_CONVERTER_REGISTRY));
        address[] memory sourcePath = getPath(_sourceToken);
        address[] memory targetPath = getPath(_targetToken);
        return getShortestPath(sourcePath, targetPath);
    }

    /**
      * @dev retrieves the conversion path between a given token and the anchor token
      * 
      * @param _token   address of the token
      * 
      * @return path from the input token to the anchor token
    */
    function getPath(address _token) private view returns (address[] memory) {
        if (_token == anchorToken) {
            address[] memory initialPath = new address[](1);
            initialPath[0] = _token;
            return initialPath;
        }

        if (IBancorConverterRegistry(converterRegistry).isSmartToken(_token)) {
            IBancorConverter converter = IBancorConverter(ISmartToken(_token).owner());
            uint256 connectorTokenCount = converter.connectorTokenCount();
            for (uint256 i = 0; i < connectorTokenCount; i++) {
                address token = converter.connectorTokens(i);
                if (token != _token) {
                    address[] memory path = getPath(token);
                    if (path.length > 0)
                        return getNewPath(path, _token, _token);
                }
            }
        }

        return new address[](0);
    }

    /**
      * @dev prepends two tokens to the beginning of a given path
      * 
      * @param _token0  address of the 1st token
      * @param _token1  address of the 2nd token
      * 
      * @return extended path
    */
    function getNewPath(address[] memory _path, address _token0, address _token1) private pure returns (address[] memory) {
        address[] memory newPath = new address[](2 + _path.length);
        newPath[0] = _token0;
        newPath[1] = _token1;
        for (uint256 k = 0; k < _path.length; k++)
            newPath[2 + k] = _path[k];
        return newPath;
    }

    /**
      * @dev merges two paths with a common suffix into one
      * 
      * @param _sourcePath  address of the source path
      * @param _targetPath  address of the target path
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
            return path;
        }

        return new address[](0);
    }
}
