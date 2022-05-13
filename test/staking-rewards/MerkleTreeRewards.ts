import Contracts from '../../components/Contracts';
import {
    ContractRegistry,
    DSToken,
    MerkleTreeRewards,
    TestBancorNetworkV3,
    TokenGovernance,
    TokenHolder
} from '../../typechain';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';
import MerkleTree from 'merkletreejs';

const {
    utils: { id, formatBytes32String, getAddress, solidityKeccak256, keccak256 },
    constants: { AddressZero: ZERO_ADDRESS }
} = ethers;

const ROLE_GOVERNOR = id('ROLE_GOVERNOR');
const ROLE_MINTER = id('ROLE_MINTER');

describe('MerkleTreeRewards', () => {
    let deployer: SignerWithAddress;
    let masterVault: TokenHolder;

    let contractRegistry: ContractRegistry;
    let bancorNetworkV3: TestBancorNetworkV3;
    let bnt: DSToken;
    let bntGovernance: TokenGovernance;

    before(async () => {
        [deployer] = await ethers.getSigners();
    });

    beforeEach(async () => {
        bnt = await Contracts.DSToken.deploy('BNT', 'BNT', 18);
        bntGovernance = await Contracts.TestTokenGovernance.deploy(bnt.address);
        await bntGovernance.grantRole(ROLE_GOVERNOR, deployer.address);
        await bnt.transferOwnership(bntGovernance.address);
        await bntGovernance.acceptTokenOwnership();

        contractRegistry = await Contracts.ContractRegistry.deploy();

        bancorNetworkV3 = await Contracts.TestBancorNetworkV3.deploy(contractRegistry.address);
        bancorNetworkV3.setNetworkToken(bnt.address);

        masterVault = await Contracts.TokenHolder.deploy();

        bancorNetworkV3.setBancorVault(masterVault.address);
    });

    describe('construction', () => {
        const root = formatBytes32String('root');

        it('should revert when attempting to create with an invalid network contract', async () => {
            await expect(
                Contracts.MerkleTreeRewards.deploy(ZERO_ADDRESS, bntGovernance.address, root)
            ).to.be.revertedWith('InvalidAddress');
        });

        it('should revert when attempting to create with an invalid BNT governance contract', async () => {
            await expect(
                Contracts.MerkleTreeRewards.deploy(bancorNetworkV3.address, ZERO_ADDRESS, root)
            ).to.be.revertedWith('InvalidAddress');
        });

        it('should be properly initialized', async () => {
            const merkleTreeRewards = await Contracts.MerkleTreeRewards.deploy(
                bancorNetworkV3.address,
                bntGovernance.address,
                root
            );

            expect(await merkleTreeRewards.merkleRoot()).to.equal(root);
        });
    });

    describe('rewards', () => {
        let merkleTreeRewards: MerkleTreeRewards;

        let provider1: SignerWithAddress;
        let provider2: SignerWithAddress;
        let provider3: SignerWithAddress;
        let provider4: SignerWithAddress;
        let provider5: SignerWithAddress;

        let rewards: Record<string, BigNumber> = {};
        let merkleTree: MerkleTree;

        const generateLeaf = (address: string, amount: BigNumber) =>
            Buffer.from(
                solidityKeccak256(['address', 'uint256'], [getAddress(address), amount.toString()]).slice(2),
                'hex'
            );

        before(async () => {
            [provider1, provider2, provider3, provider4, provider5] = await ethers.getSigners();

            rewards = {
                [provider1.address]: BigNumber.from(1),
                [provider2.address]: BigNumber.from(100_000),
                [provider3.address]: BigNumber.from(500),
                [provider4.address]: BigNumber.from(1_000_000),
                [provider5.address]: BigNumber.from(5)
            };

            merkleTree = new MerkleTree(
                Object.entries(rewards).map(([provider, amount]) => generateLeaf(provider, amount)),
                keccak256,
                { sortPairs: true }
            );
        });

        beforeEach(async () => {
            merkleTreeRewards = await Contracts.MerkleTreeRewards.deploy(
                bancorNetworkV3.address,
                bntGovernance.address,
                merkleTree.getRoot()
            );

            await bntGovernance.grantRole(ROLE_MINTER, merkleTreeRewards.address);
        });

        const testClaimOrStake = (stake: boolean) => {
            interface Overrides {
                caller?: SignerWithAddress;
                amount?: BigNumber;
                proof?: string[];
            }

            const claim = async (recipient: SignerWithAddress, overrides: Overrides = {}) => {
                let { caller = recipient, amount, proof } = overrides;

                if (!amount) {
                    amount = rewards[recipient.address];
                }

                if (!proof) {
                    proof = merkleTree.getHexProof(generateLeaf(recipient.address, amount));
                }

                return stake
                    ? merkleTreeRewards.connect(caller).stakeRewards(recipient.address, amount, proof)
                    : merkleTreeRewards.connect(caller).claimRewards(recipient.address, amount, proof);
            };

            describe(stake ? 'staking' : 'claiming', () => {
                it('should revert when calling for a different provider', async () => {
                    await expect(claim(provider1, { caller: provider2 })).to.be.revertedWith('AccessDenied');
                });

                it('should revert when calling with a different amount', async () => {
                    await expect(claim(provider1, { amount: rewards[provider2.address] })).to.be.revertedWith(
                        'InvalidClaim'
                    );
                });

                it('should revert when calling with an invalid proof', async () => {
                    const proof = merkleTree.getHexProof(generateLeaf(provider1.address, rewards[provider1.address]));

                    await expect(claim(provider2, { proof })).to.be.revertedWith('InvalidClaim');
                    await expect(
                        claim(provider1, {
                            proof: [formatBytes32String('1234'), ...proof]
                        })
                    ).to.be.revertedWith('InvalidClaim');
                    await expect(claim(provider1, { proof: [...proof].slice(1) })).to.be.revertedWith('InvalidClaim');
                    await expect(
                        claim(provider1, {
                            proof: merkleTree.getHexProof(generateLeaf(provider2.address, rewards[provider1.address]))
                        })
                    ).to.be.revertedWith('InvalidClaim');
                });

                it('should not when claiming twice', async () => {
                    await claim(provider1);
                    await expect(claim(provider1)).to.be.revertedWith('AlreadyClaimed');
                });

                it('should claim the rewards', async () => {
                    let totalClaimed = BigNumber.from(0);

                    for (const [providerAddress, amount] of Object.entries(rewards)) {
                        const provider = await ethers.getSigner(providerAddress);

                        expect(await merkleTreeRewards.totalClaimed()).to.equal(totalClaimed);
                        expect(await merkleTreeRewards.hasClaimed(providerAddress)).to.be.false;

                        const prevTotalSupply = await bnt.totalSupply();
                        const prevProviderBalance = await bnt.balanceOf(providerAddress);
                        const prevVaultBalance = await bnt.balanceOf(masterVault.address);

                        const res = await claim(provider);

                        await expect(res)
                            .to.emit(merkleTreeRewards, stake ? 'RewardsStaked' : 'RewardsClaimed')
                            .withArgs(providerAddress, amount);

                        totalClaimed = totalClaimed.add(amount);

                        expect(await merkleTreeRewards.totalClaimed()).to.equal(totalClaimed);
                        expect(await merkleTreeRewards.hasClaimed(providerAddress)).to.be.true;

                        expect(await bnt.totalSupply()).to.equal(prevTotalSupply.add(amount));
                        expect(await bnt.balanceOf(providerAddress)).to.equal(
                            prevProviderBalance.add(stake ? 0 : amount)
                        );
                        expect(await bnt.balanceOf(masterVault.address)).to.equal(
                            prevVaultBalance.add(stake ? amount : 0)
                        );
                    }
                });
            });
        };

        for (const stake of [true, false]) {
            testClaimOrStake(stake);
        }
    });
});
