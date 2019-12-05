/* global artifacts, contract, before, it, assert */
/* eslint-disable prefer-reflect */

const XTransferRerouter = artifacts.require('XTransferRerouter');
const utils = require('./helpers/Utils');

const EOS_ADDRESS    = web3.fromAscii('just a string 1')
const EOS_BLOCKCHAIN = web3.fromAscii('just a string 2')

let txRouter
let accounts

contract('XTransferRerouter', async () => {
    // get contracts deployed during migration (truffle migrates contracts before tests)
    before(async () => {
        accounts = await web3.eth.accounts
        
    })

    it('verify that a user can\'t call rerouteTx when rerouting is disabled', async () => {
        txRouter = await XTransferRerouter.new(false, {
            from: accounts[0]
        })
        await utils.catchRevert(txRouter.rerouteTx(
            123,
            EOS_ADDRESS,
            EOS_BLOCKCHAIN,
            { from: accounts[1] }
        ))
        
    })
    it('verify that calling rerouteTx emits an event properly', async () => {
        txRouter = await XTransferRerouter.new(true, {
            from: accounts[0]
        })
        const tx = await txRouter.rerouteTx(
            123,
            EOS_ADDRESS,
            EOS_BLOCKCHAIN,
            { from: accounts[1] }
        )
        let event = tx.logs.some(log => log.event == 'TxReroute')
        assert(event, 'TxReroute event was not emitted')
    })

    it('verify that a non-owner can\'t call enableRerouting', async () => {
        txRouter = await XTransferRerouter.new(false, {
            from: accounts[0]
        })
        await utils.catchRevert(txRouter.enableRerouting(
            true,
            { from: accounts[1] }
        ))
    })

    it('verify that the owner can call enableRerouting', async () => {
        txRouter = await XTransferRerouter.new(false, {
            from: accounts[0]
        })
        let reroutingEnabledBefore = await txRouter.reroutingEnabled.call()
        await txRouter.enableRerouting(
            true,
            { from: accounts[0] }
        )
        let reroutingEnabledAfter = await txRouter.reroutingEnabled.call()
        assert(!reroutingEnabledBefore && reroutingEnabledAfter, 'reroutingEnabled didn\'t get updated properly!')
    })
})

