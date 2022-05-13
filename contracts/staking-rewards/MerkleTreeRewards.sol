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
contract MerkleTreeRewards {
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

    // a mapping of accounts which have already claimed their rewards
    mapping(address => bool) private _claimed;

    /**
     * @dev triggered when rewards are claimed
     */
    event RewardsClaimed(address indexed recipient, uint256 amount);

    /**
     * @dev triggered when rewards are staked
     */
    event RewardsStaked(address indexed recipient, uint256 amount);

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
     * @dev returns whether an account has already claimed its rewards
     */
    function hasClaimed(address account) external view returns (bool) {
        return _claimed[account];
    }

    /**
     * @dev claims rewards
     */
    function claimRewards(
        address recipient,
        uint256 amount,
        bytes32[] calldata proof
    ) external validAddress(recipient) greaterThanZero(amount) {
        _claimRewards(msg.sender, recipient, amount, proof, false);
    }

    /**
     * @dev claims rewards and stakes them in V3
     */
    function stakeRewards(
        address recipient,
        uint256 amount,
        bytes32[] calldata proof
    ) external greaterThanZero(amount) {
        _claimRewards(msg.sender, recipient, amount, proof, true);
    }

    /**
     * @dev claims or stakes rewards
     */
    function _claimRewards(
        address caller,
        address recipient,
        uint256 amount,
        bytes32[] calldata proof,
        bool stake
    ) private {
        if (caller != recipient) {
            revert AccessDenied();
        }

        // ensure that the user can't claim or stake rewards twice
        if (_claimed[recipient]) {
            revert AlreadyClaimed();
        }

        // ensure that the claim is correct
        bytes32 leaf = keccak256(abi.encodePacked(recipient, amount));
        if (!MerkleProof.verify(proof, _merkleRoot, leaf)) {
            revert InvalidClaim();
        }

        _claimed[recipient] = true;
        _totalClaimed += amount;

        if (stake) {
            // mint the rewards to the contract itself and deposit them on behalf of the user
            _bntGovernance.mint(address(this), amount);

            _bnt.approve(address(_networkV3), amount);
            _networkV3.depositFor(recipient, address(_bnt), amount);

            emit RewardsStaked(recipient, amount);
        } else {
            // mint the rewards directly to the user
            _bntGovernance.mint(recipient, amount);

            emit RewardsClaimed(recipient, amount);
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
