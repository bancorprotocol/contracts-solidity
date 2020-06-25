const { expect } = require('chai');
const { expectRevert, BN, balance } = require('@openzeppelin/test-helpers');

const { ETH_RESERVE_ADDRESS } = require('./helpers/Constants');
const ContractRegistryClient = require('./helpers/ContractRegistryClient');

const LiquidityPoolV1Converter = artifacts.require('LiquidityPoolV1Converter');
const BancorX = artifacts.require('BancorX');
const SmartToken = artifacts.require('SmartToken');
const ContractRegistry = artifacts.require('ContractRegistry');
const BancorNetwork = artifacts.require('BancorNetwork');
const BancorFormula = artifacts.require('BancorFormula');
const ERC20Token = artifacts.require('ERC20Token');

const MAX_LOCK_LIMIT = new BN('1000000000000000000000'); // 1000 bnt
const MAX_RELEASE_LIMIT = new BN('1000000000000000000000'); // 1000 bnt
const MIN_LIMIT = new BN('1000000000000000000'); // 1 bnt
const LIM_INC_PER_BLOCK = new BN('1000000000000000000'); // 1 bnt
const MIN_REQUIRED_REPORTS = new BN(3);
const BNT_AMOUNT = new BN('920201018469141404133');

const EOS_ADDRESS = '0xd5e9a21dbc95b47e2750562a96d365aa5fb6a75c000000000000000000000000';
const EOS_BLOCKCHAIN = '0xd5e9a21dbc95b47e2750562a96d365aa5fb6a75c000000000000000000000000';
const MIN_RETURN = new BN(1);
const TX_ID = new BN(0);

