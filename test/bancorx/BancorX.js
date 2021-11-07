const { expect } = require('chai');
const { ethers } = require('hardhat');
const { BigNumber } = require('ethers');

const { advanceBlock } = require('../helpers/Time');

const Contracts = require('../../components/Contracts').default;

const MAX_LOCK_LIMIT = BigNumber.from('1000000000000000000000'); // 1000 tokens
const MAX_RELEASE_LIMIT = BigNumber.from('1000000000000000000000'); // 1000 tokens
const MIN_LIMIT = BigNumber.from('1000000000000000000'); // 1 token
const LIM_INC_PER_BLOCK = BigNumber.from('1000000000000000000'); // 1 token
const TEST_AMOUNT = BigNumber.from('10000000000000000000'); // 10 tokens
const SUPPLY_AMOUNT = BigNumber.from('77492920201018469141404133');
const MIN_REQ_REPORTS = BigNumber.from(3);
const TRANSACTION_ID = BigNumber.from(12345678);
const X_TRANSFER_ID = BigNumber.from(87654321);

const EOS_ADDRESS = '0x3c69a194aaf415ba5d6afca734660d0a3d45acdc05d54cd1ca89a8988e7625b4';
const EOS_BLOCKCHAIN = '0x4e8ebbefa452077428f93c9520d3edd60594ff452a29ac7d2ccc11d47f3ab95b';

let bancorX;

let contractRegistry;
let bancorXToken;

let defaultSender;
let reporter1;
let reporter2;
let reporter3;
let nonOwner;
let accounts;

