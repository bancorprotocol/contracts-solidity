const { expect } = require('chai');
const { expectRevert, expectEvent, BN } = require('@openzeppelin/test-helpers');

const XTransferRerouter = artifacts.require('XTransferRerouter');

contract('XTransferRerouter', (accounts) => {
    const owner = accounts[0];
    const nonOwner = accounts[5];
    const receiver = accounts[1];
    const txId = new BN(123);

    const EOS_ADDRESS = '0x3c69a194aaf415ba5d6afca734660d0a3d45acdc05d54cd1ca89a8988e7625b4';
    const EOS_BLOCKCHAIN = '0x4e8ebbefa452077428f93c9520d3edd60594ff452a29ac7d2ccc11d47f3ab95b';

    it("verify that a user can't call rerouteTx when rerouting is disabled", async () => {
        const txRouter = await XTransferRerouter.new(false, { from: owner });

        await expectRevert(txRouter.rerouteTx(txId, EOS_ADDRESS, EOS_BLOCKCHAIN, { from: receiver }), 'ERR_DISABLED');
    });

    it('verify that calling rerouteTx emits an event properly', async () => {
        const txRouter = await XTransferRerouter.new(true, { from: owner });
        const res = await txRouter.rerouteTx(txId, EOS_ADDRESS, EOS_BLOCKCHAIN, { from: receiver });

        expectEvent(res, 'TxReroute', { _txId: txId, _toBlockchain: EOS_ADDRESS, _to: EOS_BLOCKCHAIN });
    });

    it("verify that a non-owner can't call enableRerouting", async () => {
        const txRouter = await XTransferRerouter.new(false, { from: owner });

        await expectRevert(txRouter.enableRerouting(true, { from: nonOwner }), 'ERR_ACCESS_DENIED');
    });

    it('verify that the owner can call enableRerouting', async () => {
        const txRouter = await XTransferRerouter.new(false, { from: owner });

        const prevReroutingEnabled = await txRouter.reroutingEnabled.call();
        expect(prevReroutingEnabled).to.be.false();

        await txRouter.enableRerouting(true, { from: owner });

        const reroutingEnabled = await txRouter.reroutingEnabled.call();
        expect(reroutingEnabled).to.be.true();
    });
});
