/* global artifacts, contract, before, it, assert */
/* eslint-disable prefer-reflect */

const BancorConverter = artifacts.require('BancorConverter.sol');
const BancorX = artifacts.require('BancorX.sol');
const SmartToken = artifacts.require('SmartToken.sol');
const EtherToken = artifacts.require('EtherToken.sol');
const ContractRegistry = artifacts.require('ContractRegistry.sol');

const web3Utils = require('web3-utils')

const utils = require('./helpers/Utils');
const miningUtils = require('./helpers/MiningUtils');

const MAX_LOCK_LIMIT = '1000000000000000000000' // 1000 bnt
const MAX_RELEASE_LIMIT = '1000000000000000000000' // 1000 bnt
const MIN_LIMIT = '1000000000000000000' // 1 bnt
const LIM_INC_PER_BLOCK = '1000000000000000000' // 1 bnt
const MIN_REQUIRED_REPORTS = '3'
const BNT_AMOUNT = '77492920201018469141404133'
const BNT_RESERVE_AMOUNT = '45688650129186275318509'

// this is just gibberish bytes32
const eosAddress = '0xd5e9a21dbc95b47e2750562a96d365aa5fb6a75c000000000000000000000000'
const EOS_BLOCKCHAIN = '0xd5e9a21dbc95b47e2750562a96d365aa5fb6a75c000000000000000000000000'

let bancorX, defAccounts

const initBancorX = async accounts => {
    const etherToken = await EtherToken.new()
    const contractRegistry = await ContractRegistry.new()
    const smartToken = await SmartToken.new('Bancor', 'BNT', 18)
    const bancorConverter = await BancorConverter.new(
        smartToken.address,
        contractRegistry.address,
        '100000',
        etherToken.address,
        '100000'
    )

    await contractRegistry.registerAddress(web3Utils.asciiToHex('BNTConverter'), bancorConverter.address)
    await contractRegistry.registerAddress(web3Utils.asciiToHex('BNTToken'), smartToken.address)

    bancorX = await BancorX.new(
        MAX_LOCK_LIMIT,
        MAX_RELEASE_LIMIT,
        MIN_LIMIT,
        LIM_INC_PER_BLOCK,
        MIN_REQUIRED_REPORTS,
        contractRegistry.address
    )

    // register BancorX address
    await contractRegistry.registerAddress(web3Utils.asciiToHex('BancorX'), bancorX.address)

    // issue bnt and transfer ownership to converter
    await smartToken.issue(accounts[0], BNT_AMOUNT)
    await smartToken.transferOwnership(bancorConverter.address)

    // set virtual weight and bancorx address for bnt converter, and accept token ownership
    await bancorConverter.updateConnector(etherToken.address, '100000', true, BNT_RESERVE_AMOUNT)
    await bancorConverter.acceptTokenOwnership()
    await bancorConverter.enableClaimTokens(true);
}

