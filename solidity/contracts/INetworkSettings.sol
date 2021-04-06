// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "./token/interfaces/ITokenHolder.sol";

interface INetworkSettings {
    function networkFeeParams() external view returns (ITokenHolder, uint32);

    function networkFeeWallet() external view returns (ITokenHolder);

    function networkFee() external view returns (uint32);
}
