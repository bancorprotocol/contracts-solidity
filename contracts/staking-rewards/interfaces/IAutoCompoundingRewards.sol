// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.8.13;

import { IUpgradeable } from "../../utility/interfaces/IUpgradeable.sol";

import { IPoolToken } from "../../pools/interfaces/IPoolToken.sol";

import { Token } from "../../token/Token.sol";

// distribution types
uint8 constant FLAT_DISTRIBUTION = 0;
uint8 constant EXP_DECAY_DISTRIBUTION = 1;

struct ProgramData {
    uint32 startTime;
    uint32 endTime;
    uint32 halfLife;
    uint32 prevDistributionTimestamp;
    IPoolToken poolToken;
    bool isPaused;
    uint8 distributionType;
    uint256 totalRewards;
    uint256 remainingRewards;
}

interface IAutoCompoundingRewards is IUpgradeable {
    /**
     * @dev returns the program data of a pool
     */
    function program(Token pool) external view returns (ProgramData memory);

    /**
     * @dev returns a list of all pools' program data
     */
    function programs() external view returns (ProgramData[] memory);

    /**
     * @dev returns a list of all the pools which have a program associated with them
     */
    function pools() external view returns (address[] memory);

    /**
     * @dev returns the number of programs to auto-process the rewards for
     */
    function autoProcessRewardsCount() external view returns (uint256);

    /**
     * @dev returns whether a program is currently active
     */
    function isProgramActive(Token pool) external view returns (bool);

    /**
     * @dev returns whether the specified program is paused
     */
    function isProgramPaused(Token pool) external view returns (bool);

    /**
     * @dev creates a rewards program with flat distribution for a given pool
     *
     * requirements:
     *
     * - the caller must be the admin of the contract
     * - the pool must not have an active program
     */
    function createFlatProgram(
        Token pool,
        uint256 totalRewards,
        uint32 startTime,
        uint32 endTime
    ) external;

    /**
     * @dev creates a rewards program with exponential-decay distribution for a given pool
     *
     * requirements:
     *
     * - the caller must be the admin of the contract
     * - the pool must not have an active program
     */
    function createExpDecayProgram(
        Token pool,
        uint256 totalRewards,
        uint32 startTime,
        uint32 halfLife
    ) external;

    /**
     * @dev terminates a rewards program
     *
     * requirements:
     *
     * - the caller must be the admin of the contract
     * - the program must be active
     */
    function terminateProgram(Token pool) external;

    /**
     * @dev pauses or resumes a program
     *
     * requirements:
     *
     * - the caller must be the admin of the contract
     */
    function pauseProgram(Token pool, bool pause) external;

    /**
     * @dev processes program rewards based on internal logic, without requiring any input
     */
    function autoProcessRewards() external;

    /**
     * @dev processes program rewards
     */
    function processRewards(Token pool) external;
}
