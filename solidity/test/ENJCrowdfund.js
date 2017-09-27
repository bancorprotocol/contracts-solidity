const ENJToken = artifacts.require('ENJToken.sol');
const Utils = require('./helpers/Utils');
const BigNumber = require('bignumber.js');
const ENJCrowdfund = artifacts.require('ENJCrowdfund.sol');

let tokenAddress;
let crowdfundAddress;
let advisorAddress;
let incentiveAddress;
let teamAddress;
let owner;
let beneficiary;
let totalPresaleTokensYetToAllocate = new BigNumber(100000000).times(new BigNumber(10).pow(18));
let batchOfAddress = [];
let batchOfENJ = [];
let longBatchOfAddress = [];
let longBatchOfENJ = [];
let incentiveAllocation = 100000000;

async function timeJump(timeToInc) {
    return new Promise((resolve, reject) => {
        web3
            .currentProvider
            .sendAsync({
                jsonrpc: '2.0',
                method: 'evm_increaseTime',
                params: [(timeToInc)] // timeToInc is the time in seconds to increase
            }, function (err, result) {
                if (err) {
                    reject(err);
                }
                resolve(result);
            });
    });
}

contract('ENJCrowdfund', (accounts) => {
    before(async() => {
        advisorAddress = accounts[1];
        owner = accounts[2];
        beneficiary = accounts[3];
        incentiveAddress = accounts[4];
        teamAddress = accounts[4];
        batchOfAddress = [accounts[8], accounts[7], accounts[6], accounts[5]];
        batchOfENJ = [
            new BigNumber(100).times(new BigNumber(10).pow(18)),
            new BigNumber(200).times(new BigNumber(10).pow(18)),
            new BigNumber(300).times(new BigNumber(10).pow(18)),
            new BigNumber(400).times(new BigNumber(10).pow(18))
        ]
        let crowdfund = await ENJCrowdfund.new(totalPresaleTokensYetToAllocate, beneficiary, {from: owner});
        crowdfundAddress = crowdfund.address;
        let token = await ENJToken.new(crowdfundAddress, advisorAddress, incentiveAddress, teamAddress, {from: owner});
        tokenAddress = token.address;
    });

    it('verifies parameters', async() => {
        let crowdfund = await ENJCrowdfund.new(totalPresaleTokensYetToAllocate, beneficiary, {from: owner});
        let _beney = await crowdfund
            .beneficiary
            .call();
        assert.equal(_beney, accounts[3]);
        let presaleTokens = await crowdfund
            .totalPresaleTokensYetToAllocate
            .call();
        assert.equal(presaleTokens.dividedBy(new BigNumber(10).pow(18)).toNumber(), 100000000);
    });

    it('changeBeneficiary: should change the beneficiary', async() => {
        let crowdfund = await ENJCrowdfund.new(totalPresaleTokensYetToAllocate, beneficiary, {from: owner});
        await crowdfund.changeBeneficiary(accounts[6], {from: owner});
        let _beney = await crowdfund
            .beneficiary
            .call();
        assert.equal(_beney, accounts[6]);
    });

    it('changeBeneficiary: should change the beneficiary -- fail',
    async() => {
        let crowdfund = await ENJCrowdfund.new(totalPresaleTokensYetToAllocate, beneficiary, {from: owner});
        try {
            await crowdfund.changeBeneficiary(accounts[6], {from: accounts[8]});
        } catch (error) {
            return Utils.ensureException(error);
        }
    });

    it('setToken:should set the token', async() => {
        let crowdfund = await ENJCrowdfund.new(totalPresaleTokensYetToAllocate, beneficiary, {from: owner});
        let token = await ENJToken.new(crowdfund.address, advisorAddress, incentiveAddress, teamAddress, {from: owner});
        await crowdfund.setToken(token.address, {from: owner});
        let _tokenAddress = await crowdfund
            .tokenAddress
            .call();
        assert.equal(_tokenAddress, token.address);
    });

    it('setToken:should set the token -- fails called other than owner',
    async() => {
        let crowdfund = await ENJCrowdfund.new(totalPresaleTokensYetToAllocate, beneficiary, {from: owner});
        let token = await ENJToken.new(crowdfund.address, advisorAddress, incentiveAddress, teamAddress);

        try {
            await crowdfund.setToken(token.address, {from: accounts[8]});
        } catch (error) {
            return Utils.ensureException(error);
        }
    });

    it('setToken:should fail when token is already set', async() => {
        let crowdfund = await ENJCrowdfund.new(totalPresaleTokensYetToAllocate, beneficiary, {from: owner});
        let token = await ENJToken.new(crowdfund.address, advisorAddress, incentiveAddress, teamAddress);
        await crowdfund.setToken(token.address, {from: owner});
        let _tokenAddress = await crowdfund
            .tokenAddress
            .call();
        assert.equal(_tokenAddress, token.address);
        try {
            await crowdfund.setToken(token.address, {from: owner});
        } catch (error) {
            return Utils.ensureException(error);
        }
    })

    it('deliverPresaleTokens: should deliver the tokens to the presale contributors', async() => {
        let crowdfund = await ENJCrowdfund.new(totalPresaleTokensYetToAllocate, beneficiary, {from: owner});
        let token = await ENJToken.new(crowdfund.address, advisorAddress, incentiveAddress, teamAddress);
        await crowdfund.setToken(token.address, {from: owner});
        let tokenAddress = await crowdfund
            .tokenAddress
            .call();
        assert.strictEqual(tokenAddress, token.address);
        await crowdfund.deliverPresaleTokens(batchOfAddress, batchOfENJ, {
            from: owner,
            gas: 3000000
        });
        let presaleTokens = await crowdfund
            .totalPresaleTokensYetToAllocate
            .call();
        assert.strictEqual(presaleTokens.dividedBy(new BigNumber(10).pow(18)).toNumber(), 99999000);
        let _balance1 = await token
            .balanceOf
            .call(accounts[8]);
        assert.strictEqual(_balance1.dividedBy(new BigNumber(10).pow(18)).toNumber(), 100);
        let _balance2 = await token
            .balanceOf
            .call(accounts[7]);
        assert.strictEqual(_balance2.dividedBy(new BigNumber(10).pow(18)).toNumber(), 200);
        let _balance3 = await token
            .balanceOf
            .call(accounts[6]);
        assert.strictEqual(_balance3.dividedBy(new BigNumber(10).pow(18)).toNumber(), 300);
        let _balance4 = await token
            .balanceOf
            .call(accounts[5]);
        assert.strictEqual(_balance4.dividedBy(new BigNumber(10).pow(18)).toNumber(), 400);
    });

    it('deliverPresaleTokens: should deliver the tokens to the presale contributors --fails called by other than owner',
    async() => {
        let crowdfund = await ENJCrowdfund.new(totalPresaleTokensYetToAllocate, beneficiary, {from: owner});
        let token = await ENJToken.new(crowdfund.address, advisorAddress, incentiveAddress, teamAddress);
        await crowdfund.setToken(token.address, {from: owner});
        let tokenAddress = await crowdfund
            .tokenAddress
            .call();
        assert.strictEqual(tokenAddress, token.address);
        try {
            await crowdfund.deliverPresaleTokens(batchOfAddress, batchOfENJ, {
                from: accounts[4],
                gas: 3000000
            });
        } catch (error) {
            return Utils.ensureException(error);
        }
    });

    it('deliverPresaleTokens: should deliver the tokens to the presale contributors --fails when token is not set',
    async() => {
        let crowdfund = await ENJCrowdfund.new(totalPresaleTokensYetToAllocate, beneficiary, {from: owner});
        let token = await ENJToken.new(crowdfund.address, advisorAddress, incentiveAddress, teamAddress);
        try {
            await crowdfund.deliverPresaleTokens(batchOfAddress, batchOfENJ, {
                from: accounts[4],
                gas: 3000000
            });
        } catch (error) {
            return Utils.ensureException(error);
        }
    });

    it('Jump into the first week of the crowdsale', async() => {
        let crowdfund = await ENJCrowdfund.new(totalPresaleTokensYetToAllocate, beneficiary, {from: owner});        
        let token = await ENJToken.new(crowdfund.address, advisorAddress, incentiveAddress, teamAddress);
        let currentTime = Math.floor(Date.now() / 1000);
        let startTime = await crowdfund
            .startTime
            .call();
        let durationDiff = await Utils.timeDifference(startTime.toNumber(), currentTime);
        let durationToInc = Math.floor(durationDiff + 2000);
        await timeJump(durationToInc);
    });

    it('contributeETH: user cannot contribute -- first week -- fails when token is not set',
    async() => {
        let crowdfund = await ENJCrowdfund.new(totalPresaleTokensYetToAllocate, beneficiary, {from: owner});
        let token = await ENJToken.new(crowdfund.address, advisorAddress, incentiveAddress, teamAddress);
        try {
            await crowdfund.contributeETH(accounts[8], {
                from: accounts[8],
                gas: 2000000,
                value: new BigNumber(11).times(new BigNumber(10).pow(18))
            });
        } catch (error) {
            return Utils.ensureException(error);
        }
    });

    it('contributeETH: user can contribute', async() => {
        let crowdfund = await ENJCrowdfund.new(totalPresaleTokensYetToAllocate, beneficiary, {from: owner});
        let token = await ENJToken.new(crowdfund.address, advisorAddress, incentiveAddress, teamAddress);
        await crowdfund.setToken(token.address, {from: owner});
        let balanceSoFar = 0;
        let tokenAddress = await crowdfund
            .tokenAddress
            .call();
        assert.strictEqual(tokenAddress, token.address);
        await crowdfund.contributeETH(accounts[8], {
            from: accounts[8],
            gas: 2000000,
            value: new BigNumber(1).times(new BigNumber(10).pow(18))
        });
        let _balance = await token
            .balanceOf
            .call(accounts[8]);
        balanceSoFar = _balance.dividedBy(new BigNumber(10).pow(18)).toNumber() + incentiveAllocation;
        assert.strictEqual(_balance.dividedBy(new BigNumber(10).pow(18)).toNumber(), 6000);
        let ENJSold = await crowdfund
            .totalEnjSold
            .call();
        assert.strictEqual(ENJSold.dividedBy(new BigNumber(10).pow(18)).toNumber(), 6000 + incentiveAllocation);

        // Second week
        await timeJump(7 * 24 * 60 * 60 + 2000);
        await crowdfund.contributeETH(accounts[8], {
            from: accounts[8],
            gas: 2000000,
            value: new BigNumber(1).times(new BigNumber(10).pow(18))
        });
        _balance = await token
            .balanceOf
            .call(accounts[8]);

        balanceSoFar += 5000
        assert.strictEqual(_balance.dividedBy(new BigNumber(10).pow(18)).toNumber(), balanceSoFar - incentiveAllocation);
        ENJSold = await crowdfund
            .totalEnjSold
            .call();
        assert.strictEqual(ENJSold.dividedBy(new BigNumber(10).pow(18)).toNumber(), balanceSoFar);

        // Third week
        await timeJump(7 * 24 * 60 * 60 + 2000);
        await crowdfund.contributeETH(accounts[8], {
            from: accounts[8],
            gas: 2000000,
            value: new BigNumber(1).times(new BigNumber(10).pow(18))
        });
        _balance = await token
            .balanceOf
            .call(accounts[8]);

        balanceSoFar += 4000
        assert.strictEqual(_balance.dividedBy(new BigNumber(10).pow(18)).toNumber(), balanceSoFar - incentiveAllocation);
        ENJSold = await crowdfund
            .totalEnjSold
            .call();
        assert.strictEqual(ENJSold.dividedBy(new BigNumber(10).pow(18)).toNumber(), balanceSoFar);

        // Fourth week
        await timeJump(7 * 24 * 60 * 60 + 2000);
        await crowdfund.contributeETH(accounts[8], {
            from: accounts[8],
            gas: 2000000,
            value: new BigNumber(1).times(new BigNumber(10).pow(18))
        });
        _balance = await token
            .balanceOf
            .call(accounts[8]);

        balanceSoFar += 3000
        assert.strictEqual(_balance.dividedBy(new BigNumber(10).pow(18)).toNumber(), balanceSoFar - incentiveAllocation);
        ENJSold = await crowdfund
            .totalEnjSold
            .call();
        assert.strictEqual(ENJSold.dividedBy(new BigNumber(10).pow(18)).toNumber(), balanceSoFar);

        // Fifth week -- Failure
        await timeJump(7 * 24 * 60 * 60 + 2000);
        try {
            await crowdfund.contributeETH(accounts[8], {
                from: accounts[8],
                gas: 2000000,
                value: new BigNumber(1).times(new BigNumber(10).pow(18))
            });
        } catch (error) {
            return utils.ensureException(error);
        }
    });

});