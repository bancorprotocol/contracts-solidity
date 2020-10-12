// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;
import "../../converter/interfaces/IConverterAnchor.sol";
import "../../token/interfaces/IDSToken.sol";
import "../../token/interfaces/IERC20Token.sol";
import "../../utility/interfaces/IOwned.sol";

/*
    Liquidity Protection Store interface
*/
interface ILiquidityProtectionStore is IOwned {
    function addPoolToWhitelist(IConverterAnchor _anchor) external;
    function removePoolFromWhitelist(IConverterAnchor _anchor) external;
    function isPoolWhitelisted(IConverterAnchor _anchor) external view returns (bool);

    function withdrawTokens(IERC20Token _token, address _to, uint256 _amount) external;

    function protectedLiquidity(uint256 _id)
        external
        view
        returns (address, IDSToken, IERC20Token, uint256, uint256, uint256, uint256, uint256);

    function addProtectedLiquidity(
        address _provider,
        IDSToken _poolToken,
        IERC20Token _reserveToken,
        uint256 _poolAmount,
        uint256 _reserveAmount,
        uint256 _reserveRateN,
        uint256 _reserveRateD,
        uint256 _timestamp
    ) external returns (uint256);

    function updateProtectedLiquidityAmounts(uint256 _id, uint256 _poolNewAmount, uint256 _reserveNewAmount) external;
    function removeProtectedLiquidity(uint256 _id) external;
    
    function lockedBalance(address _provider, uint256 _index) external view returns (uint256, uint256);
    function lockedBalanceRange(address _provider, uint256 _startIndex, uint256 _endIndex) external view returns (uint256[] memory, uint256[] memory);

    function addLockedBalance(address _provider, uint256 _reserveAmount, uint256 _expirationTime) external returns (uint256);
    function removeLockedBalance(address _provider, uint256 _index) external;

    function systemBalance(IERC20Token _poolToken) external view returns (uint256);
    function incSystemBalance(IERC20Token _poolToken, uint256 _poolAmount) external;
    function decSystemBalance(IERC20Token _poolToken, uint256 _poolAmount ) external;
}
