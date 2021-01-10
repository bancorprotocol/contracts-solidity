// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;
import "./ILiquidityProtectionStore.sol";
import "./ILiquidityProtectionStats.sol";
import "./ILiquidityProtectionSettings.sol";
import "../../token/interfaces/IERC20Token.sol";
import "../../converter/interfaces/IConverterAnchor.sol";

/*
    Liquidity Protection interface
*/
interface ILiquidityProtection {
    function store() external view returns (ILiquidityProtectionStore);
    function stats() external view returns (ILiquidityProtectionStats);
    function settings() external view returns (ILiquidityProtectionSettings);

    function addLiquidityFor(
        address _owner,
        IConverterAnchor _poolAnchor,
        IERC20Token _reserveToken,
        uint256 _amount
    ) external payable returns (uint256);

    function addLiquidity(
        IConverterAnchor _poolAnchor,
        IERC20Token _reserveToken,
        uint256 _amount
    ) external payable returns (uint256);

    function removeLiquidity(uint256 _id, uint32 _portion) external;
}
