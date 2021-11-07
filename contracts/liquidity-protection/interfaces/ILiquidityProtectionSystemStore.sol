// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../../converter/interfaces/IConverterAnchor.sol";

/**
 * @dev Liquidity Protection System Store interface
 */
interface ILiquidityProtectionSystemStore {
    function systemBalance(IERC20 poolToken) external view returns (uint256);

    function incSystemBalance(IERC20 poolToken, uint256 poolAmount) external;

    function decSystemBalance(IERC20 poolToken, uint256 poolAmount) external;

    function networkTokensMinted(IConverterAnchor poolAnchor) external view returns (uint256);

    function incNetworkTokensMinted(IConverterAnchor poolAnchor, uint256 amount) external;

    function decNetworkTokensMinted(IConverterAnchor poolAnchor, uint256 amount) external;
}
