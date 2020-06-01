/* global artifacts, contract, before, it, assert */
/* eslint-disable prefer-reflect */

const utils = require('./helpers/Utils');
const ContractRegistryClient = require('./helpers/ContractRegistryClient');

const LiquidityPoolV1Converter = artifacts.require('LiquidityPoolV1Converter');
const BancorX = artifacts.require('BancorX');
const SmartToken = artifacts.require('SmartToken');
const ContractRegistry = artifacts.require('ContractRegistry');
const BancorNetwork = artifacts.require('BancorNetwork');
const BancorFormula = artifacts.require('BancorFormula');
const ERC20Token = artifacts.require('ERC20Token');

const ETH_RESERVE_ADDRESS = '0x'.padEnd(42, 'e');

const MAX_LOCK_LIMIT = '1000000000000000000000' // 1000 bnt
const MAX_RELEASE_LIMIT = '1000000000000000000000' // 1000 bnt
const MIN_LIMIT = '1000000000000000000' // 1 bnt
const LIM_INC_PER_BLOCK = '1000000000000000000' // 1 bnt
const MIN_REQUIRED_REPORTS = '3'
const BNT_AMOUNT = '920201018469141404133'

// this is just gibberish bytes32
const eosAddress = '0xd5e9a21dbc95b47e2750562a96d365aa5fb6a75c000000000000000000000000'
const EOS_BLOCKCHAIN = '0xd5e9a21dbc95b47e2750562a96d365aa5fb6a75c000000000000000000000000'

// bancor network contracts
let bancorX, bancorNetwork, bntToken, erc20Token, erc20TokenConverter
// paths
let ethBntPath, bntEthPath, erc20TokenBntPath, bntErc20Path

let reporter1, reporter2, reporter3, affiliateAddress

async function reportAndRelease(to, amount, txId, blockchainType, xTransferId = 0) {
    for (let i = 1; i <= 3; i++) {
        await bancorX.reportTx(
            blockchainType,
            txId,
            to,
            amount,
            xTransferId,
            { from: eval(`reporter${i}`) }
        )
    }
}

const initBancorNetwork = async accounts => {
    reporter1 = accounts[1]
    reporter2 = accounts[2]
    reporter3 = accounts[3]
    affiliateAddress = accounts[4]

    const bancorFormula = await BancorFormula.new();
    const contractRegistry = await ContractRegistry.new()
        
    bntToken = await ERC20Token.new('Bancor', 'BNT', 18, BNT_AMOUNT)

    bancorX = await BancorX.new(
        MAX_LOCK_LIMIT,
        MAX_RELEASE_LIMIT,
        MIN_LIMIT,
        LIM_INC_PER_BLOCK,
        MIN_REQUIRED_REPORTS,
        contractRegistry.address,
        bntToken.address
    )

    await bancorX.setReporter(reporter1, true)
    await bancorX.setReporter(reporter2, true)
    await bancorX.setReporter(reporter3, true)

    bancorNetwork = await BancorNetwork.new(contractRegistry.address);

    await contractRegistry.registerAddress(ContractRegistryClient.BNT_TOKEN, bntToken.address)
    await contractRegistry.registerAddress(ContractRegistryClient.BANCOR_FORMULA, bancorFormula.address)
    await contractRegistry.registerAddress(ContractRegistryClient.BANCOR_NETWORK, bancorNetwork.address)
    await contractRegistry.registerAddress(ContractRegistryClient.BANCOR_X, bancorX.address)

    erc20Token = await ERC20Token.new('Test Token', 'TST', 0, web3.toWei('100'))

    // creating converters
    const poolToken1 = await SmartToken.new('Pool Token 1', 'POOL1', 18)
    const poolToken2 = await SmartToken.new('Pool Token 2', 'POOL2', 18)
    await poolToken2.issue(accounts[0], web3.toWei('200'))
    await poolToken2.issue(accounts[0], web3.toWei('200'))

    erc20TokenConverter1 = await LiquidityPoolV1Converter.new(poolToken1.address, contractRegistry.address, '30000');
    erc20TokenConverter2 = await LiquidityPoolV1Converter.new(poolToken2.address, contractRegistry.address, '30000');

    await erc20TokenConverter1.addReserve(bntToken.address, '500000')
    await erc20TokenConverter2.addReserve(bntToken.address, '500000')

    await erc20TokenConverter1.addReserve(ETH_RESERVE_ADDRESS, '500000')
    await erc20TokenConverter2.addReserve(erc20Token.address, '500000')
    
    await bntToken.transfer(erc20TokenConverter1.address, web3.toWei('100'))
    await bntToken.transfer(erc20TokenConverter2.address, web3.toWei('100'))
    
    await erc20TokenConverter1.send(web3.toWei('1'));
    await erc20Token.transfer(erc20TokenConverter2.address, web3.toWei('50'))
    
    await erc20Token.transfer(accounts[5], web3.toWei('50'))
    
    await poolToken1.transferOwnership(erc20TokenConverter1.address)
    await poolToken2.transferOwnership(erc20TokenConverter2.address)

    await erc20TokenConverter1.acceptTokenOwnership()
    await erc20TokenConverter2.acceptTokenOwnership()

    // settings paths for easy use
    ethBntPath = [ETH_RESERVE_ADDRESS, poolToken1.address, bntToken.address]
    bntEthPath = [bntToken.address, poolToken1.address, ETH_RESERVE_ADDRESS]
    erc20TokenBntPath = [erc20Token.address, poolToken2.address, bntToken.address]
    bntErc20Path = [bntToken.address, poolToken2.address, erc20Token.address]
}

