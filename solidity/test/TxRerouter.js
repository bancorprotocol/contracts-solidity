/* global artifacts, contract, before, it, assert */
/* eslint-disable prefer-reflect */

const TxRerouter = artifacts.require('TxRerouter.sol');

let txRouter
let accounts


const eosAddress = web3.fromAscii('some.account')

const VM_EXCEPTION_ERROR = 'Returned error: VM Exception while processing transaction: revert'

contract('TxRerouter', async () => {
    // get contracts deployed during migration (truffle migrates contracts before tests)
    before(async () => {
        accounts = await web3.eth.accounts
        
    })

    it('verify that a user can\'t call rerouteTx when rerouting is disabled', async () => {
        txRouter = await TxRerouter.new(false, {
            account: accounts[0]
        })
        const p = txRouter.rerouteTx(
            123,
            eosAddress,
            web3.fromAscii('EOS'),
            { account: accounts[1] }
        )
        await ensureVmException(p, VM_EXCEPTION_ERROR)
        
    })
    it('verify that calling rerouteTx emits an event properly', async () => {
        txRouter = await TxRerouter.new(true, {
            account: accounts[0]
        })
        const tx = await txRouter.rerouteTx(
            123,
            eosAddress,
            web3.fromAscii('EOS'),
            { account: accounts[1] }
        )
        let event = false
        tx.logs.forEach(log => {
            if (log.event === 'TxReroute')
                event = true
        })
        assert(event, 'TxReroute event was not emitted')
    })

    it('verify that a non-owner can\'t call enableRerouting', async () => {
        txRouter = await TxRerouter.new(false, {
            account: accounts[0]
        })
        const p = txRouter.enableRerouting(
            true,
            { account: accounts[1] }
        )
        await ensureVmException(p, VM_EXCEPTION_ERROR)
    })

    it('verify that the owner can call enableRerouting', async () => {
        txRouter = await TxRerouter.new(false, {
            account: accounts[0]
        })
        let reroutingEnabled = await txRouter.reroutingEnabled.call()
        assert(!reroutingEnabled)
        await txRouter.enableRerouting(
            true,
            { account: accounts[0] }
        )
        reroutingEnabled = await txRouter.reroutingEnabled.call()
        assert(reroutingEnabled === true, 'reroutingEnabled didn\'t get updated properly!')
    })
})


async function ensureVmException(prom, expected_error) {
    try {
        await prom;
        assert(false, 'should have failed');
    }
    catch (err) {
        err.message.includes(expected_error);
    }
}
