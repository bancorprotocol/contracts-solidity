pragma solidity 0.4.26;
import "../../../interfaces/IConverterAnchor.sol";
import "../../../../token/interfaces/ISmartToken.sol";

/*
    Pool Tokens Container interface
*/
contract IPoolTokensContainer is IConverterAnchor {
    function poolTokens() public view returns (ISmartToken[]);
    function createToken() public returns (ISmartToken);
    function mint(ISmartToken _token, address _to, uint256 _amount) public;
    function burn(ISmartToken _token, address _from, uint256 _amount) public;
}
