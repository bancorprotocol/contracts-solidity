const ENJToken = artifacts.require('ENJToken.sol');
const Utils = require('./helpers/Utils');
const BigNumber = require('bignumber.js');
const ENJCrowdfund = artifacts.require('ENJCrowdfund.sol');

let tokenAddress;
let crowdfundAddress;
let advisorAddress;
let owner;
let beneficiary;
let incentiveAddress;
let teamAddress;
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
    })
}

contract('ENJToken', (accounts) => {
    before(async() => {
        crowdfundAddress = accounts[0];
        advisorAddress = accounts[1];
        owner = accounts[2];
        beneficiary = accounts[3];
        incentiveAddress = accounts[4];
        teamAddress = accounts[5];
        let token = await ENJToken.new(crowdfundAddress, advisorAddress, incentiveAddress, teamAddress, {from: owner});
        tokenAddress = token.address;
    });

    it('verify parameters', async() => {
        let token = await ENJToken.new(crowdfundAddress, advisorAddress, incentiveAddress, teamAddress, {from: owner});
        let balance = await token
            .balanceOf
            .call(crowdfundAddress);
        assert.strictEqual(balance.dividedBy(new BigNumber(10).pow(18)).toNumber(), 800000000);
        let incentiveBalance = await token
            .balanceOf
            .call(incentiveAddress);
        assert.strictEqual(incentiveBalance.dividedBy(new BigNumber(10).pow(18)).toNumber(), 100000000);
    });

    it('verify the allocation variables', async() => {
        let token = await ENJToken.new(crowdfundAddress, advisorAddress, incentiveAddress, teamAddress, {from: owner});
        let _totalSupply = await token
            .totalSupply
            .call();
        assert.strictEqual(_totalSupply.dividedBy(new BigNumber(10).pow(18)).toNumber(), 1000000000);
        let _maxPresaleSupply = await token
            .maxPresaleSupply
            .call();
        assert.strictEqual(_maxPresaleSupply.dividedBy(new BigNumber(10).pow(18)).toNumber(), 600000000);
        let _minCrowdsaleAllocation = await token
            .minCrowdsaleAllocation
            .call();
        assert.strictEqual(_minCrowdsaleAllocation.dividedBy(new BigNumber(10).pow(18)).toNumber(), 200000000);
        let _incentivisationAllocation = await token
            .incentivisationAllocation
            .call();
        assert.strictEqual(_incentivisationAllocation.dividedBy(new BigNumber(10).pow(18)).toNumber(), 100000000);
        let _advisorsAllocation = await token
            .advisorsAllocation
            .call();
        assert.strictEqual(_advisorsAllocation.dividedBy(new BigNumber(10).pow(18)).toNumber(), 26000000);
        let _enjinTeamAllocation = await token
            .enjinTeamAllocation
            .call();
        assert.strictEqual(_enjinTeamAllocation.dividedBy(new BigNumber(10).pow(18)).toNumber(), 74000000);
    })

    // ///////////////////////////////////////// Transfer // ///////////////////////////////////////

    it('transfer: ether directly to the token contract -- it will throw', async() => {
        let token = await ENJToken.new(crowdfundAddress, advisorAddress, incentiveAddress, teamAddress, {from: owner});
        try {
            await web3
                .eth
                .sendTransaction({
                    from: accounts[8],
                    to: token.address,
                    value: web3.toWei('10', 'Ether')
                });
        } catch (error) {
            return Utils.ensureException(error);
        }
    });

    it('transfer: should transfer 10000 to accounts[8] from crowdsale', async() => {
        let token = await ENJToken.new(crowdfundAddress, advisorAddress, incentiveAddress, teamAddress, {from: owner});
        await token.transfer(accounts[8], new BigNumber(10000).times(new BigNumber(10).pow(18)), {from: crowdfundAddress});
        let balance = await token
            .balanceOf
            .call(accounts[8]);
        assert.strictEqual(balance.dividedBy(new BigNumber(10).pow(18)).toNumber(), 10000);
    });

    it('transfer: first should transfer 10000 to accounts[8] from crowdsale then accounts[8] transfers 1000 to accounts[7]',
    async() => {
        let token = await ENJToken.new(crowdfundAddress, advisorAddress, incentiveAddress, teamAddress, {from: owner});
        let currentTime = Math.floor(Date.now() / 1000);
        await token.transfer(accounts[8], new BigNumber(10000).times(new BigNumber(10).pow(18)), {from: crowdfundAddress});
        let balance = await token
            .balanceOf
            .call(accounts[8]);
        assert.strictEqual(balance.dividedBy(new BigNumber(10).pow(18)).toNumber(), 10000);
        await token.allowTransfers({from: owner});
        await token.transfer(accounts[7], new BigNumber(1000).times(new BigNumber(10).pow(18)), {from: accounts[8]});
        let accBalance = await token
            .balanceOf
            .call(accounts[7]);
        assert.strictEqual(accBalance.dividedBy(new BigNumber(10).pow(18)).toNumber(), 1000);
    });

    it('transfer: should fail when trying to transfer zero', async() => {
        let token = await ENJToken.new(crowdfundAddress, advisorAddress, incentiveAddress, teamAddress, {from: owner});
        try {
            await token.transfer(accounts[8], new BigNumber(0).times(new BigNumber(10).pow(18)), {from: crowdfundAddress});
        } catch (error) {
            return Utils.ensureException(error);
        }
    });

    it('approve: msg.sender should approve 1000 to accounts[8]', async() => {
        let token = await ENJToken.new(crowdfundAddress, advisorAddress, incentiveAddress, teamAddress, {from: owner});
        await token.approve(accounts[8], new BigNumber(1000).times(new BigNumber(10).pow(18)), {from: crowdfundAddress});
        let _allowance = await token
            .allowance
            .call(crowdfundAddress, accounts[8]);
        assert.strictEqual(_allowance.dividedBy(new BigNumber(10).pow(18)).toNumber(),1000);
    });

    it('approve: msg.sender should approve 1000 to accounts[7] & withdraws 200 once', async() => {
        let token = await ENJToken.new(crowdfundAddress, advisorAddress, incentiveAddress, teamAddress, {from: owner});
        await token.transfer(accounts[8], new BigNumber(1000).times(new BigNumber(10).pow(18)), {from: crowdfundAddress});
        await token.approve(accounts[7], new BigNumber(1000).times(new BigNumber(10).pow(18)), {from: accounts[8]});
        let _allowance1 = await token
            .allowance
            .call(accounts[8], accounts[7]);
        assert.strictEqual(_allowance1.dividedBy(new BigNumber(10).pow(18)).toNumber(), 1000);
        await token.allowTransfers({from: owner});
        await token.transferFrom(accounts[8], accounts[6], new BigNumber(200).times(new BigNumber(10).pow(18)), {from: accounts[7]});
        let balance = await token
            .balanceOf
            .call(accounts[6]);
        assert.strictEqual(balance.dividedBy(new BigNumber(10).pow(18)).toNumber(), 200);
        let _allowance2 = await token
            .allowance
            .call(accounts[8], accounts[7]);
        assert.strictEqual(_allowance2.dividedBy(new BigNumber(10).pow(18)).toNumber(), 800);
        let _balance = await token
            .balanceOf
            .call(accounts[8]);
        assert.strictEqual(_balance.dividedBy(new BigNumber(10).pow(18)).toNumber(), 800);

    });

    it('approve: msg.sender should approve 1000 to accounts[7] & withdraws 200 twice', async() => {
        let token = await ENJToken.new(crowdfundAddress, advisorAddress, incentiveAddress, teamAddress, {from: owner});
        await token.transfer(accounts[8], new BigNumber(1000).times(new BigNumber(10).pow(18)), {from: crowdfundAddress});
        await token.approve(accounts[7], new BigNumber(1000).times(new BigNumber(10).pow(18)), {from: accounts[8]});
        let _allowance1 = await token
            .allowance
            .call(accounts[8], accounts[7]);
        assert.strictEqual(_allowance1.dividedBy(new BigNumber(10).pow(18)).toNumber(), 1000);
        await token.allowTransfers({from: owner});
        await token.transferFrom(accounts[8], accounts[6], new BigNumber(200).times(new BigNumber(10).pow(18)), {from: accounts[7]});
        let _balance1 = await token
            .balanceOf
            .call(accounts[6]);
        assert.strictEqual(_balance1.dividedBy(new BigNumber(10).pow(18)).toNumber(), 200);
        let _allowance2 = await token
            .allowance
            .call(accounts[8], accounts[7]);
        assert.strictEqual(_allowance2.dividedBy(new BigNumber(10).pow(18)).toNumber(), 800);
        let _balance2 = await token
            .balanceOf
            .call(accounts[8]);
        assert.strictEqual(_balance2.dividedBy(new BigNumber(10).pow(18)).toNumber(), 800);
        await token.transferFrom(accounts[8], accounts[5], new BigNumber(200).times(new BigNumber(10).pow(18)), {from: accounts[7]});
        let _balance3 = await token
            .balanceOf
            .call(accounts[5]);
        assert.strictEqual(_balance3.dividedBy(new BigNumber(10).pow(18)).toNumber(), 200);
        let _allowance3 = await token
            .allowance
            .call(accounts[8], accounts[7]);
        assert.strictEqual(_allowance3.dividedBy(new BigNumber(10).pow(18)).toNumber(), 600);
        let _balance4 = await token
            .balanceOf
            .call(accounts[8]);
        assert.strictEqual(_balance4.dividedBy(new BigNumber(10).pow(18)).toNumber(), 600);
    });

    it('Approve max (2^256 - 1)', async() => {
        let token = await ENJToken.new(crowdfundAddress, advisorAddress, incentiveAddress, teamAddress, {from: owner});
        await token.approve(accounts[8], '115792089237316195423570985008687907853269984665640564039457584007913129639935', {from: accounts[7]});
        let _allowance = await token.allowance(accounts[7], accounts[8]);
        let result = _allowance.equals('1.15792089237316195423570985008687907853269984665640564039457584007913129639935e' +
                '+77');
        assert.isTrue(result);
    });

    it('approves: msg.sender approves accounts[7] of 1000 & withdraws 800 & 500 (2nd tx should fail)',
    async() => {
        let token = await ENJToken.new(crowdfundAddress, advisorAddress, incentiveAddress, teamAddress, {from: owner});
        await token.transfer(accounts[8], new BigNumber(1000).times(new BigNumber(10).pow(18)), {from: crowdfundAddress});
        await token.approve(accounts[7], new BigNumber(1000).times(new BigNumber(10).pow(18)), {from: accounts[8]});
        let _allowance1 = await token
            .allowance
            .call(accounts[8], accounts[7]);
        assert.strictEqual(_allowance1.dividedBy(new BigNumber(10).pow(18)).toNumber(), 1000);
        await token.allowTransfers({from: owner});
        await token.transferFrom(accounts[8], accounts[6], new BigNumber(800).times(new BigNumber(10).pow(18)), {from: accounts[7]});
        let _balance1 = await token
            .balanceOf
            .call(accounts[6]);
        assert.strictEqual(_balance1.dividedBy(new BigNumber(10).pow(18)).toNumber(), 800);
        let _allowance2 = await token
            .allowance
            .call(accounts[8], accounts[7]);
        assert.strictEqual(_allowance2.dividedBy(new BigNumber(10).pow(18)).toNumber(), 200);
        let _balance2 = await token
            .balanceOf
            .call(accounts[8]);
        assert.strictEqual(_balance2.dividedBy(new BigNumber(10).pow(18)).toNumber(), 200);
        try {
            await token.transferFrom(accounts[8], accounts[6], new BigNumber(500).times(new BigNumber(10).pow(18)), {from: accounts[7]});
        } catch (error) {
            return Utils.ensureException(error);
        }
    });

    it('transferFrom: user attempt to transfer 100 tokens with 1000 allowance before the crowdsale ends -- fails ',
    async() => {
        let token = await ENJToken.new(crowdfundAddress, advisorAddress, incentiveAddress, teamAddress, {from: owner});
        await token.transfer(accounts[8], new BigNumber(1000).times(new BigNumber(10).pow(18)), {from: crowdfundAddress});
        await token.approve(accounts[7], new BigNumber(1000).times(new BigNumber(10).pow(18)), {from: accounts[8]});
        let _allowance1 = await token
            .allowance
            .call(accounts[8], accounts[7]);
        assert.strictEqual(_allowance1.dividedBy(new BigNumber(10).pow(18)).toNumber(), 1000);
        try {
            await token.transferFrom(accounts[8], accounts[6], new BigNumber(100).times(new BigNumber(10).pow(18)), {from: accounts[7]});
        } catch (error) {
            return Utils.ensureException(error);
        }

    });

    it('transferFrom: Attempt to  withdraw from account with no allowance  -- fail', async() => {
        let token = await ENJToken.new(crowdfundAddress, advisorAddress, incentiveAddress, teamAddress, {from: owner});
        await token.transfer(accounts[8], new BigNumber(1000).times(new BigNumber(10).pow(18)), {from: crowdfundAddress});
        await token.allowTransfers({from: owner});
        try {
            await token
                .transferFrom
                .call(accounts[8], accounts[6], new BigNumber(100).times(new BigNumber(10).pow(18)), {from: accounts[7]});
        } catch (error) {
            return Utils.ensureException(error);
        }
    });

    it('transferFrom: Allow accounts[7] 1000 to withdraw from accounts[8]. Withdraw 800 and then approve 0 & attempt transfer',
    async() => {
        let token = await ENJToken.new(crowdfundAddress, advisorAddress, incentiveAddress, teamAddress, {from: owner});
        await token.transfer(accounts[8], new BigNumber(1000).times(new BigNumber(10).pow(18)), {from: crowdfundAddress});
        await token.approve(accounts[7], new BigNumber(1000).times(new BigNumber(10).pow(18)), {from: accounts[8]});
        let _allowance1 = await token
            .allowance
            .call(accounts[8], accounts[7]);
        assert.strictEqual(_allowance1.dividedBy(new BigNumber(10).pow(18)).toNumber(), 1000);
        await token.allowTransfers({from: owner});
        await token.transferFrom(accounts[8], accounts[6], new BigNumber(200).times(new BigNumber(10).pow(18)), {from: accounts[7]});
        let _balance1 = await token
            .balanceOf
            .call(accounts[6]);
        assert.strictEqual(_balance1.dividedBy(new BigNumber(10).pow(18)).toNumber(), 200);
        let _allowance2 = await token
            .allowance
            .call(accounts[8], accounts[7]);
        assert.strictEqual(_allowance2.dividedBy(new BigNumber(10).pow(18)).toNumber(), 800);
        let _balance2 = await token
            .balanceOf
            .call(accounts[8]);
        assert.strictEqual(_balance2.dividedBy(new BigNumber(10).pow(18)).toNumber(), 800);
        await token.approve(accounts[7], 0, {from: accounts[8]});
        try {
            await token.transferFrom(accounts[8], accounts[6], new BigNumber(200).times(new BigNumber(10).pow(18)), {from: accounts[7]});
        } catch (error) {
            return Utils.ensureException(error);
        }
    });

    it('addToAllocation: verifies the functionality of updating the variable totalAllocated',
    async() => {
        let token = await ENJToken.new(crowdfundAddress, advisorAddress, incentiveAddress, teamAddress, {from: owner});
        await token.addToAllocation(new BigNumber(10).times(new BigNumber(10).pow(18)), {from: crowdfundAddress});
        let allocation = await token
            .totalAllocated
            .call();
        assert.strictEqual(allocation.dividedBy(new BigNumber(10).pow(18)).toNumber(), incentiveAllocation + 10);
    });

    it('addToAllocation:verifies the functionality of updating the variable totalAllocated -- fails called by other than crowdfund',
    async() => {
        let token = await ENJToken.new(crowdfundAddress, advisorAddress, incentiveAddress, teamAddress, {from: owner});
        try {
            await token.addToAllocation(new BigNumber(10).times(new BigNumber(10).pow(18)), {from: accounts[8]});
        } catch (error) {
            return Utils.ensureException(error);
        }
    });

    it('allowTransfers: allow transfer of tokens called by owner only --fails called by accounts[8]',
    async() => {
        let token = await ENJToken.new(crowdfundAddress, advisorAddress, incentiveAddress, teamAddress, {from: owner});
        try {
            await token.allowTransfers({from: accounts[8]});
        } catch (error) {
            return Utils.ensureException(error);
        }
    });

    it('Jumps into the crowdsale', async() => {
        let token = await ENJToken.new(crowdfundAddress, advisorAddress, incentiveAddress, teamAddress, {from: owner});
        let currentTime = Math.floor(Date.now() / 1000);
        let endTime = await token
            .endTime
            .call();
        let durationToInc = Math.floor(endTime  - currentTime + 20000);
        await timeJump(durationToInc);
        assert.strictEqual(true, true);
    });
    
    it('transfer: first should transfer 10000 to accounts[8] from crowdsale then accounts[8] transfer 1000 to accounts[7] when endTime completes',
    async() => {
        let token = await ENJToken.new(crowdfundAddress, advisorAddress, incentiveAddress, teamAddress, {from: owner});
        await token.transfer(accounts[8], new BigNumber(10000).times(new BigNumber(10).pow(18)), {from: crowdfundAddress});
        let balance = await token
        .balanceOf
        .call(accounts[8]);
        assert.strictEqual(balance.dividedBy(new BigNumber(10).pow(18)).toNumber(), 10000);
        await token.transfer(accounts[7], new BigNumber(1000).times(new BigNumber(10).pow(18)), {from: accounts[8]});
        let accBalance = await token
            .balanceOf
            .call(accounts[7]);
            assert.strictEqual(accBalance.dividedBy(new BigNumber(10).pow(18)).toNumber(), 1000);
        });
        
    // ////////////////////////////  Allocation functions    //// //////////////////////////////////////////
    
    it('releaseEnjinTeamTokens: verifies the enjin team allocation after six months -- fails called before 6 months',
    async() => {
        let token = await ENJToken.new(crowdfundAddress, advisorAddress, incentiveAddress, teamAddress, {from: owner});
        try {
            await token.releaseEnjinTeamTokens({from: owner});
        } catch (err) {
            return Utils.ensureException(err);
        }
    });

    it('releaseAdvisorTokens: verifies the enjin advisor allocation after two months -- fails called before 2 months',
        async() => {
            let token = await ENJToken.new(crowdfundAddress, advisorAddress, incentiveAddress, teamAddress, {from: owner});
            try {
                await token.releaseAdvisorTokens({from: owner});
            } catch (err) {
                return Utils.ensureException(err);
            }
        });

    it('retrieveUnsoldTokens: verifies the retrieval of the unsold tokens after six months -- fails called before the 6 months',
    async() => {
        let crowdsale = await ENJCrowdfund.new(1000000, beneficiary)
        let token = await ENJToken.new(crowdsale.address, advisorAddress, incentiveAddress, teamAddress, {from: owner});
        try {
            await token.retrieveUnsoldTokens({from: owner});
        } catch (error) {
            return Utils.ensureException(error);
        }
    });

    it('Jumps 6 months forward', async() => {
        let token = await ENJToken.new(crowdfundAddress, advisorAddress, incentiveAddress, teamAddress, {from: owner});
        let currentTime = Math.floor(Date.now() / 1000);
        let endTime = await token
            .endTime
            .call();
        let durationToInc = Math.floor(15552000 + 20000);
        await timeJump(durationToInc);
        assert.strictEqual(true, true);
    });
    
    
    it('releaseEnjinTeamTokens: verifies the enjin team allocation after six months', async() => {
        let token = await ENJToken.new(crowdfundAddress, advisorAddress, incentiveAddress, teamAddress, {from: owner});
        let enjinTeamAllocation = (await token.enjinTeamAllocation.call())
            .dividedBy(new BigNumber(10).pow(18))
            .times(0.125)
            .toNumber();
        await token.releaseEnjinTeamTokens({from: owner});
        let balance = await token
            .balanceOf
            .call(teamAddress);
        assert.strictEqual(balance.dividedBy(new BigNumber(10).pow(18)).toNumber(), enjinTeamAllocation);
        let allocation = await token
            .totalAllocated
            .call();
        assert.strictEqual(allocation.dividedBy(new BigNumber(10).pow(18)).toNumber(), enjinTeamAllocation + incentiveAllocation);
        let totalAllocatedToTeam = await token
            .totalAllocatedToTeam
            .call();
        assert.strictEqual(totalAllocatedToTeam.dividedBy(new BigNumber(10).pow(18)).toNumber(), enjinTeamAllocation);
    });


    it('releaseEnjinTeamTokens: verifies the enjin team allocation after six months -- fail, double dip',
    async() => {
        let token = await ENJToken.new(crowdfundAddress, advisorAddress, incentiveAddress, teamAddress, {from: owner});
        let enjinTeamAllocation = (await token.enjinTeamAllocation.call())
            .dividedBy(new BigNumber(10).pow(18))
            .times(0.25)
            .toNumber();
        try {
            await token.releaseEnjinTeamTokens({from: owner});

        } catch (err) {
            return Utils.ensureException(err);
        }
    });

    it('releaseEnjinTeamTokens: verifies the enjin team allocation after six months -- fails called by other than user',
    async() => {
        let token = await ENJToken.new(crowdfundAddress, advisorAddress, incentiveAddress, teamAddress, {from: owner});
        try {
            await token.releaseEnjinTeamTokens({from: accounts[8]});
        } catch (err) {
            return Utils.ensureException(err);
        }
    });

    it('releaseAdvisorTokens: verifies the advisor token allocation after six month', async() => {
        let token = await ENJToken.new(crowdfundAddress, advisorAddress, incentiveAddress, teamAddress, {from: owner});
        await token.releaseAdvisorTokens({from: owner});
        let balance = await token
            .balanceOf
            .call(advisorAddress);
        assert.strictEqual(balance.dividedBy(new BigNumber(10).pow(18)).toNumber(), 26000000);
        let allocation = await token
            .totalAllocated
            .call();
        assert.strictEqual(allocation.dividedBy(new BigNumber(10).pow(18)).toNumber(), 26000000 + incentiveAllocation);
        let _advisorsAllocation = await token
            .totalAllocatedToAdvisors
            .call();
        assert.strictEqual(_advisorsAllocation.dividedBy(new BigNumber(10).pow(18)).toNumber(), 26000000);
    });

    it('releaseAdvisorTokens: verifies the enjin team allocation after six months -- fails called by other than user',
    async() => {
        let token = await ENJToken.new(crowdfundAddress, advisorAddress, incentiveAddress, teamAddress, {from: owner});
        try {
            await token.releaseAdvisorTokens({from: accounts[8]});
        } catch (err) {
            return Utils.ensureException(err);
        }
    });

   
    it('retrieveUnsoldTokens: verifies the retrieval of the unsold tokens after six months',
    async() => {
        let crowdsale = await ENJCrowdfund.new(1000000, beneficiary)
        let token = await ENJToken.new(crowdsale.address, advisorAddress, incentiveAddress, teamAddress, {from: owner});
        await token.retrieveUnsoldTokens({from: owner});
        let balance = await token
            .balanceOf
            .call(incentiveAddress);
        assert.strictEqual(balance.dividedBy(new BigNumber(10).pow(18)).toNumber(), 800000000 + 100000000);
        let crowdBalance = await token
            .balanceOf
            .call(crowdsale.address);
        assert.strictEqual(crowdBalance.dividedBy(new BigNumber(10).pow(18)).toNumber(), 0);
    });

    it('retrieveUnsoldTokens: verifies the retrieval of the unsold tokens after six months -- fails when msg.sender not equals to owner',
    async() => {
        let crowdsale = await ENJCrowdfund.new(1000000, beneficiary)
        let token = await ENJToken.new(crowdsale.address, advisorAddress, incentiveAddress, teamAddress, {from: owner});
        try {
            await token.retrieveUnsoldTokens({from: accounts[8]});
        } catch (error) {
            return Utils.ensureException(error);
        }
    });


    it('releaseEnjinTeamTokens: verifies all of the enjin team allocation', async() => {
        let token = await ENJToken.new(crowdfundAddress, advisorAddress, incentiveAddress, teamAddress, {from: owner});
        let balanceSoFar = 0;
        let enjinTeamAllocationOtherTranche = (await token.enjinTeamAllocation.call())
            .dividedBy(new BigNumber(10).pow(18))
            .times(0.125)
            .toNumber();
        // We are 6 months in, this should work
        await token.releaseEnjinTeamTokens({from: owner});
        let balance = await token
            .balanceOf
            .call(teamAddress);
            balanceSoFar = enjinTeamAllocationOtherTranche;
            assert.strictEqual(balance.dividedBy(new BigNumber(10).pow(18)).toNumber(), balanceSoFar);
            let allocation = await token
            .totalAllocated
            .call();
        assert.strictEqual(allocation.dividedBy(new BigNumber(10).pow(18)).toNumber(), enjinTeamAllocationOtherTranche + incentiveAllocation);
        let totalAllocatedToTeam = await token
            .totalAllocatedToTeam
            .call();
        assert.strictEqual(totalAllocatedToTeam.dividedBy(new BigNumber(10).pow(18)).toNumber(), balanceSoFar);

        // Add 3 months
        for (let i = 0 ; i < 7; i++) {
            await timeJump(7776000 + 20000);
            await token.releaseEnjinTeamTokens({from: owner});
            balance = await token
                .balanceOf
                .call(teamAddress);
            balanceSoFar += enjinTeamAllocationOtherTranche;
            assert.strictEqual(balance.dividedBy(new BigNumber(10).pow(18)).toNumber(), balanceSoFar);
            allocation = await token
                .totalAllocated
                .call();
            assert.strictEqual(allocation.dividedBy(new BigNumber(10).pow(18)).toNumber(), balanceSoFar + incentiveAllocation);
            totalAllocatedToTeam = await token
                .totalAllocatedToTeam
                .call();
            assert.strictEqual(totalAllocatedToTeam.dividedBy(new BigNumber(10).pow(18)).toNumber(), balanceSoFar);

        }
        assert.strictEqual(totalAllocatedToTeam.dividedBy(new BigNumber(10).pow(18)).toNumber(), (await token.enjinTeamAllocation.call()).dividedBy(new BigNumber(10).pow(18)).toNumber())
        await timeJump(7776000 + 20000);
        try {
            await token.retrieveUnsoldTokens({from: accounts[8]});
        } catch (error) {
            Utils.ensureException(error);
        }
        await timeJump(77760000);
        try {
            await token.retrieveUnsoldTokens({from: accounts[8]});
        } catch (error) {
            Utils.ensureException(error);
        }
    });
});