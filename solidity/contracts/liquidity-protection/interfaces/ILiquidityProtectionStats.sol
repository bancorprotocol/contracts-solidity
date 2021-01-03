// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;
import "../../converter/interfaces/IConverterAnchor.sol";
import "../../token/interfaces/IDSToken.sol";
import "../../token/interfaces/IERC20Token.sol";

/*
    Liquidity Protection Stats interface
*/
interface ILiquidityProtectionStats {
    function setTotalProtectedPoolAmount(
        IDSToken _poolToken,
        uint256 _amount
    ) external;

    function setTotalProtectedReserveAmount(
        IDSToken _poolToken,
        IERC20Token _reserveToken,
        uint256 _amount
    ) external;

    function setTotalProtectedProviderAmount(
        IDSToken _poolToken,
        IERC20Token _reserveToken,
        address _provider,
        uint256 _amount
    ) external;
}