contract('BancorX', async accounts => {
    // initialize BancorX contracts
    before(async () => {
        defAccounts = accounts
        await initBancorX(accounts)
    })

    it('should have the correct state variables after constructions', async () => {
        let maxLockLimit = (await bancorX.maxLockLimit.call()).toString(10)
        let maxReleaseLimit = (await bancorX.maxReleaseLimit.call()).toString(10)
        let minLimit = (await bancorX.minLimit.call()).toString(10)
        let limitIncPerBlock = (await bancorX.limitIncPerBlock.call()).toString(10)
        let minRequiredReports = (await bancorX.minRequiredReports.call()).toString(10)

        assert.equal(maxLockLimit, MAX_LOCK_LIMIT)
        assert.equal(maxReleaseLimit, MAX_RELEASE_LIMIT)
        assert.equal(minLimit, MIN_LIMIT)
        assert.equal(limitIncPerBlock, LIM_INC_PER_BLOCK)
        assert.equal(minRequiredReports, MIN_REQUIRED_REPORTS)
    })

    it('should allow the owner to set reporters', async () => {
        await bancorX.setReporter(accounts[1], true)
        await bancorX.setReporter(accounts[2], true)
        await bancorX.setReporter(accounts[3], true)

        assert.equal(await bancorX.reporters.call(accounts[1]), true)
        assert.equal(await bancorX.reporters.call(accounts[2]), true)
        assert.equal(await bancorX.reporters.call(accounts[3]), true)
    })

    it('should not be able to lock above or below the max/min limit', async () => {
        let amountAboveLimit = web3Utils.toWei('1001', 'ether')
        let amountBelowLimit = web3Utils.toWei('0.5', 'ether')

        try {
            await bancorX.xTransfer(EOS_BLOCKCHAIN, eosAddress, amountAboveLimit)
            assert(false, "didn't throw")
        } catch(error) {
            utils.ensureException(error)
        }

        try {
            await bancorX.xTransfer(EOS_BLOCKCHAIN, eosAddress, amountBelowLimit)
            assert(false, "didn't throw")
        } catch(error) {
            utils.ensureException(error)
        }
    })

    it('should emit an event when successfuly locking bnt', async () => {
        let amountToSend = (web3Utils.toWei('1', 'ether')).toString(10)
        let result = await bancorX.xTransfer(EOS_BLOCKCHAIN, eosAddress, amountToSend)
        let eventArgs = result.logs[0].args

        let amount = web3Utils.hexToNumberString(eventArgs._amount)
        let from = eventArgs._from

        assert.equal(amount, amountToSend)
        assert.equal(from.toLowerCase(), accounts[0].toLowerCase())
    })

    it('should properly calculate the current lock limit after a single transaction', async () => {
        let amountToSend = (web3Utils.toWei('10', 'ether')).toString(10)
        await bancorX.xTransfer(EOS_BLOCKCHAIN, eosAddress, amountToSend)
        // after the transaction, a block was mined, so the limit is 991 (not 990)
        assert.equal((await bancorX.getCurrentLockLimit.call()).toString(10), (web3Utils.toWei('991', 'ether')).toString(10))

        // after 5 blocks, the limit should increase by 5 bnt
        await mineBlocks(5)
        assert.equal((await bancorX.getCurrentLockLimit.call()).toString(10), (web3Utils.toWei('996', 'ether')).toString(10))

        // after another 5 blocks, the limit should be back to 1000
        await mineBlocks(5)
        assert.equal((await bancorX.getCurrentLockLimit.call()).toString(10), (web3Utils.toWei('1000', 'ether')).toString(10))
    })

    it('should not allow a reporter to report the same transaction twice', async () => {
        let amountToSend = (web3Utils.toWei('1', 'ether'))
        let randomTxId = getRandomTxId()
        await bancorX.reportTx(
            EOS_BLOCKCHAIN,
            randomTxId,
            accounts[0],
            amountToSend,
            0,
            { from: accounts[1] }
        )
        try {
            await bancorX.reportTx(
                EOS_BLOCKCHAIN,
                randomTxId,
                accounts[0],
                amountToSend,
                0,
                { from: accounts[1] }
            )
            assert(false, "didn't throw")
        } catch(error) {
            utils.ensureException(error)
        }
    })

    it('should not allow two reporters to give conflicting transaction details', async () => {
        let amountToSend = (web3Utils.toWei('1', 'ether'))
        let randomTxId = getRandomTxId()

        await bancorX.reportTx(
            EOS_BLOCKCHAIN,
            randomTxId,
            accounts[0],
            amountToSend,
            0,
            { from: accounts[1] }
        )

        try {
            await bancorX.reportTx(
                EOS_BLOCKCHAIN,
                randomTxId,
                accounts[1],
                amountToSend,
                0,
                { from: accounts[1] }
            )
            assert(false, "didn't throw")
        } catch(error) {
            utils.ensureException(error)
        }
    })

    it('should not be able to release above or below the max/min limit', async () => {
        let amountAboveLimit = web3Utils.toWei('1001', 'ether')
        let amountBelowLimit = web3Utils.toWei('0.5', 'ether')
        let randomTxId = getRandomTxId()

        try {
            await reportAndRelease(accounts[0], eosAddress, amountAboveLimit, randomTxId, EOS_BLOCKCHAIN)
            assert(false, "didn't throw")
        } catch(error) {
            utils.ensureException(error)
        }

        try {
            await reportAndRelease(accounts[0], eosAddress, amountBelowLimit, randomTxId, EOS_BLOCKCHAIN)
            assert(false, "didn't throw")
        } catch(error) {
            utils.ensureException(error)
        }
    })

    it('should only allow reporters to report', async () => {
        let randomTxId = getRandomTxId()
        let amountToSend = (web3Utils.toWei('1', 'ether'))
        try {
            await bancorX.reportTx(
                EOS_BLOCKCHAIN,
                randomTxId,
                accounts[0],
                amountToSend,
                0,
                { from: accounts[4] } // not reporter
            )
        } catch(error) {
            utils.ensureException(error)
        }
    })

    it('shouldnt allow reports when disabled', async () => {
        await bancorX.enableReporting(false)
        let amountToSend = (web3Utils.toWei('1', 'ether'))
        let randomTxId = getRandomTxId()        
        try {
            await bancorX.reportTx(
                EOS_BLOCKCHAIN,
                randomTxId,
                accounts[0],
                amountToSend,
                0,
                { from: accounts[1] }
            )
            assert(false, "didn't throw")
        } catch(error) {
            utils.ensureException(error)
            await bancorX.enableReporting(true)
        }
    })

    it('shouldnt allow xTransfers when disabled', async () => {
        await bancorX.enableXTransfers(false)
        let amountToSend = (web3Utils.toWei('1', 'ether'))
        try {
            await bancorX.xTransfer(
                EOS_BLOCKCHAIN,
                eosAddress,
                amountToSend
            )
            assert(false, "didn't throw")
        } catch(error) {
            utils.ensureException(error)
            await bancorX.enableXTransfers(true)
        }
    })

    it('Gas Test', async () => {
        let amountToSend = (web3Utils.toWei('10', 'ether')).toString(10)
        let randomTxId = getRandomTxId()

        // gas cost for xTransfer
        let result1 = await bancorX.xTransfer(EOS_BLOCKCHAIN, eosAddress, amountToSend)
        // gas cost for being first reporter
        let result2 = await bancorX.reportTx(
            EOS_BLOCKCHAIN,
            randomTxId,
            accounts[0],
            amountToSend,
            0,
            { from: accounts[1] }
        )
        // gas cost for being second reporter
        let result3 = await bancorX.reportTx(
            EOS_BLOCKCHAIN,
            randomTxId,
            accounts[0],
            amountToSend,
            0,
            { from: accounts[2] }
        )
        // gas cost for being third reporter
        let result4 = await bancorX.reportTx(
            EOS_BLOCKCHAIN,
            randomTxId,
            accounts[0],
            amountToSend,
            0,
            { from: accounts[3] }
        )

        // console.log(`GasPrice for xTransfer: ${result1.receipt.gasUsed}`)
        // console.log(`GasPrice for reportTx (first reporter, no release): ${result2.receipt.gasUsed}`)
        // console.log(`GasPrice for reportTx (second reporter, no release): ${result3.receipt.gasUsed}`)
        // console.log(`GasPrice for reportTx (third reporter, yes release): ${result4.receipt.gasUsed}`)
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
            0,
            { from: defAccounts[i] }
        )
    }
}

// helper function for mining blocks
async function mineBlocks(amount) {
    for (let i = 0; i < amount; i++) {
        await miningUtils.mineBlock(web3.currentProvider)
    }
}

// returns random number between 0 and 10,000,000
function getRandomTxId() {
    return getRandomInt(0, 10000000)
}

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}