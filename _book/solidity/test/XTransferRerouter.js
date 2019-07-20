/* global artifacts, contract, before, it, assert */
/* eslint-disable prefer-reflect */

const XTransferRerouter = artifacts.require('XTransferRerouter.sol');
const utils = require('./helpers/Utils');


let txRouter
let accounts
const eosAddress = web3.fromAscii('some.account')

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
            eosAddress,
            web3.fromAscii('EOS'),
            { from: accounts[1] }
        ))
        
    })
    it('verify that calling rerouteTx emits an event properly', async () => {
        txRouter = await XTransferRerouter.new(true, {
            from: accounts[0]
        })
        const tx = await txRouter.rerouteTx(
            123,
            eosAddress,
            web3.fromAscii('EOS'),
            { from: accounts[1] }
        )
        let event = false
        tx.logs.forEach(log => {
            if (log.event === 'TxReroute')
                event = true
        })
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
        let reroutingEnabled = await txRouter.reroutingEnabled.call()
        assert(!reroutingEnabled)
        await txRouter.enableRerouting(
            true,
            { from: accounts[0] }
        )
        reroutingEnabled = await txRouter.reroutingEnabled.call()
        assert(reroutingEnabled === true, 'reroutingEnabled didn\'t get updated properly!')
    })
})

