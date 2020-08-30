// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "./interfaces/IChainlinkPriceOracle.sol";

/**
  * @dev Provides the trivial ETH/ETH rate to be used with other TKN/ETH rates
*/
contract ChainlinkETHToETHOracle is IChainlinkPriceOracle {
    int256 private constant ETH_RATE = 1;

    /**
      * @dev returns the trivial ETH/ETH rate.
      *
      * @return always returns the trivial rate of 1
    */
    function latestAnswer() external view override returns (int256) {
        return ETH_RATE;
    }

    /**
      * @dev returns the trivial ETH/ETH update time.
      *
      * @return always returns current block's timestamp
    */
    function latestTimestamp() external view override returns (uint256) {
        return now;
    }
}
