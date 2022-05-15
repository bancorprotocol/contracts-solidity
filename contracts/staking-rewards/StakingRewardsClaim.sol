// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.8.13;

import { MerkleProof } from "@openzeppelin/contracts-4.6.0/utils/cryptography/MerkleProof.sol";
import { IERC20 } from "@openzeppelin/contracts-4.6.0/token/ERC20/IERC20.sol";

interface ITokenGovernance {
    function token() external view returns (IERC20);

    function mint(address to, uint256 amount) external;
}

interface IBancorNetworkV3 {
    function depositFor(
        address provider,
        address pool,
        uint256 tokenAmount
    ) external payable returns (uint256);
}

/**
 * @dev this contract allows claiming/staking V2.1 pending rewards
 */
contract StakingRewardsClaim {
    error AccessDenied();
    error AlreadyClaimed();
    error InvalidAddress();
    error InvalidClaim();
    error ZeroValue();

    // the V3 network contract
    IBancorNetworkV3 private immutable _networkV3;

    // the address of the BNT token governance
    ITokenGovernance private immutable _bntGovernance;

    // the address of the BNT token
    IERC20 private immutable _bnt;

    // the merkle root of the pending rewards merkle tree
    bytes32 private immutable _merkleRoot;

    // the total claimed amount
    uint256 private _totalClaimed;

    // a mapping of providers which have already claimed their rewards
    mapping(address => bool) private _claimed;

    /**
     * @dev triggered when rewards are claimed
     */
    event RewardsClaimed(address indexed provider, uint256 amount);

    /**
     * @dev triggered when rewards are staked
     */
    event RewardsStaked(address indexed provider, uint256 amount);

    modifier validAddress(address addr) {
        _validAddress(addr);

        _;
    }

    modifier greaterThanZero(uint256 value) {
        _greaterThanZero(value);

        _;
    }

    /**
     * @dev initializes the merkle-tree rewards airdrop contract
     */
    constructor(
        IBancorNetworkV3 initNetworkV3,
        ITokenGovernance initBNTGovernance,
        bytes32 initMerkleRoot
    ) validAddress(address(initNetworkV3)) validAddress(address(initBNTGovernance)) {
        _networkV3 = initNetworkV3;
        _bntGovernance = initBNTGovernance;
        _bnt = initBNTGovernance.token();

        _merkleRoot = initMerkleRoot;
    }

    /**
     * @dev returns the merkle root of the pending rewards merkle tree
     */
    function merkleRoot() external view returns (bytes32) {
        return _merkleRoot;
    }

    /**
     * @dev returns the total claimed amount
     */
    function totalClaimed() external view returns (uint256) {
        return _totalClaimed;
    }

    /**
     * @dev returns whether providers have already claimed their rewards
     */
    function hasClaimed(address provider) external view returns (bool) {
        return _claimed[provider];
    }

    /**
     * @dev claims rewards by providing a merkle proof (a { provider, amount } leaf and a merkle path)
     *
     * requirements:
     *
     * - the claim can be only made by the beneficiary of the reward
     */
    function claimRewards(
        address provider,
        uint256 fullAmount,
        bytes32[] calldata proof
    ) external greaterThanZero(fullAmount) {
        _claimRewards(msg.sender, provider, fullAmount, proof, false);
    }

    /**
     * @dev claims rewards by providing a merkle proof (a { provider, amount } leaf and a merkle path) and stakes them
     * in V3
     *
     * requirements:
     *
     * - the claim can be only made by the beneficiary of the reward
     */
    function stakeRewards(
        address provider,
        uint256 fullAmount,
        bytes32[] calldata proof
    ) external greaterThanZero(fullAmount) {
        _claimRewards(msg.sender, provider, fullAmount, proof, true);
    }

    /**
     * @dev claims or stakes rewards
     */
    function _claimRewards(
        address caller,
        address provider,
        uint256 fullAmount,
        bytes32[] calldata proof,
        bool stake
    ) private {
        // allow users to opt-it for receiving their rewards
        if (caller != provider) {
            revert AccessDenied();
        }

        // ensure that the user can't claim or stake rewards twice
        if (_claimed[provider]) {
            revert AlreadyClaimed();
        }

        // ensure that the claim is valid
        bytes32 leaf = keccak256(abi.encodePacked(provider, fullAmount));
        if (!MerkleProof.verify(proof, _merkleRoot, leaf)) {
            revert InvalidClaim();
        }

        _claimed[provider] = true;
        _totalClaimed += fullAmount;

        if (stake) {
            // mint the full rewards to the contract itself and deposit them on behalf of the provider
            _bntGovernance.mint(address(this), fullAmount);

            _bnt.approve(address(_networkV3), fullAmount);
            _networkV3.depositFor(provider, address(_bnt), fullAmount);

            emit RewardsStaked(provider, fullAmount);
        } else {
            // mint the rewards directly to the provider
            _bntGovernance.mint(provider, fullAmount);

            emit RewardsClaimed(provider, fullAmount);
        }
    }

    /**
     * @dev verifies that a given address is valid
     */
    function _validAddress(address addr) internal pure {
        if (addr == address(0)) {
            revert InvalidAddress();
        }
    }

    /**
     * @dev verifies that a given amount is greater than zero
     */
    function _greaterThanZero(uint256 value) internal pure {
        if (value == 0) {
            revert ZeroValue();
        }
    }
}
