const { expect } = require('chai');

const { BigNumber } = require('ethers');

const { ETH_RESERVE_ADDRESS, registry } = require('./helpers/Constants');

const LiquidityPoolV1Converter = ethers.getContractFactory('LiquidityPoolV1Converter');
const BancorX = ethers.getContractFactory('BancorX');
const DSToken = ethers.getContractFactory('DSToken');
const ContractRegistry = ethers.getContractFactory('ContractRegistry');
const BancorNetwork = ethers.getContractFactory('BancorNetwork');
const BancorFormula = ethers.getContractFactory('BancorFormula');
const TestStandardToken = ethers.getContractFactory('TestStandardToken');

const MAX_LOCK_LIMIT = BigNumber.from('1000000000000000000000'); // 1000 bnt
const MAX_RELEASE_LIMIT = BigNumber.from('1000000000000000000000'); // 1000 bnt
const MIN_LIMIT = BigNumber.from('1000000000000000000'); // 1 bnt
const LIM_INC_PER_BLOCK = BigNumber.from('1000000000000000000'); // 1 bnt
const MIN_REQUIRED_REPORTS = BigNumber.from(3);
const BNT_AMOUNT = BigNumber.from('920201018469141404133');

const EOS_ADDRESS = '0xd5e9a21dbc95b47e2750562a96d365aa5fb6a75c000000000000000000000000';
const EOS_BLOCKCHAIN = '0xd5e9a21dbc95b47e2750562a96d365aa5fb6a75c000000000000000000000000';
const MIN_RETURN = BigNumber.from(1);
const TX_ID = BigNumber.from(0);

let bancorFormula;
let contractRegistry;

let bancorX;
let bancorNetwork;
let bntToken;
let erc20Token;
let erc20TokenConverter1;
let erc20TokenConverter2;
let ethBntPath;
let bntEthPath;
let erc20TokenBntPath;
let bntErc20Path;

let owner;
let reporter1;
let reporter2;
let reporter3;
let sender;
let sender2;

