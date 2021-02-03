// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "../utility/Owned.sol";

interface ISettings {
    function addPoolToWhitelist(address pool) external;
    function setNetworkTokenMintingLimit(address pool, uint256 limit) external;
    function renounceRole(bytes32 role, address account) external;
}

contract LiquidityProtectionSettingsMigrator is Owned {
    function migrate(ISettings settings, address[] calldata pools, uint256[] calldata limits) external ownerOnly {
        uint256 length = pools.length;
        require(length == limits.length, "ERR_INVALID_INPUT");
        for (uint256 i = 0; i < length; i++) {
            address pool = pools[i];
            settings.addPoolToWhitelist(pool);
            settings.setNetworkTokenMintingLimit(pool, limits[i]);
        }
        settings.renounceRole(keccak256("ROLE_OWNER"), address(this));
        selfdestruct(payable(owner));
    }
}
