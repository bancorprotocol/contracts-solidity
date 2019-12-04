pragma solidity 0.4.26;
import './utility/ContractRegistryClient.sol';
import './converter/interfaces/IBancorConverterRegistry.sol';
import './converter/interfaces/IBancorConverter.sol';
import './token/interfaces/ISmartTokenController.sol';

/**
  * @dev The BancorNetworkPathFinder contract allows for retrieving the conversion path between any pair of tokens in the Bancor Network.
  * This conversion path can then be used in various functions on the BancorNetwork contract (see this contract for more details on conversion paths).
*/
contract BancorNetworkPathFinder is ContractRegistryClient {
    address public anchorToken;

    bytes4 private constant CONNECTOR_TOKEN_COUNT = bytes4(uint256(keccak256("connectorTokenCount()") >> (256 - 4 * 8)));
    bytes4 private constant RESERVE_TOKEN_COUNT   = bytes4(uint256(keccak256("reserveTokenCount()"  ) >> (256 - 4 * 8)));

    /**
      * @dev initializes a new BancorNetworkPathFinder instance
      * 
      * @param _registry    address of a contract registry contract
    */
    constructor(IContractRegistry _registry) ContractRegistryClient(_registry) public {
        anchorToken = addressOf(BNT_TOKEN);
    }

    /**
      * @dev updates the anchor token to point to the most recent BNT token deployed
      * 
      * Note that this function needs to be called only when the BNT token has been redeployed
    */
    function updateAnchorToken() external {
        address bntToken = addressOf(BNT_TOKEN);
        require(anchorToken != bntToken);
        anchorToken = bntToken;
    }

    /**
      * @dev retrieves the conversion path between a given pair of tokens in the Bancor Network
      * 
      * @param _sourceToken         address of the source token
      * @param _targetToken         address of the target token
      * @param _converterRegistries array of converter registries depicting some part of the network
      * 
      * @return path from the source token to the target token
    */
    function get(address _sourceToken, address _targetToken, IBancorConverterRegistry[] memory _converterRegistries) public view returns (address[] memory) {
        assert(anchorToken == addressOf(BNT_TOKEN));
        address[] memory sourcePath = getPath(_sourceToken, _converterRegistries);
        address[] memory targetPath = getPath(_targetToken, _converterRegistries);
        return getShortestPath(sourcePath, targetPath);
    }

    /**
      * @dev retrieves the conversion path between a given token and the anchor token
      * 
      * @param _token               address of the token
      * @param _converterRegistries array of converter registries depicting some part of the network
      * 
      * @return path from the input token to the anchor token
    */
    function getPath(address _token, IBancorConverterRegistry[] memory _converterRegistries) private view returns (address[] memory) {
        if (_token == anchorToken) {
            address[] memory initialPath = new address[](1);
            initialPath[0] = _token;
            return initialPath;
        }

        uint256 tokenCount;
        uint256 i;
        address token;
        address[] memory path;

        for (uint256 n = 0; n < _converterRegistries.length; n++) {
            IBancorConverter converter = IBancorConverter(_converterRegistries[n].latestConverterAddress(_token));
            tokenCount = getTokenCount(converter, CONNECTOR_TOKEN_COUNT);
            for (i = 0; i < tokenCount; i++) {
                token = converter.connectorTokens(i);
                if (token != _token) {
                    path = getPath(token, _converterRegistries);
                    if (path.length > 0)
                        return getNewPath(path, _token, converter);
                }
            }
            tokenCount = getTokenCount(converter, RESERVE_TOKEN_COUNT);
            for (i = 0; i < tokenCount; i++) {
                token = converter.reserveTokens(i);
                if (token != _token) {
                    path = getPath(token, _converterRegistries);
                    if (path.length > 0)
                        return getNewPath(path, _token, converter);
                }
            }
        }

        return new address[](0);
    }

    /**
      * @dev invokes a function which takes no input arguments and returns a 'uint256' value
      * 
      * @param _dest            address of the contract which implements the function
      * @param _funcSelector    first 4 bytes in the hash of the function signature
      * 
      * @return value returned from calling the input function on the input contract
    */
    function getTokenCount(address _dest, bytes4 _funcSelector) private view returns (uint256) {
        uint256[1] memory ret;
        bytes memory data = abi.encodeWithSelector(_funcSelector);

        assembly {
            pop(staticcall(
                gas,           // gas remaining
                _dest,         // destination address
                add(data, 32), // input buffer (starts after the first 32 bytes in the `data` array)
                mload(data),   // input length (loaded from the first 32 bytes in the `data` array)
                ret,           // output buffer
                32             // output length
            ))
        }

        return ret[0];
    }

    /**
      * @dev prepends two tokens to the beginning of a given path
      * 
      * @param _token       address of the first token
      * @param _converter   converter of the second token
      * 
      * @return extended path
    */
    function getNewPath(address[] memory _path, address _token, IBancorConverter _converter) private view returns (address[] memory) {
        address[] memory newPath = new address[](2 + _path.length);
        newPath[0] = _token;
        newPath[1] = ISmartTokenController(_converter).token();
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
