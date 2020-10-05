// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;
import "../../../interfaces/IConverterAnchor.sol";
import "../../../../token/interfaces/IDSToken.sol";

/*
    Pool Tokens Container interface
*/
interface IPoolTokensContainer is IConverterAnchor {
    function poolTokens() external view returns (IDSToken[] memory);
    function createToken() external returns (IDSToken);
    function mint(IDSToken _token, address _to, uint256 _amount) external;
    function burn(IDSToken _token, address _from, uint256 _amount) external;
}
