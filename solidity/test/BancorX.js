/* global artifacts, contract, before, it, assert */
/* eslint-disable prefer-reflect */

const BancorConverter = artifacts.require('BancorConverter.sol');
const BancorX = artifacts.require('BancorX.sol');
const SmartToken = artifacts.require('SmartToken.sol');

const utils = require('./helpers/Utils');
const web3Utils = require('./helpers/Web3Utils');

let bancorX;
let accounts;

const MAX_LOCK_LIMIT = '1000000000000000000000'; // 1000 bnt
const MAX_RELEASE_LIMIT = '1000000000000000000000'; // 1000 bnt
const MIN_LIMIT = '1000000000000000000'; // 1 bnt
const LIM_INC_PER_BLOCK = '1000000000000000000'; // 1 bnt
const MIN_REQUIRED_REPORTS = '3';

const provider = web3.currentProvider;

// this is just bytes32
const eosAddress = '0xd5e9a21dbc95b47e2750562a96d365aa5fb6a75c000000000000000000000000';
const EOS_BLOCKCHAIN = '0xd5e9a21dbc95b47e2750562a96d365aa5fb6a75c000000000000000000000000';

contract('BancorX', async => {
    // get contracts deployed during migration (truffle migrates contracts before tests)
    before(async () => {
        accounts = await web3.eth.getAccounts();
        bancorX = await BancorX.deployed();
        converter = await BancorConverter.deployed();
        bnt = await SmartToken.deployed();
    })

    it('should have the correct state after constructions', async () => {
        let maxLockLimit = (await bancorX.maxLockLimit.call()).toString();
        let maxReleaseLimit = (await bancorX.maxReleaseLimit.call()).toString();
        let minLimit = (await bancorX.minLimit.call()).toString();
        let limitIncPerBlock = (await bancorX.limitIncPerBlock.call()).toString();
        let minRequiredReports = (await bancorX.minRequiredReports.call()).toString();

        assert.equal(maxLockLimit, MAX_LOCK_LIMIT);
        assert.equal(maxReleaseLimit, MAX_RELEASE_LIMIT);
        assert.equal(minLimit, MIN_LIMIT);
        assert.equal(limitIncPerBlock, LIM_INC_PER_BLOCK);
        assert.equal(minRequiredReports, MIN_REQUIRED_REPORTS);
    })

    it('should allow the owner to set reporters', async () => {
        await bancorX.setReporter(accounts[1], true);
        await bancorX.setReporter(accounts[2], true);
        await bancorX.setReporter(accounts[3], true);

        assert.equal(await bancorX.reporters.call(accounts[1]), true);
        assert.equal(await bancorX.reporters.call(accounts[2]), true);
        assert.equal(await bancorX.reporters.call(accounts[3]), true);
    })

    it('should not be able to lock above or below the max/min limit', async () => {
        let amountAboveLimit = web3.utils.toWei('1001', 'ether');
        let amountBelowLimit = web3.utils.toWei('0.5', 'ether');

        try {
            await bancorX.xTransfer(EOS_BLOCKCHAIN, eosAddress, amountAboveLimit);
            assert(false, "didn't throw");

        } catch(error) {
            utils.ensureException(error);
        }

        try {
            await bancorX.xTransfer(EOS_BLOCKCHAIN, eosAddress, amountBelowLimit);
            assert(false, "didn't throw");

        } catch(error) {
            utils.ensureException(error);
        }
    })

    it('should emit an event when successfuly locking bnt', async () => {
        let amountToSend = (web3.utils.toWei('1', 'ether')).toString();
        let result = await bancorX.xTransfer(EOS_BLOCKCHAIN, eosAddress, amountToSend);
        let eventArgs = result.logs[0].args;

        let amount = web3.utils.hexToNumberString(eventArgs._amount);
        let from = eventArgs._from;

        assert.equal(amount, amountToSend);
        assert.equal(from.toLowerCase(), accounts[0].toLowerCase());
    })

    it('should properly calculate the current lock limit after a single transaction', async () => {
        let amountToSend = (web3.utils.toWei('10', 'ether')).toString();
        await bancorX.xTransfer(EOS_BLOCKCHAIN, eosAddress, amountToSend);
        // after the transaction, a block was mined, so the limit is 991 (not 990)
        assert.equal((await bancorX.getCurrentLockLimit.call()).toString(), (web3.utils.toWei('991', 'ether')).toString());

        // after 5 blocks, the limit should increase by 5 bnt
        await mineBlocks(5);
        assert.equal((await bancorX.getCurrentLockLimit.call()).toString(), (web3.utils.toWei('996', 'ether')).toString());

        // after another 5 blocks, the limit should be back to 1000
        await mineBlocks(5);
        assert.equal((await bancorX.getCurrentLockLimit.call()).toString(), (web3.utils.toWei('1000', 'ether')).toString());
    })

    // it.only('should properly calculate the lock limit with multiple transactions in one block', async () => {
    //     let amountToSend = (web3.utils.toWei('10', 'ether')).toString()
    //     await web3Utils.stopMining(provider)
    //     bancorX.xTransfer(eosAddress, amountToSend, EOS_BLOCKCHAIN)
    //     bancorX.xTransfer(eosAddress, amountToSend, EOS_BLOCKCHAIN)
    //     await sleep(500)
    //     await web3Utils.mineBlock(provider)
    //     // after locking 20 bnt a block is mined, so the limit should be 981
    //     assert.equal((await bancorX.getCurrentLockLimit.call()).toString(), (web3.utils.toWei('981', 'ether')).toString())
    // })

    it('should not allow a reporter to report the same transaction twice', async () => {
        let amountToSend = (web3.utils.toWei('1', 'ether'));
        let randomTxId = getRandomTxId();
        await bancorX.reportTx(
            EOS_BLOCKCHAIN,
            randomTxId,
            accounts[0],
            amountToSend,
            { from: accounts[1] }
        )
        try {
            await bancorX.reportTx(
                EOS_BLOCKCHAIN,
                randomTxId,
                accounts[0],
                amountToSend,
                { from: accounts[1] }
            )
            assert(false, "didn't throw");

        }
        catch (error) {
            utils.ensureException(error);
        }
    })

    it('should not allow two reporters to give conflicting transaction details', async () => {
        let amountToSend = (web3.utils.toWei('1', 'ether'));
        let randomTxId = getRandomTxId();

        await bancorX.reportTx(
            EOS_BLOCKCHAIN,
            randomTxId,
            accounts[0],
            amountToSend,
            { from: accounts[1] }
        )

        try {
            await bancorX.reportTx(
                EOS_BLOCKCHAIN,
                randomTxId,
                accounts[1],
                amountToSend,
                { from: accounts[1] }
            )
            assert(false, "didn't throw");
        }
        catch (error) {
            utils.ensureException(error);
        }
    })

    it('should not be able to release above or below the max/min limit', async () => {
        let amountAboveLimit = web3.utils.toWei('1001', 'ether');
        let amountBelowLimit = web3.utils.toWei('0.5', 'ether');
        let randomTxId = getRandomTxId();

        try {
            await reportAndRelease(accounts[0], eosAddress, amountAboveLimit, randomTxId, EOS_BLOCKCHAIN);
            assert(false, "didn't throw");

        } catch(error) {
            utils.ensureException(error);
        }

        try {
            await reportAndRelease(accounts[0], eosAddress, amountBelowLimit, randomTxId, EOS_BLOCKCHAIN);
            assert(false, "didn't throw");

        } catch(error) {
            utils.ensureException(error);
        }
    })

    it('Gas Test', async () => {
        let amountToSend = (web3.utils.toWei('10', 'ether')).toString();
        let randomTxId = getRandomTxId();

        // gas cost for xTransfer
        let result1 = await bancorX.xTransfer(EOS_BLOCKCHAIN, eosAddress, amountToSend);
        // gas cost for being first reporter
        let result2 = await bancorX.reportTx(
            EOS_BLOCKCHAIN,
            randomTxId,
            accounts[0],
            amountToSend,
            { from: accounts[1] }
        )
        // gas cost for being second reporter
        let result3 = await bancorX.reportTx(
            EOS_BLOCKCHAIN,
            randomTxId,
            accounts[0],
            amountToSend,
            { from: accounts[2] }
        )
        // gas cost for being third reporter
        let result4 = await bancorX.reportTx(
            EOS_BLOCKCHAIN,
            randomTxId,
            accounts[0],
            amountToSend,
            { from: accounts[3] }
        )

        console.log(`GasPrice for xTransfer: ${result1.receipt.gasUsed}`);
        console.log(`GasPrice for reportTx (first reporter, no release): ${result2.receipt.gasUsed}`);
        console.log(`GasPrice for reportTx (second reporter, no release): ${result3.receipt.gasUsed}`);
        console.log(`GasPrice for reportTx (third reporter, yes release): ${result4.receipt.gasUsed}`);
    })
})

// reports transaction from accounts 1, 2, and 3 (all 3 reporters)
async function reportAndRelease(to, from, amount, txId, blockchainType) {
    for (let i = 1; i <= 3; i++) {
        await bancorX.reportTx(
            blockchainType,
            txId,
            to,
            amount,
            { from: accounts[i] }
        )
    }
}

// helper function for mining blocks
async function mineBlocks(amount) {
    for (let i = 0; i < amount; i++) {
        await web3Utils.mineBlock(provider);
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// returns random number between 0 and 10,000,000
function getRandomTxId() {
    return getRandomInt(0, 10000000);
}

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}