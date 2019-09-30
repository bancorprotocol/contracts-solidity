pragma solidity 0.4.26;
import './ContractIds.sol';
import './utility/Utils.sol';
import './BancorConverterRegistry.sol';
import './converter/BancorConverter.sol';
import './utility/interfaces/IContractRegistry.sol';

contract BancorNetworkPathFinder is ContractIds, Utils {
    IContractRegistry public contractRegistry;
    address public anchorToken;

    constructor(IContractRegistry _contractRegistry) public validAddress(_contractRegistry) {
        contractRegistry = _contractRegistry;
    }

    function updateAnchorToken() external {
        anchorToken = contractRegistry.addressOf(BNT_TOKEN);
    }

    function get(address _sourceToken, address _targetToken, BancorConverterRegistry[] memory _converterRegistries) public view returns (address[] memory) {
        assert(anchorToken == contractRegistry.addressOf(BNT_TOKEN));
        address[] memory sourcePath = getPath(_sourceToken, _converterRegistries);
        address[] memory targetPath = getPath(_targetToken, _converterRegistries);
        return getShortestPath(sourcePath, targetPath);
    }

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
                for (uint256 i = 0; i < converter.connectorTokenCount(); i++) {
                    address connectorToken = converter.connectorTokens(i);
                    address[] memory path = getPath(connectorToken, _converterRegistries);
                    if (path.length > 0) {
                        address token = converter.token();
                        uint256 newItems = _token == token ? 1 : 2;
                        address[] memory newPath = new address[](newItems + path.length);
                        newPath[0] = _token;
                        newPath[1] = token;
                        for (uint256 k = 0; k < path.length; k++)
                            newPath[newItems + k] = path[k];
                        return newPath;
                    }
                }
            }
        }

        return new address[](0);
    }

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
