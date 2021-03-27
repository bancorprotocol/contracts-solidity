// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "./LiquidityProtectionSettings.sol";

contract LiquidityProtectionSettingsMigrator {
    bytes32 private constant ROLE_OWNER = keccak256("ROLE_OWNER");

    constructor(
        IERC20 networkToken,
        IContractRegistry registry,
        IConverterAnchor[] memory pools,
        uint256[] memory limits,
        address admin
    ) public {
        LiquidityProtectionSettings settings = new LiquidityProtectionSettings(networkToken, registry);
        uint256 length = pools.length;
        require(length == limits.length);
        for (uint256 i = 0; i < length; i++) {
            IConverterAnchor pool = pools[i];
            uint256 limit = limits[i];
            settings.addPoolToWhitelist(pool);
            if (limit > 0) {
                settings.setNetworkTokenMintingLimit(pool, limit);
            }
        }
        settings.grantRole(ROLE_OWNER, admin);
        settings.renounceRole(ROLE_OWNER, address(this));
    }
}
