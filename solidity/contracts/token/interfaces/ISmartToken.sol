// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;
import "./IERC20Token.sol";
import "../../converter/interfaces/IConverterAnchor.sol";
import "../../utility/interfaces/IOwned.sol";

/*
    Smart Token interface
*/
abstract contract ISmartToken is IConverterAnchor, IERC20Token {
    function disableTransfers(bool _disable) public virtual;
    function issue(address _to, uint256 _amount) public virtual;
    function destroy(address _from, uint256 _amount) public virtual;
}
