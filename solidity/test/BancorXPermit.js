const { contract } = require('@openzeppelin/test-environment');
const { expectEvent, BN } = require('@openzeppelin/test-helpers');
const { ethers } = require("ethers");

const BancorX = contract.fromArtifact('BancorX');
const TestERC20PermitToken = contract.fromArtifact('TestERC20PermitToken');
const ContractRegistry = contract.fromArtifact('ContractRegistry');

const MAX_LOCK_LIMIT = new BN('1000000000000000000000'); // 1000 tokens
const MAX_RELEASE_LIMIT = new BN('1000000000000000000000'); // 1000 tokens
const MIN_LIMIT = new BN('1000000000000000000'); // 1 token
const LIM_INC_PER_BLOCK = new BN('1000000000000000000'); // 1 token
const MIN_REQ_REPORTS = new BN(3);
const TX_ID = new BN(0);

/**
 * Using both web3 and ethers.js libraries since web3 doesn't support sign typed data v3.
 * Therefore need to represent amounts of tokens for both web3 and ethers.
 */
const TEST_AMOUNT_WEB3 = new BN('1000000000000000000'); // 1 token
const TEST_AMOUNT_ETHERS = ethers.utils.parseEther('1'); // 1 token

const EOS_ADDRESS = '0x3c69a194aaf415ba5d6afca734660d0a3d45acdc05d54cd1ca89a8988e7625b4';
const EOS_BLOCKCHAIN = '0x4e8ebbefa452077428f93c9520d3edd60594ff452a29ac7d2ccc11d47f3ab95b';
const DEADLINE = 11636367153;

describe('BancorX-Permit', () => {
    let bancorX;
    let bancorXToken;
    let tokenName;
    let contractRegistry;
    let signer;
    let spender;

    beforeEach(async () => {
        contractRegistry = await ContractRegistry.new();
        bancorXToken = await TestERC20PermitToken.new();
        bancorX = await BancorX.new(
            MAX_LOCK_LIMIT,
            MAX_RELEASE_LIMIT,
            MIN_LIMIT,
            LIM_INC_PER_BLOCK,
            MIN_REQ_REPORTS,
            contractRegistry.address,
            bancorXToken.address
        );
        spender = bancorX.address;
        tokenName = await bancorXToken.name();
        signer = ethers.Wallet.createRandom();
        await bancorXToken.mint(signer.address, TEST_AMOUNT_WEB3);
    });

    async function signPremitData(signer, spender, value, nonce) {
        const signature = await signer._signTypedData(
            {name: tokenName, version: '1', chainId : 1, verifyingContract: bancorXToken.address},
            {Permit: [
                {name: 'owner', type: 'address'},
                {name: 'spender', type: 'address'},
                {name: 'value', type: 'uint256'},
                {name: 'nonce', type: 'uint256'},
                {name: 'deadline', type: 'uint256'}
            ]},
            {owner: signer.address, spender, value, nonce, deadline: DEADLINE});
        return ethers.utils.splitSignature(signature);
    }

    async function getNonce(account) {
        return (await bancorXToken.nonces(account.address)).toNumber();
    }

    it('should emit an event when successfully locking tokens', async () => {
        const nonce = await getNonce(signer);
        const {v, r, s} = await signPremitData(signer, spender, TEST_AMOUNT_ETHERS, nonce);
        const res = await bancorX.xTransfer(EOS_BLOCKCHAIN, EOS_ADDRESS, TEST_AMOUNT_WEB3, DEADLINE,
                                    signer.address, v, r, s, TX_ID);

        expectEvent(res, 'XTransfer', {
            _from: signer.address,
            _toBlockchain: EOS_BLOCKCHAIN,
            _to: EOS_ADDRESS,
            _amount: TEST_AMOUNT_WEB3,
            _id: TX_ID
        });
    });

});
