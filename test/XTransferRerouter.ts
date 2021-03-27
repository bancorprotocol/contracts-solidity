import { expect } from 'chai';
import { BigNumber } from 'ethers';

const Contracts = require('./helpers/Contracts');

const EOS_ADDRESS = '0x3c69a194aaf415ba5d6afca734660d0a3d45acdc05d54cd1ca89a8988e7625b4';
const EOS_BLOCKCHAIN = '0x4e8ebbefa452077428f93c9520d3edd60594ff452a29ac7d2ccc11d47f3ab95b';

let accounts;
let nonOwner;
let receiver;
let txId;

describe('XTransferRerouter', () => {
    before(async () => {
        accounts = await ethers.getSigners();

        owner = accounts[0];
        nonOwner = accounts[5];
        receiver = accounts[1];
        txId = BigNumber.from(123);
    });

    it("verify that a user can't call rerouteTx when rerouting is disabled", async () => {
        const txRouter = await Contracts.XTransferRerouter.deploy(false);

        await expect(txRouter.connect(receiver).rerouteTx(txId, EOS_ADDRESS, EOS_BLOCKCHAIN)).to.be.revertedWith(
            'ERR_DISABLED'
        );
    });

    it('verify that calling rerouteTx emits an event properly', async () => {
        const txRouter = await Contracts.XTransferRerouter.deploy(true);

        expect(await txRouter.connect(receiver).rerouteTx(txId, EOS_ADDRESS, EOS_BLOCKCHAIN))
            .to.emit(txRouter, 'TxReroute')
            .withArgs(txId, EOS_ADDRESS, EOS_BLOCKCHAIN);
    });

    it("verify that a non-owner can't call enableRerouting", async () => {
        const txRouter = await Contracts.XTransferRerouter.deploy(false);

        await expect(txRouter.connect(nonOwner).enableRerouting(true)).to.be.revertedWith('ERR_ACCESS_DENIED');
    });

    it('verify that the owner can call enableRerouting', async () => {
        const txRouter = await Contracts.XTransferRerouter.deploy(false);

        const prevReroutingEnabled = await txRouter.reroutingEnabled();
        expect(prevReroutingEnabled).to.be.false;

        await txRouter.connect(owner).enableRerouting(true);

        const reroutingEnabled = await txRouter.reroutingEnabled();
        expect(reroutingEnabled).to.be.true;
    });
});
