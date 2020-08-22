// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity >=0.6.12 <0.7.0;
import "../../../interfaces/IConverterAnchor.sol";
import "../../../../token/interfaces/ISmartToken.sol";

/*
    Pool Tokens Container interface
*/
contract IPoolTokensContainer is IConverterAnchor {
    function poolTokens() public view returns (ISmartToken[] memory);
    function createToken() public returns (ISmartToken);
    function mint(ISmartToken _token, address _to, uint256 _amount) public;
    function burn(ISmartToken _token, address _from, uint256 _amount) public;
}
