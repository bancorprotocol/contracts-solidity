// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;
import "../../converter/interfaces/IConverterAnchor.sol";
import "../../token/interfaces/IDSToken.sol";
import "../../token/interfaces/IERC20Token.sol";

/*
    Liquidity Protection Stats interface
*/
interface ILiquidityProtectionStats {
    function increaseTotalAmounts(
        address provider,
        IDSToken poolToken,
        IERC20Token reserveToken,
        uint256 poolAmount,
        uint256 reserveAmount
    ) external;

    function decreaseTotalAmounts(
        address provider,
        IDSToken poolToken,
        IERC20Token reserveToken,
        uint256 poolAmount,
        uint256 reserveAmount
    ) external;

    function addProviderPool(address provider, IDSToken poolToken) external returns (bool);

    function removeProviderPool(address provider, IDSToken poolToken) external returns (bool);

    function totalPoolAmount(IDSToken poolToken) external view returns (uint256);

    function totalReserveAmount(IDSToken poolToken, IERC20Token reserveToken) external view returns (uint256);

    function totalProviderAmount(
        address provider,
        IDSToken poolToken,
        IERC20Token reserveToken
    ) external view returns (uint256);

    function providerPools(address provider) external view returns (IDSToken[] memory);
}
