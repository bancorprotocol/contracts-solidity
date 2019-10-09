pragma solidity 0.4.26;
import './ISmartToken.sol';

/*
    Smart Token Controller interface
*/
contract ISmartTokenController {
    function claimTokens(address _from, uint256 _amount) public;
    function token() public view returns (ISmartToken) {this;}
}
