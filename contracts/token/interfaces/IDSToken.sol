// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../../converter/interfaces/IConverterAnchor.sol";
import "../../utility/interfaces/IOwned.sol";

/*
    DSToken interface
*/
interface IDSToken is IConverterAnchor, IERC20 {
    function issue(address _to, uint256 _amount) external;

    function destroy(address _from, uint256 _amount) external;
}