describe('BancorX', () => {
    before(async () => {
        accounts = await ethers.getSigners();

        defaultSender = accounts[0];
        reporter1 = accounts[1];
        reporter2 = accounts[2];
        reporter3 = accounts[3];
        nonOwner = accounts[9];
    });

    beforeEach(async () => {
        contractRegistry = await Contracts.ContractRegistry.deploy();
        bancorXToken = await Contracts.TestStandardToken.deploy('Bancor', 'BNT', SUPPLY_AMOUNT);

        bancorX = await Contracts.BancorX.deploy(
            MAX_LOCK_LIMIT,
            MAX_RELEASE_LIMIT,
            MIN_LIMIT,
            LIM_INC_PER_BLOCK,
            MIN_REQ_REPORTS,
            contractRegistry.address,
            bancorXToken.address
        );
        // Grant bancorx allowance
        await bancorXToken.approve(bancorX.address, SUPPLY_AMOUNT);
    });

    it('should allow the owner to set reporters', async () => {
        await bancorX.setReporter(reporter1.address, true);
        await bancorX.setReporter(reporter2.address, true);
        await bancorX.setReporter(reporter3.address, true);

        expect(await bancorX.reporters(reporter1.address)).to.be.true;
        expect(await bancorX.reporters(reporter2.address)).to.be.true;
        expect(await bancorX.reporters(reporter3.address)).to.be.true;
    });

    it('should not allow a non-owner to set reporters', async () => {
        await expect(bancorX.connect(nonOwner).setReporter(reporter1.address, true)).to.be.revertedWith(
            'ERR_ACCESS_DENIED'
        );
        await expect(bancorX.connect(nonOwner).setReporter(reporter2.address, true)).to.be.revertedWith(
            'ERR_ACCESS_DENIED'
        );
        await expect(bancorX.connect(nonOwner).setReporter(reporter3.address, true)).to.be.revertedWith(
            'ERR_ACCESS_DENIED'
        );

        expect(await bancorX.reporters(reporter1.address)).to.be.false;
        expect(await bancorX.reporters(reporter2.address)).to.be.false;
        expect(await bancorX.reporters(reporter3.address)).to.be.false;
    });

    it('should allow the owner to set limits', async () => {
        const newMaxLockLimit = MAX_LOCK_LIMIT.add(BigNumber.from(1));
        const newMaxReleaseLimit = MAX_RELEASE_LIMIT.add(BigNumber.from(1));
        const newMinLimit = MIN_LIMIT.add(BigNumber.from(1));
        const newLimitIncPerBlock = LIM_INC_PER_BLOCK.add(BigNumber.from(1));
        const newMinRequiredReports = MIN_REQ_REPORTS.add(BigNumber.from(1));

        await bancorX.setMaxLockLimit(newMaxLockLimit);
        await bancorX.setMaxReleaseLimit(newMaxReleaseLimit);
        await bancorX.setMinLimit(newMinLimit);
        await bancorX.setLimitIncPerBlock(newLimitIncPerBlock);
        await bancorX.setMinRequiredReports(newMinRequiredReports);

        expect(await bancorX.maxLockLimit()).to.equal(newMaxLockLimit);
        expect(await bancorX.maxReleaseLimit()).to.equal(newMaxReleaseLimit);
        expect(await bancorX.minLimit()).to.equal(newMinLimit);
        expect(await bancorX.limitIncPerBlock()).to.equal(newLimitIncPerBlock);
        expect(await bancorX.minRequiredReports()).to.equal(newMinRequiredReports);
    });

    it('should not allow a non-owner to set limits', async () => {
        const newMaxLockLimit = MAX_LOCK_LIMIT.add(BigNumber.from(1));
        const newMaxReleaseLimit = MAX_RELEASE_LIMIT.add(BigNumber.from(1));
        const newMinLimit = MIN_LIMIT.add(BigNumber.from(1));
        const newLimitIncPerBlock = LIM_INC_PER_BLOCK.add(BigNumber.from(1));
        const newMinRequiredReports = MIN_REQ_REPORTS.add(BigNumber.from(1));

        await expect(bancorX.connect(nonOwner).setMaxLockLimit(newMaxLockLimit)).to.be.revertedWith(
            'ERR_ACCESS_DENIED'
        );
        await expect(bancorX.connect(nonOwner).setMaxReleaseLimit(newMaxReleaseLimit)).to.be.revertedWith(
            'ERR_ACCESS_DENIED'
        );
        await expect(bancorX.connect(nonOwner).setMinLimit(newMinLimit)).to.be.revertedWith('ERR_ACCESS_DENIED');
        await expect(bancorX.connect(nonOwner).setLimitIncPerBlock(newLimitIncPerBlock)).to.be.revertedWith(
            'ERR_ACCESS_DENIED'
        );
        await expect(bancorX.connect(nonOwner).setMinRequiredReports(newMinRequiredReports)).to.be.revertedWith(
            'ERR_ACCESS_DENIED'
        );
    });

    it('should not be able to lock below the min limit', async () => {
        const amount = MIN_LIMIT.sub(BigNumber.from(1));
        await expect(
            bancorX['xTransfer(bytes32,bytes32,uint256)'](EOS_BLOCKCHAIN, EOS_ADDRESS, amount)
        ).to.be.revertedWith('ERR_AMOUNT_TOO_HIGH');
    });

    it('should not be able to lock above the max limit', async () => {
        const amount = MAX_LOCK_LIMIT.add(BigNumber.from(1));
        await expect(
            bancorX['xTransfer(bytes32,bytes32,uint256)'](EOS_BLOCKCHAIN, EOS_ADDRESS, amount)
        ).to.be.revertedWith('ERR_AMOUNT_TOO_HIGH');
    });

    it('should not be able to release below the min limit', async () => {
        const amount = MIN_LIMIT.sub(BigNumber.from(1));
        await bancorX.setReporter(reporter1.address, true);
        await bancorX.setReporter(reporter2.address, true);
        await bancorX.setReporter(reporter3.address, true);

        await bancorX
            .connect(reporter1)
            .reportTx(EOS_BLOCKCHAIN, TRANSACTION_ID, defaultSender.address, amount, X_TRANSFER_ID);
        await bancorX
            .connect(reporter2)
            .reportTx(EOS_BLOCKCHAIN, TRANSACTION_ID, defaultSender.address, amount, X_TRANSFER_ID);

        await expect(
            bancorX
                .connect(reporter3)
                .reportTx(EOS_BLOCKCHAIN, TRANSACTION_ID, defaultSender.address, amount, X_TRANSFER_ID)
        ).to.be.revertedWith('ERR_AMOUNT_TOO_HIGH');
    });

    it('should not be able to release above the max limit', async () => {
        const amount = MAX_RELEASE_LIMIT.add(BigNumber.from(1));
        await bancorX.setReporter(reporter1.address, true);
        await bancorX.setReporter(reporter2.address, true);
        await bancorX.setReporter(reporter3.address, true);

        await bancorX
            .connect(reporter1)
            .reportTx(EOS_BLOCKCHAIN, TRANSACTION_ID, defaultSender.address, amount, X_TRANSFER_ID);
        await bancorX
            .connect(reporter2)
            .reportTx(EOS_BLOCKCHAIN, TRANSACTION_ID, defaultSender.address, amount, X_TRANSFER_ID);

        await expect(
            bancorX
                .connect(reporter3)
                .reportTx(EOS_BLOCKCHAIN, TRANSACTION_ID, defaultSender.address, amount, X_TRANSFER_ID)
        ).to.be.revertedWith('ERR_AMOUNT_TOO_HIGH');
    });

    it('should emit an event when successfully locking tokens', async () => {
        const amount = TEST_AMOUNT;

        await expect(await bancorX['xTransfer(bytes32,bytes32,uint256)'](EOS_BLOCKCHAIN, EOS_ADDRESS, amount))
            .to.emit(bancorX, 'XTransfer')
            .withArgs(defaultSender.address, EOS_BLOCKCHAIN, EOS_ADDRESS, TEST_AMOUNT, BigNumber.from(0));
    });

    it('should properly calculate the current lock limit after a single transaction', async () => {
        const numOfTests = 10;
        const amount = LIM_INC_PER_BLOCK.mul(BigNumber.from(numOfTests));
        await bancorX['xTransfer(bytes32,bytes32,uint256)'](EOS_BLOCKCHAIN, EOS_ADDRESS, amount);

        for (let i = 0; i <= numOfTests; ++i) {
            expect(await bancorX.getCurrentLockLimit()).to.equal(
                MAX_LOCK_LIMIT.sub(amount).add(MIN_LIMIT.mul(BigNumber.from(i)))
            );
            await advanceBlock();
        }

        for (let i = 0; i < 3; i++) {
            expect(await bancorX.getCurrentLockLimit()).to.equal(MAX_LOCK_LIMIT);

            await advanceBlock();
        }
    });

    it('should not allow a reporter to report the same transaction twice', async () => {
        await bancorX.setReporter(reporter1.address, true);
        await bancorX
            .connect(reporter1)
            .reportTx(EOS_BLOCKCHAIN, TRANSACTION_ID, defaultSender.address, TEST_AMOUNT, X_TRANSFER_ID);

        await expect(
            bancorX
                .connect(reporter1)
                .reportTx(EOS_BLOCKCHAIN, TRANSACTION_ID, defaultSender.address, TEST_AMOUNT, X_TRANSFER_ID)
        ).to.be.revertedWith('ERR_ALREADY_REPORTED');
    });

    it('should not allow two reporters to give conflicting transaction details', async () => {
        await bancorX.setReporter(reporter1.address, true);
        await bancorX.setReporter(reporter2.address, true);

        await bancorX
            .connect(reporter1)
            .reportTx(EOS_BLOCKCHAIN, TRANSACTION_ID, reporter1.address, TEST_AMOUNT, X_TRANSFER_ID);
        await expect(
            bancorX
                .connect(reporter2)
                .reportTx(EOS_BLOCKCHAIN, TRANSACTION_ID, reporter2.address, TEST_AMOUNT, X_TRANSFER_ID)
        ).to.be.revertedWith('ERR_TX_MISMATCH');
    });

    it('should not allow a non-reporter to report', async () => {
        await expect(
            bancorX
                .connect(reporter1)
                .reportTx(EOS_BLOCKCHAIN, TRANSACTION_ID, defaultSender.address, TEST_AMOUNT, X_TRANSFER_ID)
        ).to.be.revertedWith('ERR_ACCESS_DENIED');
    });

    it('should not allow reports when disabled', async () => {
        await bancorX.setReporter(reporter1.address, true);
        await bancorX.enableReporting(false);

        await expect(
            bancorX
                .connect(reporter1)
                .reportTx(EOS_BLOCKCHAIN, TRANSACTION_ID, defaultSender.address, TEST_AMOUNT, X_TRANSFER_ID)
        ).to.be.revertedWith('ERR_DISABLED');
    });

    it('should not allow xTransfers when disabled', async () => {
        await bancorX.enableXTransfers(false);

        await expect(
            bancorX['xTransfer(bytes32,bytes32,uint256)'](EOS_BLOCKCHAIN, EOS_ADDRESS, TEST_AMOUNT)
        ).to.be.revertedWith('ERR_DISABLED');
    });
});