// TODO investigate about "revert SafeMath: subtraction overflow"
describe('XConversions', () => {
    before(async () => {
        accounts = await ethers.getSigners();

        owner = accounts[0];
        reporter1 = accounts[1];
        reporter2 = accounts[2];
        reporter3 = accounts[3];
        sender = accounts[5];
        sender2 = accounts[6];

        // The following contracts are unaffected by the underlying tests, this can be shared.
        bancorFormula = await (await BancorFormula).deploy();
        contractRegistry = await (await ContractRegistry).deploy();

        await contractRegistry.registerAddress(registry.BANCOR_FORMULA, bancorFormula.address);
    });

    beforeEach(async () => {
        bntToken = await (await TestStandardToken).deploy('Bancor', 'BNT', 18, BNT_AMOUNT);

        bancorX = await (await BancorX).deploy(
            MAX_LOCK_LIMIT,
            MAX_RELEASE_LIMIT,
            MIN_LIMIT,
            LIM_INC_PER_BLOCK,
            MIN_REQUIRED_REPORTS,
            contractRegistry.address,
            bntToken.address
        );

        await bancorX.setReporter(reporter1.address, true);
        await bancorX.setReporter(reporter2.address, true);
        await bancorX.setReporter(reporter3.address, true);

        bancorNetwork = await (await BancorNetwork).deploy(contractRegistry.address);

        await contractRegistry.registerAddress(registry.BNT_TOKEN, bntToken.address);
        await contractRegistry.registerAddress(registry.BANCOR_FORMULA, bancorFormula.address);
        await contractRegistry.registerAddress(registry.BANCOR_NETWORK, bancorNetwork.address);
        await contractRegistry.registerAddress(registry.BANCOR_X, bancorX.address);

        erc20Token = await (await TestStandardToken).deploy('Test Token', 'TST', 18, ethers.utils.parseEther('100'));

        // Create some converters.
        const poolToken1 = await (await DSToken).deploy('Pool Token 1', 'POOL1', 18);
        const poolToken2 = await (await DSToken).deploy('Pool Token 2', 'POOL2', 18);
        await poolToken2.issue(owner.address, ethers.utils.parseEther('200'));
        await poolToken2.issue(owner.address, ethers.utils.parseEther('200'));

        erc20TokenConverter1 = await (await LiquidityPoolV1Converter).deploy(
            poolToken1.address,
            contractRegistry.address,
            30000
        );
        erc20TokenConverter2 = await (await LiquidityPoolV1Converter).deploy(
            poolToken2.address,
            contractRegistry.address,
            30000
        );

        await erc20TokenConverter1.addReserve(bntToken.address, 500000);
        await erc20TokenConverter1.addReserve(ETH_RESERVE_ADDRESS, 500000);

        await erc20TokenConverter2.addReserve(bntToken.address, 500000);
        await erc20TokenConverter2.addReserve(erc20Token.address, 500000);

        await bntToken.transfer(erc20TokenConverter1.address, ethers.utils.parseEther('100'));
        await bntToken.transfer(erc20TokenConverter2.address, ethers.utils.parseEther('100'));

        // TODO
        await erc20TokenConverter1.send(ethers.utils.parseEther('1'));
        //
        await erc20Token.transfer(erc20TokenConverter2.address, ethers.utils.parseEther('50'));

        await erc20Token.transfer(sender.address, ethers.utils.parseEther('50'));

        await poolToken1.transferOwnership(erc20TokenConverter1.address);
        await poolToken2.transferOwnership(erc20TokenConverter2.address);

        await erc20TokenConverter1.acceptTokenOwnership();
        await erc20TokenConverter2.acceptTokenOwnership();

        // Set paths for easer use.
        ethBntPath = [ETH_RESERVE_ADDRESS, poolToken1.address, bntToken.address];
        bntEthPath = [bntToken.address, poolToken1.address, ETH_RESERVE_ADDRESS];
        erc20TokenBntPath = [erc20Token.address, poolToken2.address, bntToken.address];
        bntErc20Path = [bntToken.address, poolToken2.address, erc20Token.address];
    });

    describe('basic tests', () => {
        const reportAndRelease = async (to, amount, txId, blockchainType, xTransferId = 0) => {
            const reporters = [reporter1, reporter2, reporter3];

            for (let i = 0; i < reporters.length; ++i) {
                await bancorX.connect(reporters[i]).reportTx(blockchainType, txId, to, amount, xTransferId);
            }
        };

        it('should be able to xConvert from an ERC20', async () => {
            const path = erc20TokenBntPath;
            const amount = ethers.utils.parseEther('1');

            await erc20Token.connect(sender).approve(bancorNetwork.address, amount);

            const retAmount = await bancorNetwork
                .connect(sender)
                .xConvert.call(path, amount, MIN_RETURN, EOS_BLOCKCHAIN, EOS_ADDRESS, TX_ID);

            const prevBalance = await bntToken.balanceOf.call(bancorX.address);

            await bancorNetwork.connect(sender).xConvert(path, amount, MIN_RETURN, EOS_BLOCKCHAIN, EOS_ADDRESS, TX_ID);

            expect((await bntToken.balanceOf.call(bancorX.address)).sub(prevBalance)).to.be.equal(retAmount);
        });

        it('should revert when attempting to xConvert to a different token than BNT', async () => {
            const path = [...ethBntPath.slice(0, 1), sender.address];
            const amount = ethers.utils.parseEther('1');

            await expect(
                bancorNetwork.connect(sender).xConvert(path, amount, MIN_RETURN, EOS_BLOCKCHAIN, EOS_ADDRESS, TX_ID, {
                    value: amount
                })
            ).to.be.revertedWith('ERR_INVALID_TARGET_TOKEN');
        });

        it('should be able to completeXConversion to ETH', async () => {
            const txId = TX_ID;
            const xTransferId = txId.add(BigNumber.from(1));
            const amount = ethers.utils.parseEther('10'); // releasing 10 BNT
            const path = bntEthPath;

            await bntToken.transfer(bancorX.address, amount);
            await reportAndRelease(sender.address, amount, txId, EOS_BLOCKCHAIN, xTransferId);

            await bntToken.connect(sender).approve(bancorNetwork.address, amount);

            const retAmount = await bancorNetwork
                .connect(sender)
                .completeXConversion(path, bancorX.address, xTransferId, MIN_RETURN, sender.address);

            const prevBalance = await sender.getBalance();

            const res = await bancorNetwork
                .connect(sender)
                .completeXConversion(path, bancorX.address, xTransferId, MIN_RETURN, sender.address);
            const transaction = await web3.eth.getTransaction(res.tx);
            const transactionCost = BigNumber.from(transaction.gasPrice).mul(
                BigNumber.from(res.receipt.cumulativeGasUsed)
            );

            expect(await sender.getBalance()).to.be.equal(prevBalance.add(retAmount).sub(transactionCost));
        });

        it('should be able to completeXConversion to an ERC20', async () => {
            const txId = TX_ID;
            const xTransferId = txId.add(BigNumber.from(1));
            const amount = ethers.utils.parseEther('10'); // releasing 10 BNT
            const path = bntErc20Path;

            await bntToken.transfer(bancorX.address, amount);
            await reportAndRelease(sender.address, amount, txId, EOS_BLOCKCHAIN, xTransferId);

            await bntToken.connect(sender).approve(bancorNetwork.address, amount);

            const prevBalance = await erc20Token.balanceOf(sender.address);

            const retAmount = await bancorNetwork
                .connect(sender)
                .completeXConversion(path, bancorX.address, xTransferId, MIN_RETURN, sender.address);
            await bancorNetwork
                .connect(sender)
                .completeXConversion(path, bancorX.address, xTransferId, MIN_RETURN, sender.address);

            expect(await erc20Token.balanceOf(sender.address)).to.be.bignumber.equal(prevBalance.add(retAmount));
        });

        it("shouldn't be able to completeXConversion to an ERC20 with a different xTransferId", async () => {
            const txId1 = TX_ID;
            const xTransferId1 = txId1.add(BigNumber.from(1));
            const txId2 = TX_ID.add(BigNumber.from(100));
            const xTransferId2 = txId2.add(BigNumber.from(1));
            const amount = ethers.utils.parseEther('10'); // releasing 10 BNT
            const path = bntErc20Path;

            await bntToken.transfer(bancorX.address, amount.mul(BigNumber.from(2)));

            await reportAndRelease(sender.address, amount, txId1, EOS_BLOCKCHAIN, xTransferId1);
            await reportAndRelease(sender2.address, amount, txId2, EOS_BLOCKCHAIN, xTransferId2);

            await bntToken.connect(sender).approve(bancorNetwork.address, amount);

            await expect(
                bancorNetwork
                    .connect(sender)
                    .completeXConversion(path, bancorX.address, xTransferId2, MIN_RETURN, sender.address)
            ).to.be.revertedWith('ERR_TX_MISMATCH');
        });

        it('should revert when attempting to completeXConversion from a different token than BNT', async () => {
            const txId = TX_ID;
            const xTransferId = txId.add(BigNumber.from(1));
            const path = [sender.address, ...bntErc20Path.slice(1)];

            await expect(
                bancorNetwork
                    .connect(sender)
                    .completeXConversion(path, bancorX.address, xTransferId, MIN_RETURN, sender.address)
            ).to.be.revertedWith('ERR_INVALID_SOURCE_TOKEN');
        });
    });
});
