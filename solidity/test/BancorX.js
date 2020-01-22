/* global artifacts, contract, before, it, assert */
/* eslint-disable prefer-reflect */

const utils = require('./helpers/Utils');
const ContractRegistryClient = require('./helpers/ContractRegistryClient');

const BancorConverter = artifacts.require('BancorConverter');
const BancorX = artifacts.require('BancorX');
const SmartToken = artifacts.require('SmartToken');
const EtherToken = artifacts.require('EtherToken');
const ContractRegistry = artifacts.require('ContractRegistry');

const MAX_LOCK_LIMIT    = web3.toBigNumber('1000000000000000000000') // 1000 tokens
const MAX_RELEASE_LIMIT = web3.toBigNumber('1000000000000000000000') // 1000 tokens
const MIN_LIMIT         = web3.toBigNumber('1000000000000000000') // 1 token
const LIM_INC_PER_BLOCK = web3.toBigNumber('1000000000000000000') // 1 token
const TEST_AMOUNT       = web3.toBigNumber('10000000000000000000') // 10 tokens
const SUPPLY_AMOUNT     = web3.toBigNumber('77492920201018469141404133')
const RESERVE_AMOUNT    = web3.toBigNumber('45688650129186275318509')
const MIN_REQ_REPORTS   = web3.toBigNumber('3')
const TRANSACTION_ID    = web3.toBigNumber('12345678')
const X_TRANSFER_ID     = web3.toBigNumber('87654321')

const EOS_ADDRESS    = web3.fromAscii('just a string 1')
const EOS_BLOCKCHAIN = web3.fromAscii('just a string 2')

function assertEqual(x, y) {
    assert.equal(x.toFixed(), y.toFixed())
}

async function initBancorX(accounts, isSmartToken) {
    const etherToken = await EtherToken.new('Ether', 'ETH')
    const contractRegistry = await ContractRegistry.new()
    const smartToken = await SmartToken.new('Bancor', 'BNT', 18)
    const bancorConverter = await BancorConverter.new(
        smartToken.address,
        contractRegistry.address,
        '100000',
        etherToken.address,
        '100000'
    )

    const bancorX = await BancorX.new(
        MAX_LOCK_LIMIT,
        MAX_RELEASE_LIMIT,
        MIN_LIMIT,
        LIM_INC_PER_BLOCK,
        MIN_REQ_REPORTS,
        contractRegistry.address,
        smartToken.address,
        isSmartToken
    )

    // register BancorX address
    await contractRegistry.registerAddress(ContractRegistryClient.BANCOR_X, bancorX.address)

    // issue bnt
    await smartToken.issue(accounts[0], SUPPLY_AMOUNT)

    // set bancorx address for bnt converter

    if (isSmartToken) {
        await smartToken.transferOwnership(bancorConverter.address)
        await bancorConverter.acceptTokenOwnership()
        await bancorConverter.setBancorX(bancorX.address)
    }
    else {
        await smartToken.approve(bancorX.address, SUPPLY_AMOUNT)
    }

    return bancorX;
}