function getId() {
    if (this.id == undefined)
        this.id = 0
    return ++this.id
}

function expectedFee(amount, percent) {
    return amount.mul(percent).div(100);
}

contract("XConversions", accounts => {
    describe("basic testing:", () => {
        before(async () => {
            await initBancorNetwork(accounts)
        })

        it("should be able to xConvert from ETH", async () => {
            const path = ethBntPath
            const amount = web3.toWei(1)

            const retAmount = await bancorNetwork.xConvert.call(
                path,                         
                amount,               
                1,                                
                EOS_BLOCKCHAIN,                     
                eosAddress,                         
                0,                                
                { from: accounts[5], value: amount }
            )

            const prevBalance = await bntToken.balanceOf(bancorX.address)

            const res = await bancorNetwork.xConvert(
                path,                                               
                amount,                                     
                1,                                                      
                EOS_BLOCKCHAIN,                                           
                eosAddress,                                               
                0,                                                      
                { from: accounts[5], value: amount }
            )

            assert.equal((await bntToken.balanceOf(bancorX.address)).minus(prevBalance).toFixed(0), retAmount.toFixed(0))
        })

        it("should be able to xConvert from an ERC20", async () => {
            const path = erc20TokenBntPath
            const amount = web3.toWei(1)

            await erc20Token.approve(bancorNetwork.address, 0, { from: accounts[5] })
            await erc20Token.approve(bancorNetwork.address, amount, { from: accounts[5] })

            const retAmount = await bancorNetwork.xConvert.call(
                path,                         
                amount,               
                1,                                
                EOS_BLOCKCHAIN,                     
                eosAddress,                         
                0,                                
                { from: accounts[5] }
            )

            const prevBalance = await bntToken.balanceOf(bancorX.address)

            const res = await bancorNetwork.xConvert(
                path,                                               
                amount,                                     
                1,                                                      
                EOS_BLOCKCHAIN,                                           
                eosAddress,                                               
                0,                                                      
                { from: accounts[5] }
            )

            // console.log(res.receipt.gasUsed)
            assert.equal((await bntToken.balanceOf(bancorX.address)).minus(prevBalance).toFixed(0), retAmount.toFixed(0))
        })

        it("should be able to completeXConversion to ETH", async () => {
            const txId = getId()
            const xTransferId = getId()
            const amount = web3.toWei('10') // releasing 10 BNT
            const path = bntEthPath

            await reportAndRelease(accounts[5], amount, txId, EOS_BLOCKCHAIN, xTransferId)

            const prevBalance = await web3.eth.getBalance(accounts[5])

            await bntToken.approve(bancorNetwork.address, 0, { from: accounts[5] })
            await bntToken.approve(bancorNetwork.address, amount, { from: accounts[5] })
            await bancorNetwork.completeXConversion(path, bancorX.address, xTransferId, 1, accounts[5], { from: accounts[5] })
            
            const currBalance = await web3.eth.getBalance(accounts[5])

            assert(currBalance.greaterThan(prevBalance))
        })

        it("should be able to completeXConversion to an ERC20", async () => {
            const txId = getId()
            const xTransferId = getId()
            const amount = web3.toWei('10') // releasing 10 BNT
            const path = bntErc20Path

            await reportAndRelease(accounts[5], amount, txId, EOS_BLOCKCHAIN, xTransferId)

            const prevBalance = await erc20Token.balanceOf(accounts[5])

            await bntToken.approve(bancorNetwork.address, 0, { from: accounts[5] })
            await bntToken.approve(bancorNetwork.address, amount, { from: accounts[5] })
            const retAmount = await bancorNetwork.completeXConversion.call(path, bancorX.address, xTransferId, 1, accounts[5], { from: accounts[5] })
            await bancorNetwork.completeXConversion(path, bancorX.address, xTransferId, 1, accounts[5], { from: accounts[5] })

            const currBalance = await erc20Token.balanceOf(accounts[5])

            assert.equal(currBalance.minus(prevBalance).toFixed(0), retAmount.toFixed(0))
        })

        it("shouldn't be able to completeXConversion to an ERC20 with a different xTransferId", async () => {
            const txId1 = getId()
            const xTransferId1 = getId()
            const txId2 = getId()
            const xTransferId2 = getId()
            const amount = web3.toWei('10') // releasing 10 BNT
            const path = bntErc20Path

            await reportAndRelease(accounts[5], amount, txId1, EOS_BLOCKCHAIN, xTransferId1)
            await reportAndRelease(accounts[4], amount, txId2, EOS_BLOCKCHAIN, xTransferId2)

            await bntToken.approve(bancorNetwork.address, 0, { from: accounts[5] })
            await bntToken.approve(bancorNetwork.address, amount, { from: accounts[5] })

            await utils.catchRevert(bancorNetwork.completeXConversion(path, bancorX.address, xTransferId2, 1, accounts[5], { from: accounts[5] }))
        })

    })

    for (const percent of ["0.5", "1.0", "1.5", "2.0", "3.0"]) {
        const affiliateFee = web3.toBigNumber(1000000).mul(percent).div(100)
        describe(`advanced testing with affiliate-fee = ${percent}%:`, () => {
            before(async () => {
                await initBancorNetwork(accounts)
            })

            it("should be able to xConvert2 from ETH", async () => {
                const path = ethBntPath
                const amount = web3.toWei(1)
                const expectedRate = await bancorNetwork.rateByPath.call(path, amount);

                const retAmount = await bancorNetwork.xConvert2.call(
                    path,                         
                    amount,               
                    1,                                
                    EOS_BLOCKCHAIN,                     
                    eosAddress,                         
                    0,                                
                    affiliateAddress, affiliateFee,
                    { from: accounts[5], value: amount }
                )

                const prevBalanceOfBancorX = await bntToken.balanceOf(bancorX.address)
                const prevBalanceAffiliate = await bntToken.balanceOf(affiliateAddress)

                const res = await bancorNetwork.xConvert2(
                    path,                                               
                    amount,                                     
                    1,                                                      
                    EOS_BLOCKCHAIN,                                           
                    eosAddress,                                               
                    0,                                                      
                    affiliateAddress, affiliateFee,
                    { from: accounts[5], value: amount }
                )

                assert.equal((await bntToken.balanceOf(bancorX.address)).minus(prevBalanceOfBancorX).toFixed(0), retAmount.toFixed(0))
                assert.equal((await bntToken.balanceOf(affiliateAddress)).minus(prevBalanceAffiliate).toFixed(0), expectedFee(expectedRate, percent).toFixed(0))
            })

            it("should be able to xConvert2 from an ERC20", async () => {
                const path = erc20TokenBntPath
                const amount = web3.toWei(1)
                const expectedRate = await bancorNetwork.rateByPath.call(path, amount);

                await erc20Token.approve(bancorNetwork.address, amount, { from: accounts[5] })

                const retAmount = await bancorNetwork.xConvert2.call(
                    path,                         
                    amount,               
                    1,                                
                    EOS_BLOCKCHAIN,                     
                    eosAddress,                         
                    0,                                
                    affiliateAddress, affiliateFee,
                    { from: accounts[5] }
                )

                const prevBalanceOfBancorX = await bntToken.balanceOf(bancorX.address)
                const prevBalanceAffiliate = await bntToken.balanceOf(affiliateAddress)

                const res = await bancorNetwork.xConvert2(
                    path,                                               
                    amount,                                     
                    1,                                                      
                    EOS_BLOCKCHAIN,                                           
                    eosAddress,                                               
                    0,                                                      
                    affiliateAddress, affiliateFee,
                    { from: accounts[5] }
                )

                assert.equal((await bntToken.balanceOf(bancorX.address)).minus(prevBalanceOfBancorX).toFixed(0), retAmount.toFixed(0))
                assert.equal((await bntToken.balanceOf(affiliateAddress)).minus(prevBalanceAffiliate).toFixed(0), expectedFee(expectedRate, percent).toFixed(0))
            })
        })
    }
})
