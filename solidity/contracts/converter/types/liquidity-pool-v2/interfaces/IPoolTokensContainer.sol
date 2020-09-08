// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;
import "../../../interfaces/IConverterAnchor.sol";
import "../../../../token/interfaces/ISmartToken.sol";

/*
    Pool Tokens Container interface
*/
interface IPoolTokensContainer is IConverterAnchor {
    function poolTokens() external view returns (ISmartToken[] memory);
    function createToken() external returns (ISmartToken);
    function mint(ISmartToken _token, address _to, uint256 _amount) external;
    function burn(ISmartToken _token, address _from, uint256 _amount) external;
}