contract('XConversions', accounts => {
    let bancorFormula;
    let contractRegistry;
    let bancorX;
    let bancorNetwork;
    let bntToken;
    let erc20Token;
    let ethBntPath;
    let bntEthPath;
    let erc20TokenBntPath;
    let bntErc20Path;
    const owner = accounts[0];
    const reporter1 = accounts[1];
    const reporter2 = accounts[2];
    const reporter3 = accounts[3];
    const affiliateAddress = accounts[4];
    const sender = accounts[5];
    const sender2 = accounts[6];

    beforeEach(async () => {
        bancorFormula = await BancorFormula.new();
        contractRegistry = await ContractRegistry.new();

        bntToken = await ERC20Token.new('Bancor', 'BNT', 18, BNT_AMOUNT);

        bancorX = await BancorX.new(
            MAX_LOCK_LIMIT,
            MAX_RELEASE_LIMIT,
            MIN_LIMIT,
            LIM_INC_PER_BLOCK,
            MIN_REQUIRED_REPORTS,
            contractRegistry.address,
            bntToken.address
        );

        await bancorX.setReporter(reporter1, true);
        await bancorX.setReporter(reporter2, true);
        await bancorX.setReporter(reporter3, true);

        bancorNetwork = await BancorNetwork.new(contractRegistry.address);

        await contractRegistry.registerAddress(ContractRegistryClient.BNT_TOKEN, bntToken.address);
        await contractRegistry.registerAddress(ContractRegistryClient.BANCOR_FORMULA, bancorFormula.address);
        await contractRegistry.registerAddress(ContractRegistryClient.BANCOR_NETWORK, bancorNetwork.address);
        await contractRegistry.registerAddress(ContractRegistryClient.BANCOR_X, bancorX.address);

        erc20Token = await ERC20Token.new('Test Token', 'TST', 0, web3.utils.toWei(new BN(100)));

        // Create some converters.
        const poolToken1 = await SmartToken.new('Pool Token 1', 'POOL1', 18);
        const poolToken2 = await SmartToken.new('Pool Token 2', 'POOL2', 18);
        await poolToken2.issue(owner, web3.utils.toWei(new BN(200)));
        await poolToken2.issue(owner, web3.utils.toWei(new BN(200)));

        erc20TokenConverter1 = await LiquidityPoolV1Converter.new(poolToken1.address, contractRegistry.address, 30000);
        erc20TokenConverter2 = await LiquidityPoolV1Converter.new(poolToken2.address, contractRegistry.address, 30000);

        await erc20TokenConverter1.addReserve(bntToken.address, 500000);
        await erc20TokenConverter1.addReserve(ETH_RESERVE_ADDRESS, 500000);

        await erc20TokenConverter2.addReserve(bntToken.address, 500000);
        await erc20TokenConverter2.addReserve(erc20Token.address, 500000);

        await bntToken.transfer(erc20TokenConverter1.address, web3.utils.toWei(new BN(100)));
        await bntToken.transfer(erc20TokenConverter2.address, web3.utils.toWei(new BN(100)));

        await erc20TokenConverter1.send(web3.utils.toWei(new BN(1)));
        await erc20Token.transfer(erc20TokenConverter2.address, web3.utils.toWei(new BN(50)));

        await erc20Token.transfer(sender, web3.utils.toWei(new BN(50)));

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
                await bancorX.reportTx(
                    blockchainType,
                    txId,
                    to,
                    amount,
                    xTransferId,
                    { from: reporters[i] }
                );
            }
        };

        it('should be able to xConvert from ETH', async () => {
            const path = ethBntPath;
            const amount = web3.utils.toWei(new BN(1));

            const retAmount = await bancorNetwork.xConvert.call(
                path,
                amount,
                MIN_RETURN,
                EOS_BLOCKCHAIN,
                EOS_ADDRESS,
                TX_ID,
                { from: sender, value: amount }
            );

            const prevBalance = await bntToken.balanceOf.call(bancorX.address);

            await bancorNetwork.xConvert(
                path,
                amount,
                MIN_RETURN,
                EOS_BLOCKCHAIN,
                EOS_ADDRESS,
                TX_ID,
                { from: sender, value: amount }
            );

            expect((await bntToken.balanceOf.call(bancorX.address)).sub(prevBalance)).to.be.bignumber.equal(retAmount);
        });

        it('should be able to xConvert from an ERC20', async () => {
            const path = erc20TokenBntPath;
            const amount = web3.utils.toWei(new BN(1));

            await erc20Token.approve(bancorNetwork.address, amount, { from: sender });

            const retAmount = await bancorNetwork.xConvert.call(
                path,
                amount,
                MIN_RETURN,
                EOS_BLOCKCHAIN,
                EOS_ADDRESS,
                TX_ID,
                { from: sender }
            );

            const prevBalance = await bntToken.balanceOf.call(bancorX.address)

            await bancorNetwork.xConvert(
                path,
                amount,
                MIN_RETURN,
                EOS_BLOCKCHAIN,
                EOS_ADDRESS,
                TX_ID,
                { from: sender }
            );

            expect((await bntToken.balanceOf.call(bancorX.address)).sub(prevBalance)).to.be.bignumber.equal(retAmount);
        });

        it('should be able to completeXConversion to ETH', async () => {
            const txId = TX_ID;
            const xTransferId = txId.add(new BN(1));
            const amount = web3.utils.toWei(new BN(10)); // releasing 10 BNT
            const path = bntEthPath;

            await bntToken.transfer(bancorX.address, amount);
            await reportAndRelease(sender, amount, txId, EOS_BLOCKCHAIN, xTransferId);

            await bntToken.approve(bancorNetwork.address, amount, { from: sender });

            const retAmount = await bancorNetwork.completeXConversion.call(path, bancorX.address, xTransferId,
                MIN_RETURN, sender, { from: sender });

            const prevBalance = await balance.current(sender);

            const res = await bancorNetwork.completeXConversion(path, bancorX.address, xTransferId, MIN_RETURN, sender,
                { from: sender });
            const transaction = await web3.eth.getTransaction(res.tx);
            const transactionCost = new BN(transaction.gasPrice).mul(new BN(res.receipt.cumulativeGasUsed));

            expect(await balance.current(sender)).to.be.bignumber.equal(prevBalance.add(retAmount).sub(transactionCost));
        });

        it('should be able to completeXConversion to an ERC20', async () => {
            const txId = TX_ID;
            const xTransferId = txId.add(new BN(1));
            const amount = web3.utils.toWei(new BN(10)); // releasing 10 BNT
            const path = bntErc20Path;

            await bntToken.transfer(bancorX.address, amount);
            await reportAndRelease(sender, amount, txId, EOS_BLOCKCHAIN, xTransferId);

            await bntToken.approve(bancorNetwork.address, amount, { from: sender });

            const prevBalance = await erc20Token.balanceOf.call(sender);

            const retAmount = await bancorNetwork.completeXConversion.call(path, bancorX.address, xTransferId,
                MIN_RETURN, sender, { from: sender })
            await bancorNetwork.completeXConversion(path, bancorX.address, xTransferId, MIN_RETURN, sender,
                { from: sender })

            expect(await erc20Token.balanceOf.call(sender)).to.be.bignumber.equal(prevBalance.add(retAmount));
        });

        it("shouldn't be able to completeXConversion to an ERC20 with a different xTransferId", async () => {
            const txId1 = TX_ID;
            const xTransferId1 = txId1.add(new BN(1));
            const txId2 = TX_ID.add(new BN(100));
            const xTransferId2 = txId2.add(new BN(1));;
            const amount = web3.utils.toWei(new BN(10)); // releasing 10 BNT
            const path = bntErc20Path;

            await bntToken.transfer(bancorX.address, amount.mul(new BN(2)));

            await reportAndRelease(sender, amount, txId1, EOS_BLOCKCHAIN, xTransferId1);
            await reportAndRelease(sender2, amount, txId2, EOS_BLOCKCHAIN, xTransferId2);

            await bntToken.approve(bancorNetwork.address, amount, { from: sender });

            await expectRevert(bancorNetwork.completeXConversion(path, bancorX.address, xTransferId2, MIN_RETURN,
                sender, { from: sender }), 'ERR_TX_MISMATCH');
        });
    });

    for (const percent of [0.5 /*, 1.0, 1.5, 2.0, 3.0*/]) {
        describe(`advanced testing with affiliate fee of ${percent}%:`, () => {
            const expectedFee = (amount, percent) => new BN(amount).mul(new BN(10 * percent)).div(new BN(10)).div(new BN(100));

            const affiliateFee = expectedFee(1000000, percent);

            it('should be able to xConvert2 from ETH', async () => {
                const path = ethBntPath;
                const amount = web3.utils.toWei(new BN(1));
                const expectedRate = await bancorNetwork.rateByPath.call(path, amount);

                const retAmount = await bancorNetwork.xConvert2.call(
                    path,
                    amount,
                    MIN_LIMIT,
                    EOS_BLOCKCHAIN,
                    EOS_ADDRESS,
                    TX_ID,
                    affiliateAddress, affiliateFee,
                    { from: sender, value: amount }
                );

                const prevBalanceOfBancorX = await bntToken.balanceOf.call(bancorX.address);
                const prevBalanceAffiliate = await bntToken.balanceOf.call(affiliateAddress);

                const res = await bancorNetwork.xConvert2(
                    path,
                    amount,
                    MIN_LIMIT,
                    EOS_BLOCKCHAIN,
                    EOS_ADDRESS,
                    TX_ID,
                    affiliateAddress, affiliateFee,
                    { from: sender, value: amount }
                )

                expect((await bntToken.balanceOf.call(bancorX.address)).sub(prevBalanceOfBancorX)).to.be.bignumber
                    .equal(retAmount);
                expect((await bntToken.balanceOf.call(affiliateAddress)).sub(prevBalanceAffiliate)).to.be.bignumber
                    .equal(expectedFee(expectedRate, percent));
            });

            it('should be able to xConvert2 from an ERC20', async () => {
                const path = erc20TokenBntPath;
                const amount = web3.utils.toWei(new BN(1));
                const expectedRate = await bancorNetwork.rateByPath.call(path, amount);

                await erc20Token.approve(bancorNetwork.address, amount, { from: sender });

                const retAmount = await bancorNetwork.xConvert2.call(
                    path,
                    amount,
                    MIN_RETURN,
                    EOS_BLOCKCHAIN,
                    EOS_ADDRESS,
                    TX_ID,
                    affiliateAddress, affiliateFee,
                    { from: sender }
                );

                const prevBalanceOfBancorX = await bntToken.balanceOf.call(bancorX.address);
                const prevBalanceAffiliate = await bntToken.balanceOf.call(affiliateAddress);

                await bancorNetwork.xConvert2(
                    path,
                    amount,
                    MIN_RETURN,
                    EOS_BLOCKCHAIN,
                    EOS_ADDRESS,
                    TX_ID,
                    affiliateAddress, affiliateFee,
                    { from: sender }
                );

                expect((await bntToken.balanceOf.call(bancorX.address)).sub(prevBalanceOfBancorX)).to.be.bignumber
                    .equal(retAmount);
                expect((await bntToken.balanceOf.call(affiliateAddress)).sub(prevBalanceAffiliate)).to.be.bignumber
                    .equal(expectedFee(expectedRate, percent));
            });
        });
    }
});
