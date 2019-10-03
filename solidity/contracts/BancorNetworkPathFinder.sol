pragma solidity 0.4.26;
import './ContractIds.sol';
import './utility/Utils.sol';
import './BancorConverterRegistry.sol';
import './converter/BancorConverter.sol';
import './utility/interfaces/IContractRegistry.sol';

/**
  * @dev The BancorNetworkPathFinder contract allows for retrieving the conversion path between any pair of tokens in the Bancor Network.
  * This conversion path can then be used in various functions on the BancorNetwork contract (see this contract for more details on conversion paths).
*/
contract BancorNetworkPathFinder is ContractIds, Utils {
    IContractRegistry public contractRegistry;
    address public anchorToken;

    /**
      * @dev initializes a new BancorNetworkPathFinder instance
      * 
      * @param _contractRegistry    address of a contract registry contract
    */
    constructor(IContractRegistry _contractRegistry) public validAddress(_contractRegistry) {
        contractRegistry = _contractRegistry;
    }

    /**
      * @dev updates the anchor token to point to the most recent BNT token deployed.
      * 
      * Note that this function needs to be called only when the BNT token has been redeployed.
    */
    function updateAnchorToken() external {
        anchorToken = contractRegistry.addressOf(BNT_TOKEN);
    }

    /**
      * @dev retrieves the conversion path between a given pair of tokens in the Bancor Network
      * 
      * @param _sourceToken         address of the source token
      * @param _targetToken         address of the target token
      * @param _converterRegistries array of converter registries depicting some part of the network
    */
    function get(address _sourceToken, address _targetToken, BancorConverterRegistry[] memory _converterRegistries) public view returns (address[] memory) {
        assert(anchorToken == contractRegistry.addressOf(BNT_TOKEN));
        address[] memory sourcePath = getPath(_sourceToken, _converterRegistries);
        address[] memory targetPath = getPath(_targetToken, _converterRegistries);
        return getShortestPath(sourcePath, targetPath);
    }

    /**
      * @dev retrieves the conversion path between a given token and the anchor token
      * 
      * @param _token               address of the token
      * @param _converterRegistries array of converter registries depicting some part of the network
    */
    function getPath(address _token, BancorConverterRegistry[] memory _converterRegistries) private view returns (address[] memory) {
        if (_token == anchorToken) {
            address[] memory initialPath = new address[](1);
            initialPath[0] = _token;
            return initialPath;
        }

        for (uint256 n = 0; n < _converterRegistries.length; n++) {
            uint256 converterCount = _converterRegistries[n].converterCount(_token);
            if (converterCount > 0) {
                BancorConverter converter = BancorConverter(_converterRegistries[n].converterAddress(_token, uint32(converterCount - 1)));
                uint256 connectorTokenCount = converter.connectorTokenCount();
                for (uint256 i = 0; i < connectorTokenCount; i++) {
                    address connectorToken = converter.connectorTokens(i);
                    address[] memory path = getPath(connectorToken, _converterRegistries);
                    if (path.length > 0) {
                        address[] memory newPath = new address[](2 + path.length);
                        newPath[0] = _token;
                        newPath[1] = converter.token();
                        for (uint256 k = 0; k < path.length; k++)
                            newPath[2 + k] = path[k];
                        return newPath;
                    }
                }
            }
        }

        return new address[](0);
    }

    /**
      * @dev merges two paths with a common suffix into one
      * 
      * @param _sourcePath  address of the source path
      * @param _targetPath  address of the target path
    */
    function getShortestPath(address[] memory _sourcePath, address[] memory _targetPath) private pure returns (address[] memory) {
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
}
