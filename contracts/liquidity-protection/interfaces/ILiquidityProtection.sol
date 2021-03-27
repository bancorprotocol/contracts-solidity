// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./ILiquidityProtectionStore.sol";
import "./ILiquidityProtectionStats.sol";
import "./ILiquidityProtectionSettings.sol";
import "./ILiquidityProtectionSystemStore.sol";
import "../../utility/interfaces/ITokenHolder.sol";
import "../../converter/interfaces/IConverterAnchor.sol";

/*
    Liquidity Protection interface
*/
interface ILiquidityProtection {
    function store() external view returns (ILiquidityProtectionStore);

    function stats() external view returns (ILiquidityProtectionStats);

    function settings() external view returns (ILiquidityProtectionSettings);

    function systemStore() external view returns (ILiquidityProtectionSystemStore);

    function wallet() external view returns (ITokenHolder);

    function addLiquidityFor(
        address owner,
        IConverterAnchor poolAnchor,
        IERC20 reserveToken,
        uint256 amount
    ) external payable returns (uint256);

    function addLiquidity(
        IConverterAnchor poolAnchor,
        IERC20 reserveToken,
        uint256 amount
    ) external payable returns (uint256);

    function removeLiquidity(uint256 id, uint32 portion) external;
}