contract('BancorX', async accounts => {
    for (const isSmartToken of [false, true]) {
        describe(`with ${isSmartToken ? 'smart' : 'erc20'} token:`, () => {
            it('should allow the owner to set reporters', async () => {
                let bancorX = await initBancorX(accounts, isSmartToken)
                await bancorX.setReporter(accounts[1], true)
                await bancorX.setReporter(accounts[2], true)
                await bancorX.setReporter(accounts[3], true)

                assert.equal(await bancorX.reporters.call(accounts[1]), true)
                assert.equal(await bancorX.reporters.call(accounts[2]), true)
                assert.equal(await bancorX.reporters.call(accounts[3]), true)
            })

            it('should not allow a non-owner to set reporters', async () => {
                let bancorX = await initBancorX(accounts, isSmartToken)
                await utils.catchRevert(bancorX.setReporter(accounts[1], true, {from: accounts[1]}))
                await utils.catchRevert(bancorX.setReporter(accounts[2], true, {from: accounts[1]}))
                await utils.catchRevert(bancorX.setReporter(accounts[3], true, {from: accounts[1]}))

                assert.equal(await bancorX.reporters.call(accounts[1]), false)
                assert.equal(await bancorX.reporters.call(accounts[2]), false)
                assert.equal(await bancorX.reporters.call(accounts[3]), false)
            })

            it('should allow the owner to set limits', async () => {
                let bancorX = await initBancorX(accounts, isSmartToken)
                await bancorX.setMaxLockLimit(MAX_LOCK_LIMIT.plus(1))
                await bancorX.setMaxReleaseLimit(MAX_RELEASE_LIMIT.plus(1))
                await bancorX.setMinLimit(MIN_LIMIT.plus(1))
                await bancorX.setLimitIncPerBlock(LIM_INC_PER_BLOCK.plus(1))
                await bancorX.setMinRequiredReports(MIN_REQ_REPORTS.plus(1))

                let maxLockLimit = await bancorX.maxLockLimit.call()
                let maxReleaseLimit = await bancorX.maxReleaseLimit.call()
                let minLimit = await bancorX.minLimit.call()
                let limitIncPerBlock = await bancorX.limitIncPerBlock.call()
                let minRequiredReports = await bancorX.minRequiredReports.call()

                assertEqual(maxLockLimit, MAX_LOCK_LIMIT.plus(1))
                assertEqual(maxReleaseLimit, MAX_RELEASE_LIMIT.plus(1))
                assertEqual(minLimit, MIN_LIMIT.plus(1))
                assertEqual(limitIncPerBlock, LIM_INC_PER_BLOCK.plus(1))
                assertEqual(minRequiredReports, MIN_REQ_REPORTS.plus(1))
            })

            it('should not allow a non-owner to set limits', async () => {
                let bancorX = await initBancorX(accounts, isSmartToken)
                await utils.catchRevert(bancorX.setMaxLockLimit(MAX_LOCK_LIMIT.plus(1), {from: accounts[1]}))
                await utils.catchRevert(bancorX.setMaxReleaseLimit(MAX_RELEASE_LIMIT.plus(1), {from: accounts[1]}))
                await utils.catchRevert(bancorX.setMinLimit(MIN_LIMIT.plus(1), {from: accounts[1]}))
                await utils.catchRevert(bancorX.setLimitIncPerBlock(LIM_INC_PER_BLOCK.plus(1), {from: accounts[1]}))
                await utils.catchRevert(bancorX.setMinRequiredReports(MIN_REQ_REPORTS.plus(1), {from: accounts[1]}))

                let maxLockLimit = await bancorX.maxLockLimit.call()
                let maxReleaseLimit = await bancorX.maxReleaseLimit.call()
                let minLimit = await bancorX.minLimit.call()
                let limitIncPerBlock = await bancorX.limitIncPerBlock.call()
                let minRequiredReports = await bancorX.minRequiredReports.call()

                assertEqual(maxLockLimit, MAX_LOCK_LIMIT)
                assertEqual(maxReleaseLimit, MAX_RELEASE_LIMIT)
                assertEqual(minLimit, MIN_LIMIT)
                assertEqual(limitIncPerBlock, LIM_INC_PER_BLOCK)
                assertEqual(minRequiredReports, MIN_REQ_REPORTS)
            })

            it('should not be able to lock below the min limit', async () => {
                let bancorX = await initBancorX(accounts, isSmartToken)
                let amount = MIN_LIMIT.minus(1)
                await utils.catchRevert(bancorX.xTransfer(EOS_BLOCKCHAIN, EOS_ADDRESS, amount))
            })

            it('should not be able to lock above the max limit', async () => {
                let bancorX = await initBancorX(accounts, isSmartToken)
                let amount = MAX_LOCK_LIMIT.plus(1)
                await utils.catchRevert(bancorX.xTransfer(EOS_BLOCKCHAIN, EOS_ADDRESS, amount))
            })

            it('should not be able to release below the min limit', async () => {
                let bancorX = await initBancorX(accounts, isSmartToken)
                let amount = MIN_LIMIT.minus(1)
                await bancorX.setReporter(accounts[1], true)
                await bancorX.setReporter(accounts[2], true)
                await bancorX.setReporter(accounts[3], true)
                await bancorX.reportTx(EOS_BLOCKCHAIN, TRANSACTION_ID, accounts[0], amount, X_TRANSFER_ID, {from: accounts[1]})
                await bancorX.reportTx(EOS_BLOCKCHAIN, TRANSACTION_ID, accounts[0], amount, X_TRANSFER_ID, {from: accounts[2]})
                await utils.catchRevert(bancorX.reportTx(EOS_BLOCKCHAIN, TRANSACTION_ID, accounts[0], amount, X_TRANSFER_ID, {from: accounts[3]}))
            })

            it('should not be able to release above the max limit', async () => {
                let bancorX = await initBancorX(accounts, isSmartToken)
                let amount = MAX_RELEASE_LIMIT.plus(1)
                await bancorX.setReporter(accounts[1], true)
                await bancorX.setReporter(accounts[2], true)
                await bancorX.setReporter(accounts[3], true)
                await bancorX.reportTx(EOS_BLOCKCHAIN, TRANSACTION_ID, accounts[0], amount, X_TRANSFER_ID, {from: accounts[1]})
                await bancorX.reportTx(EOS_BLOCKCHAIN, TRANSACTION_ID, accounts[0], amount, X_TRANSFER_ID, {from: accounts[2]})
                await utils.catchRevert(bancorX.reportTx(EOS_BLOCKCHAIN, TRANSACTION_ID, accounts[0], amount, X_TRANSFER_ID, {from: accounts[3]}))
            })

            it('should emit an event when successfuly locking tokens', async () => {
                let bancorX = await initBancorX(accounts, isSmartToken)
                let amount = TEST_AMOUNT
                let result = await bancorX.xTransfer(EOS_BLOCKCHAIN, EOS_ADDRESS, amount)
                assert.equal(result.logs[0].args._amount, amount.toFixed())
                assert.equal(result.logs[0].args._from, accounts[0])
            })

            it('should properly calculate the current lock limit after a single transaction', async () => {
                let bancorX = await initBancorX(accounts, isSmartToken)
                let numOfTests = 10;
                let amount = LIM_INC_PER_BLOCK.times(numOfTests)
                await bancorX.xTransfer(EOS_BLOCKCHAIN, EOS_ADDRESS, amount)

                for (let i = 0; i <= numOfTests; i++) {
                    assertEqual(await bancorX.getCurrentLockLimit.call(), MAX_LOCK_LIMIT.minus(amount).plus(MIN_LIMIT.times(i)))
                    web3.currentProvider.send({method: 'evm_mine'});
                }

                for (let i = 0; i < 3; i++) {
                    assertEqual(await bancorX.getCurrentLockLimit.call(), MAX_LOCK_LIMIT)
                    web3.currentProvider.send({method: 'evm_mine'});
                }
            })

            it('should not allow a reporter to report the same transaction twice', async () => {
                let bancorX = await initBancorX(accounts, isSmartToken)
                await bancorX.setReporter(accounts[1], true)
                await bancorX.reportTx(EOS_BLOCKCHAIN, TRANSACTION_ID, accounts[0], TEST_AMOUNT, X_TRANSFER_ID, {from: accounts[1]})
                await utils.catchRevert(bancorX.reportTx(EOS_BLOCKCHAIN, TRANSACTION_ID, accounts[0], TEST_AMOUNT, X_TRANSFER_ID, {from: accounts[1]}))
            })

            it('should not allow two reporters to give conflicting transaction details', async () => {
                let bancorX = await initBancorX(accounts, isSmartToken)
                await bancorX.setReporter(accounts[1], true)
                await bancorX.setReporter(accounts[2], true)
                await bancorX.reportTx(EOS_BLOCKCHAIN, TRANSACTION_ID, accounts[1], TEST_AMOUNT, X_TRANSFER_ID, {from: accounts[1]})
                await utils.catchRevert(bancorX.reportTx(EOS_BLOCKCHAIN, TRANSACTION_ID, accounts[2], TEST_AMOUNT, X_TRANSFER_ID, {from: accounts[2]}))
            })

            it('should not allow a non-reporter to report', async () => {
                let bancorX = await initBancorX(accounts, isSmartToken)
                await utils.catchRevert(bancorX.reportTx(EOS_BLOCKCHAIN, TRANSACTION_ID, accounts[0], TEST_AMOUNT, X_TRANSFER_ID, {from: accounts[1]}))
            })

            it('should not allow reports when disabled', async () => {
                let bancorX = await initBancorX(accounts, isSmartToken)
                await bancorX.setReporter(accounts[1], true)
                await bancorX.enableReporting(false)
                await utils.catchRevert(bancorX.reportTx(EOS_BLOCKCHAIN, TRANSACTION_ID, accounts[0], TEST_AMOUNT, X_TRANSFER_ID, {from: accounts[1]}))
            })

            it('should not allow xTransfers when disabled', async () => {
                let bancorX = await initBancorX(accounts, isSmartToken)
                await bancorX.enableXTransfers(false)
                await utils.catchRevert(bancorX.xTransfer(EOS_BLOCKCHAIN, EOS_ADDRESS, TEST_AMOUNT))
            })

            it('Gas Test', async () => {
                let bancorX = await initBancorX(accounts, isSmartToken)
                await bancorX.setReporter(accounts[1], true)
                await bancorX.setReporter(accounts[2], true)
                await bancorX.setReporter(accounts[3], true)
                let result0 = await bancorX.xTransfer(EOS_BLOCKCHAIN, EOS_ADDRESS, TEST_AMOUNT)
                let result1 = await bancorX.reportTx(EOS_BLOCKCHAIN, TRANSACTION_ID, accounts[0], TEST_AMOUNT, X_TRANSFER_ID, {from: accounts[1]})
                let result2 = await bancorX.reportTx(EOS_BLOCKCHAIN, TRANSACTION_ID, accounts[0], TEST_AMOUNT, X_TRANSFER_ID, {from: accounts[2]})
                let result3 = await bancorX.reportTx(EOS_BLOCKCHAIN, TRANSACTION_ID, accounts[0], TEST_AMOUNT, X_TRANSFER_ID, {from: accounts[3]})
                console.log(`\nGasPrice for xTransfer: ${result0.receipt.gasUsed}`)
                console.log(`GasPrice for reportTx (first reporter, no release): ${result1.receipt.gasUsed}`)
                console.log(`GasPrice for reportTx (second reporter, no release): ${result2.receipt.gasUsed}`)
                console.log(`GasPrice for reportTx (third reporter, yes release): ${result3.receipt.gasUsed}`)
            })
        })
    }
})
