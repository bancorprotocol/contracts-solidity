pragma solidity 0.4.26;
import '../../token/interfaces/INonStandardERC20.sol';

/*
    Bad Smart Token interface
*/
contract INonStandardSmartToken is INonStandardERC20 {
    function disableTransfers(bool _disable) public;
    function issue(address _to, uint256 _amount) public;
    function destroy(address _from, uint256 _amount) public;
}
