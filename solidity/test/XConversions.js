/* global artifacts, contract, before, it, assert */
/* eslint-disable prefer-reflect */

const sign = require('./helpers/Sign');
const utils = require('./helpers/Utils');
const ContractRegistryClient = require('./helpers/ContractRegistryClient');

const BancorConverter = artifacts.require('BancorConverter');
const BancorX = artifacts.require('BancorX');
const SmartToken = artifacts.require('SmartToken');
const EtherToken = artifacts.require('EtherToken');
const ContractRegistry = artifacts.require('ContractRegistry');
const BancorNetwork = artifacts.require('BancorNetwork');
const BancorFormula = artifacts.require('BancorFormula');
const BancorGasPriceLimit = artifacts.require('BancorGasPriceLimit');
const ContractFeatures = artifacts.require('ContractFeatures');
const ERC20Token = artifacts.require('ERC20Token');
const NonStandardTokenRegistry = artifacts.require('NonStandardTokenRegistry');

const bntTokenId = web3.fromAscii(ContractRegistryClient.BNT_TOKEN);
const bancorGasPriceLimitId = web3.fromAscii(ContractRegistryClient.BANCOR_GAS_PRICE_LIMIT);
const bancorFormulaId = web3.fromAscii(ContractRegistryClient.BANCOR_FORMULA);
const bancorNetworkId = web3.fromAscii(ContractRegistryClient.BANCOR_NETWORK);
const contractFeaturesId = web3.fromAscii(ContractRegistryClient.CONTRACT_FEATURES);
const nonStandardTokenRegistryId = web3.fromAscii(ContractRegistryClient.NON_STANDARD_TOKEN_REGISTRY);
const bancorXId = web3.fromAscii(ContractRegistryClient.BANCOR_X);

const MAX_LOCK_LIMIT = '1000000000000000000000' // 1000 bnt
const MAX_RELEASE_LIMIT = '1000000000000000000000' // 1000 bnt
const MIN_LIMIT = '1000000000000000000' // 1 bnt
const LIM_INC_PER_BLOCK = '1000000000000000000' // 1 bnt
const MIN_REQUIRED_REPORTS = '3'
const BNT_AMOUNT = '920201018469141404133'
const BNT_RESERVE_AMOUNT = '650129186275318509'

const ZERO_BYTES32 = '0x'.padEnd(66, '0');

// this is just gibberish bytes32
const eosAddress = '0xd5e9a21dbc95b47e2750562a96d365aa5fb6a75c000000000000000000000000'
const EOS_BLOCKCHAIN = '0xd5e9a21dbc95b47e2750562a96d365aa5fb6a75c000000000000000000000000'

// bancor network contracts
let bancorX, bancorNetwork, bntConverter, bntToken, etherToken, erc20Token, erc20TokenConverter
// paths
let ethBntPath, bntEthPath, erc20TokenBntPath, bntErc20Path

let reporter1, reporter2, reporter3, signerAddress, nonSignerAddress, affiliateAddress

contract("XConversions", accounts => {
    describe("basic testing:", () => {
        before(async () => {
            await initBancorNetwork(accounts)
        })

        it("should be able to xConvertPrioritized from eth with a valid signature", async () => {
            const maximumBlock = web3.eth.blockNumber + 100
            const gasPrice = BancorGasPriceLimit.class_defaults.gasPrice
            const path = ethBntPath
            const amount = web3.toWei('1')
            const { v, r, s } = sign(
                maximumBlock,
                gasPrice,
                accounts[5],
                accounts[5],
                amount,
                path,
                signerAddress
            )

            const retAmount = await bancorNetwork.xConvertPrioritized.call(
                path,                         
                amount,               
                '1',                                
                EOS_BLOCKCHAIN,                     
                eosAddress,                         
                '0',                                
                maximumBlock,                                                    
                v,                                                      
                r,                                                      
                s,                                                      
                { from: accounts[5], value: amount }
            )

            const prevBalance = await bntToken.balanceOf(bancorX.address)

            const res = await bancorNetwork.xConvertPrioritized(
                path,                                               
                amount,                                     
                '1',                                                      
                EOS_BLOCKCHAIN,                                           
                eosAddress,                                               
                '0',                                                      
                maximumBlock,                                                    
                v,                                                      
                r,                                                      
                s,                                                      
                { from: accounts[5], value: amount }
            )

            assert.equal((await bntToken.balanceOf(bancorX.address)).minus(prevBalance).toString(10), retAmount.toString(10))
        })

        it("should be able to xConvertPrioritized from eth without a valid signature", async () => {
            const maximumBlock = web3.eth.blockNumber + 100
            const gasPrice = BancorGasPriceLimit.class_defaults.gasPrice
            const path = ethBntPath
            const amount = web3.toWei('1')
            const { v, r, s } = sign(
                maximumBlock,
                gasPrice,
                accounts[5],
                accounts[5],
                amount,
                path,
                signerAddress
            )

            const retAmount = await bancorNetwork.xConvertPrioritized.call(
                path,                         
                amount,               
                '1',                                
                EOS_BLOCKCHAIN,                     
                eosAddress,                         
                '0',                                
                0,                                                    
                0,                                                      
                ZERO_BYTES32,                                                      
                ZERO_BYTES32,                                                      
                { from: accounts[5], value: amount }
            )

            const prevBalance = await bntToken.balanceOf(bancorX.address)

            const res = await bancorNetwork.xConvertPrioritized(
                path,                                               
                amount,                                     
                '1',                                                      
                EOS_BLOCKCHAIN,                                           
                eosAddress,                                               
                '0',                                                      
                0,                                                    
                0,                                                      
                ZERO_BYTES32,                                                      
                ZERO_BYTES32,                                                      
                { from: accounts[5], value: amount }
            )

            assert.equal((await bntToken.balanceOf(bancorX.address)).minus(prevBalance).toString(10), retAmount.toString(10))
        })

        it("shouldn't be able to xConvertPrioritized from eth with an invalid signature", async () => {
            const maximumBlock = web3.eth.blockNumber + 100
            const gasPrice = BancorGasPriceLimit.class_defaults.gasPrice
            const path = ethBntPath
            const amount = web3.toWei('1')
            const { v, r, s } = sign(
                maximumBlock,
                gasPrice,
                accounts[5],
                accounts[5],
                amount,
                path,
                nonSignerAddress
            )

            await utils.catchRevert(bancorNetwork.xConvertPrioritized(
                path,                                               
                amount,                                     
                '1',                                                      
                EOS_BLOCKCHAIN,                                           
                eosAddress,                                               
                '0',                                                      
                maximumBlock,                                                    
                v,                                                      
                r,                                                      
                s,                                                      
                { from: accounts[5], value: amount }
            ))
        })

        it("should be able to xConvertPrioritized2 from eth with a valid signature", async () => {
            const maximumBlock = web3.eth.blockNumber + 100
            const gasPrice = BancorGasPriceLimit.class_defaults.gasPrice
            const path = ethBntPath
            const amount = web3.toWei('1')
            const { v, r, s } = sign(
                maximumBlock,
                gasPrice,
                accounts[5],
                accounts[5],
                amount,
                path,
                signerAddress
            )

            const retAmount = await bancorNetwork.xConvertPrioritized2.call(
                path,                         
                amount,               
                '1',                                
                EOS_BLOCKCHAIN,                     
                eosAddress,                         
                '0',                                
                [amount, maximumBlock, v, r, s],
                { from: accounts[5], value: amount }
            )

            const prevBalance = await bntToken.balanceOf(bancorX.address)

            const res = await bancorNetwork.xConvertPrioritized2(
                path,                                               
                amount,                                     
                '1',                                                      
                EOS_BLOCKCHAIN,                                           
                eosAddress,                                               
                '0',                                                      
                [amount, maximumBlock, v, r, s],
                { from: accounts[5], value: amount }
            )

            assert.equal((await bntToken.balanceOf(bancorX.address)).minus(prevBalance).toString(10), retAmount.toString(10))
        })

        it("should be able to xConvertPrioritized2 from eth without a valid signature", async () => {
            const maximumBlock = web3.eth.blockNumber + 100
            const gasPrice = BancorGasPriceLimit.class_defaults.gasPrice
            const path = ethBntPath
            const amount = web3.toWei('1')
            const { v, r, s } = sign(
                maximumBlock,
                gasPrice,
                accounts[5],
                accounts[5],
                amount,
                path,
                signerAddress
            )

            const retAmount = await bancorNetwork.xConvertPrioritized2.call(
                path,                         
                amount,               
                '1',                                
                EOS_BLOCKCHAIN,                     
                eosAddress,                         
                '0',                                
                [amount, maximumBlock, v, r, s],
                { from: accounts[5], value: amount }
            )

            const prevBalance = await bntToken.balanceOf(bancorX.address)

            const res = await bancorNetwork.xConvertPrioritized2(
                path,                                               
                amount,                                     
                '1',                                                      
                EOS_BLOCKCHAIN,                                           
                eosAddress,                                               
                '0',                                                      
                [],
                { from: accounts[5], value: amount }
            )

            assert.equal((await bntToken.balanceOf(bancorX.address)).minus(prevBalance).toString(10), retAmount.toString(10))
        })

        it("shouldn't be able to xConvertPrioritized2 from eth with an invalid signature", async () => {
            const maximumBlock = web3.eth.blockNumber + 100
            const gasPrice = BancorGasPriceLimit.class_defaults.gasPrice
            const path = ethBntPath
            const amount = web3.toWei('1')
            const { v, r, s } = sign(
                maximumBlock,
                gasPrice,
                accounts[5],
                accounts[5],
                amount,
                path,
                nonSignerAddress
            )

            await utils.catchRevert(bancorNetwork.xConvertPrioritized2(
                path,                                               
                amount,                                     
                '1',                                                      
                EOS_BLOCKCHAIN,                                           
                eosAddress,                                               
                '0',                                                      
                [amount, maximumBlock, v, r, s],
                { from: accounts[5], value: amount }
            ))
        })

        it("shouldn't be able to xConvertPrioritized2 from eth with a valid signature but custom value different than amount", async () => {
            const maximumBlock = web3.eth.blockNumber + 100
            const gasPrice = BancorGasPriceLimit.class_defaults.gasPrice
            const path = ethBntPath
            const amount = web3.toWei('1')
            const customVal = amount + '1'
            const { v, r, s } = sign(
                maximumBlock,
                gasPrice,
                accounts[5],
                accounts[5],
                amount,
                path,
                signerAddress
            )

            await utils.catchRevert(bancorNetwork.xConvertPrioritized2(
                path,                                               
                amount,                                     
                '1',                                                      
                EOS_BLOCKCHAIN,                                           
                eosAddress,                                               
                '0',                                                      
                [customVal, maximumBlock, v, r, s],
                { from: accounts[5], value: amount }
            ))
        })

        it("should be able to xConvert from eth", async () => {
            const path = ethBntPath
            const amount = web3.toWei('1')

            const retAmount = await bancorNetwork.xConvert.call(
                path,                         
                amount,               
                '1',                                
                EOS_BLOCKCHAIN,                     
                eosAddress,                         
                '0',                                
                { from: accounts[5], value: amount }
            )

            const prevBalance = await bntToken.balanceOf(bancorX.address)

            const res = await bancorNetwork.xConvert(
                path,                                               
                amount,                                     
                '1',                                                      
                EOS_BLOCKCHAIN,                                           
                eosAddress,                                               
                '0',                                                      
                { from: accounts[5], value: amount }
            )

            assert.equal((await bntToken.balanceOf(bancorX.address)).minus(prevBalance).toString(10), retAmount.toString(10))
        })

        it("should be able to xConvert from an ERC20", async () => {
            const maximumBlock = web3.eth.blockNumber + 100
            const gasPrice = BancorGasPriceLimit.class_defaults.gasPrice
            const path = erc20TokenBntPath
            const amount = web3.toWei('1')

            await erc20Token.approve(bancorNetwork.address, amount, { from: accounts[5] })

            const retAmount = await bancorNetwork.xConvert.call(
                path,                         
                amount,               
                '1',                                
                EOS_BLOCKCHAIN,                     
                eosAddress,                         
                '0',                                
                { from: accounts[5] }
            )

            const prevBalance = await bntToken.balanceOf(bancorX.address)

            const res = await bancorNetwork.xConvert(
                path,                                               
                amount,                                     
                '1',                                                      
                EOS_BLOCKCHAIN,                                           
                eosAddress,                                               
                '0',                                                      
                { from: accounts[5] }
            )

            // console.log(res.receipt.gasUsed)
            assert.equal((await bntToken.balanceOf(bancorX.address)).minus(prevBalance).toString(10), retAmount.toString(10))
        })

        it("should be able to completeXConversion to eth without a valid signature", async () => {
            const txId = getId()
            const xTransferId = getId()
            const amount = web3.toWei('10') // releasing 10 BNT
            const path = bntEthPath

            await reportAndRelease(accounts[5], amount, txId, EOS_BLOCKCHAIN, xTransferId)

            const prevBalance = await web3.eth.getBalance(accounts[5])

            const res = await bntConverter.completeXConversion(
                path,                                                     // _path
                '1',                                                      // _minReturn
                xTransferId,                                              // _xTransferId
                0,                                                        // _block
                0,                                                        // _v
                ZERO_BYTES32,                                             // _r
                ZERO_BYTES32,                                             // _s
                { from: accounts[5] }
            )

            const currBalance = await web3.eth.getBalance(accounts[5])

            assert(currBalance.greaterThan(prevBalance))
        })

        it("should be able to completeXConversion to an ERC20 with a valid signature", async () => {
            const txId = getId()
            const xTransferId = getId()
            const maximumBlock = web3.eth.blockNumber + 100
            const gasPrice = BancorGasPriceLimit.class_defaults.gasPrice
            const amount = web3.toWei('10') // releasing 10 BNT
            const path = bntErc20Path

            const { v, r, s } = sign(
                maximumBlock,
                gasPrice,
                accounts[5],
                bntConverter.address,
                xTransferId,
                path,
                signerAddress
            )

            await reportAndRelease(accounts[5], amount, txId, EOS_BLOCKCHAIN, xTransferId)

            const prevBalance = await erc20Token.balanceOf(accounts[5])

            const retAmount = await bntConverter.completeXConversion.call(
                path,                                              
                '1',                                               
                xTransferId,                                       
                maximumBlock,                                      
                v,                                                 
                r,                                                 
                s,                                                 
                { from: accounts[5] }
            )

            const res = await bntConverter.completeXConversion(
                path,                                              
                '1',                                               
                xTransferId,                                       
                maximumBlock,                                      
                v,                                                 
                r,                                                 
                s,                                                 
                { from: accounts[5] }
            )

            const currBalance = await erc20Token.balanceOf(accounts[5])

            assert.equal(currBalance.minus(prevBalance).toString(10), retAmount.toString(10))
        })

        it("shouldn't be able to completeXConversion to an ERC20 with an invalid signature", async () => {
            const txId = getId()
            const xTransferId = getId()
            const maximumBlock = web3.eth.blockNumber + 100
            const gasPrice = BancorGasPriceLimit.class_defaults.gasPrice
            const amount = web3.toWei('10') // releasing 10 BNT
            const path = bntErc20Path

            const { v, r, s } = sign(
                maximumBlock,
                gasPrice,
                accounts[5],
                bntConverter.address,
                xTransferId,
                path,
                nonSignerAddress
            )

            await reportAndRelease(accounts[5], amount, txId, EOS_BLOCKCHAIN, xTransferId)

            await utils.catchRevert(bntConverter.completeXConversion(
                path,                                              
                '1',                                               
                xTransferId,                                       
                maximumBlock,                                      
                v,                                                 
                r,                                                 
                s,                                                 
                { from: accounts[5] }
            ))
        })

        it("shouldn't be able to completeXConversion to an ERC20 with a different xTransferId", async () => {
            const txId1 = getId()
            const xTransferId1 = getId()
            const txId2 = getId()
            const xTransferId2 = getId()
            const maximumBlock = web3.eth.blockNumber + 100
            const gasPrice = BancorGasPriceLimit.class_defaults.gasPrice
            const amount = web3.toWei('10') // releasing 10 BNT
            const path = bntErc20Path

            const { v, r, s } = sign(
                maximumBlock,
                gasPrice,
                accounts[5],
                bntConverter.address,
                xTransferId1,
                path,
                nonSignerAddress
            )

            await reportAndRelease(accounts[5], amount, txId1, EOS_BLOCKCHAIN, xTransferId1)
            await reportAndRelease(accounts[4], amount, txId2, EOS_BLOCKCHAIN, xTransferId2)

            await utils.catchRevert(bntConverter.completeXConversion(
                path,                                              
                '1',                                               
                xTransferId2,                                       
                maximumBlock,                                      
                v,                                                 
                r,                                                 
                s,                                                 
                { from: accounts[5] }
            ))
        })

        it("should be able to completeXConversion2 to eth without a valid signature", async () => {
            const txId = getId()
            const xTransferId = getId()
            const amount = web3.toWei('10') // releasing 10 BNT
            const path = bntEthPath

            await reportAndRelease(accounts[5], amount, txId, EOS_BLOCKCHAIN, xTransferId)

            const prevBalance = await web3.eth.getBalance(accounts[5])

            const res = await bntConverter.completeXConversion2(
                path,                                                     // _path
                '1',                                                      // _minReturn
                xTransferId,                                              // _xTransferId
                [],                                                       // _signature
                { from: accounts[5] }
            )

            const currBalance = await web3.eth.getBalance(accounts[5])

            assert(currBalance.greaterThan(prevBalance))
        })

        it("should be able to completeXConversion2 to an ERC20 with a valid signature", async () => {
            const txId = getId()
            const xTransferId = getId()
            const maximumBlock = web3.eth.blockNumber + 100
            const gasPrice = BancorGasPriceLimit.class_defaults.gasPrice
            const amount = web3.toWei('10') // releasing 10 BNT
            const path = bntErc20Path

            const { v, r, s } = sign(
                maximumBlock,
                gasPrice,
                accounts[5],
                bntConverter.address,
                xTransferId,
                path,
                signerAddress
            )

            await reportAndRelease(accounts[5], amount, txId, EOS_BLOCKCHAIN, xTransferId)

            const prevBalance = await erc20Token.balanceOf(accounts[5])

            const retAmount = await bntConverter.completeXConversion2.call(
                path,                                              
                '1',                                               
                xTransferId,                                       
                [xTransferId, maximumBlock, v, r, s],
                { from: accounts[5] }
            )

            const res = await bntConverter.completeXConversion2(
                path,                                              
                '1',                                               
                xTransferId,                                       
                [xTransferId, maximumBlock, v, r, s],
                { from: accounts[5] }
            )

            const currBalance = await erc20Token.balanceOf(accounts[5])

            assert.equal(currBalance.minus(prevBalance).toString(10), retAmount.toString(10))
        })

        it("shouldn't be able to completeXConversion2 to an ERC20 with an invalid signature", async () => {
            const txId = getId()
            const xTransferId = getId()
            const maximumBlock = web3.eth.blockNumber + 100
            const gasPrice = BancorGasPriceLimit.class_defaults.gasPrice
            const amount = web3.toWei('10') // releasing 10 BNT
            const path = bntErc20Path

            const { v, r, s } = sign(
                maximumBlock,
                gasPrice,
                accounts[5],
                bntConverter.address,
                xTransferId,
                path,
                nonSignerAddress
            )

            await reportAndRelease(accounts[5], amount, txId, EOS_BLOCKCHAIN, xTransferId)

            await utils.catchRevert(bntConverter.completeXConversion2(
                path,                                              
                '1',                                               
                xTransferId,                                       
                [xTransferId, maximumBlock, v, r, s],
                { from: accounts[5] }
            ))
        })

        it("shouldn't be able to completeXConversion2 to an ERC20 with a different xTransferId", async () => {
            const txId1 = getId()
            const xTransferId1 = getId()
            const txId2 = getId()
            const xTransferId2 = getId()
            const maximumBlock = web3.eth.blockNumber + 100
            const gasPrice = BancorGasPriceLimit.class_defaults.gasPrice
            const amount = web3.toWei('10') // releasing 10 BNT
            const path = bntErc20Path

            const { v, r, s } = sign(
                maximumBlock,
                gasPrice,
                accounts[5],
                bntConverter.address,
                xTransferId1,
                path,
                nonSignerAddress
            )

            await reportAndRelease(accounts[5], amount, txId1, EOS_BLOCKCHAIN, xTransferId1)
            await reportAndRelease(accounts[4], amount, txId2, EOS_BLOCKCHAIN, xTransferId2)

            await utils.catchRevert(bntConverter.completeXConversion2(
                path,                                              
                '1',                                               
                xTransferId2,                                       
                [xTransferId2, maximumBlock, v, r, s],
                { from: accounts[5] }
            ))
        })

        it("shouldn't be able to completeXConversion2 to an ERC20 with a valid signature but custom value different than xTransferId", async () => {
            const txId = getId()
            const xTransferId = getId()
            const customVal = xTransferId + '1'
            const maximumBlock = web3.eth.blockNumber + 100
            const gasPrice = BancorGasPriceLimit.class_defaults.gasPrice
            const amount = web3.toWei('10') // releasing 10 BNT
            const path = bntErc20Path

            const { v, r, s } = sign(
                maximumBlock,
                gasPrice,
                accounts[5],
                bntConverter.address,
                xTransferId,
                path,
                signerAddress
            )

            await reportAndRelease(accounts[5], amount, txId, EOS_BLOCKCHAIN, xTransferId)

            await utils.catchRevert(bntConverter.completeXConversion2(
                path,                                              
                '1',                                               
                xTransferId,                                       
                [customVal, maximumBlock, v, r, s],
                { from: accounts[5] }
            ))
        })
    })

    for (const percent of ["0.5", "1.0", "1.5", "2.0", "3.0"]) {
        const affiliateFee = web3.toBigNumber(1000000).mul(percent).div(100)
        describe(`advanced testing with affiliate-fee = ${percent}%:`, () => {
            before(async () => {
                await initBancorNetwork(accounts)
            })

            it("should be able to xConvertPrioritized3 from eth with a valid signature", async () => {
                const maximumBlock = web3.eth.blockNumber + 100
                const gasPrice = BancorGasPriceLimit.class_defaults.gasPrice
                const path = ethBntPath
                const amount = web3.toWei('1')
                const { v, r, s } = sign(
                    maximumBlock,
                    gasPrice,
                    accounts[5],
                    accounts[5],
                    amount,
                    path,
                    signerAddress
                )

                const retAmount = await bancorNetwork.xConvertPrioritized3.call(
                    path,                         
                    amount,               
                    '1',                                
                    EOS_BLOCKCHAIN,                     
                    eosAddress,                         
                    '0',                                
                    [amount, maximumBlock, v, r, s],
                    affiliateAddress, affiliateFee,
                    { from: accounts[5], value: amount }
                )

                const prevBalanceOfBancorX = await bntToken.balanceOf(bancorX.address)
                const prevBalanceAffiliate = await bntToken.balanceOf(affiliateAddress)

                const res = await bancorNetwork.xConvertPrioritized3(
                    path,                                               
                    amount,                                     
                    '1',                                                      
                    EOS_BLOCKCHAIN,                                           
                    eosAddress,                                               
                    '0',                                                      
                    [amount, maximumBlock, v, r, s],
                    affiliateAddress, affiliateFee,
                    { from: accounts[5], value: amount }
                )

                assert.equal((await bntToken.balanceOf(bancorX.address)).minus(prevBalanceOfBancorX).toString(10), retAmount.toString(10))
                assert.equal((await bntToken.balanceOf(affiliateAddress)).minus(prevBalanceAffiliate).toString(10), expectedFee(retAmount, percent).toString(10))
            })

            it("should be able to xConvertPrioritized3 from eth without a valid signature", async () => {
                const maximumBlock = web3.eth.blockNumber + 100
                const gasPrice = BancorGasPriceLimit.class_defaults.gasPrice
                const path = ethBntPath
                const amount = web3.toWei('1')
                const { v, r, s } = sign(
                    maximumBlock,
                    gasPrice,
                    accounts[5],
                    accounts[5],
                    amount,
                    path,
                    signerAddress
                )

                const retAmount = await bancorNetwork.xConvertPrioritized3.call(
                    path,                         
                    amount,               
                    '1',                                
                    EOS_BLOCKCHAIN,                     
                    eosAddress,                         
                    '0',                                
                    [amount, maximumBlock, v, r, s],
                    affiliateAddress, affiliateFee,
                    { from: accounts[5], value: amount }
                )

                const prevBalanceOfBancorX = await bntToken.balanceOf(bancorX.address)
                const prevBalanceAffiliate = await bntToken.balanceOf(affiliateAddress)

                const res = await bancorNetwork.xConvertPrioritized3(
                    path,                                               
                    amount,                                     
                    '1',                                                      
                    EOS_BLOCKCHAIN,                                           
                    eosAddress,                                               
                    '0',                                                      
                    [],
                    affiliateAddress, affiliateFee,
                    { from: accounts[5], value: amount }
                )

                assert.equal((await bntToken.balanceOf(bancorX.address)).minus(prevBalanceOfBancorX).toString(10), retAmount.toString(10))
                assert.equal((await bntToken.balanceOf(affiliateAddress)).minus(prevBalanceAffiliate).toString(10), expectedFee(retAmount, percent).toString(10))
            })

            it("shouldn't be able to xConvertPrioritized3 from eth with an invalid signature", async () => {
                const maximumBlock = web3.eth.blockNumber + 100
                const gasPrice = BancorGasPriceLimit.class_defaults.gasPrice
                const path = ethBntPath
                const amount = web3.toWei('1')
                const { v, r, s } = sign(
                    maximumBlock,
                    gasPrice,
                    accounts[5],
                    accounts[5],
                    amount,
                    path,
                    nonSignerAddress
                )

                await utils.catchRevert(bancorNetwork.xConvertPrioritized3(
                    path,                                               
                    amount,                                     
                    '1',                                                      
                    EOS_BLOCKCHAIN,                                           
                    eosAddress,                                               
                    '0',                                                      
                    [amount, maximumBlock, v, r, s],
                    affiliateAddress, affiliateFee,
                    { from: accounts[5], value: amount }
                ))
            })

            it("shouldn't be able to xConvertPrioritized3 from eth with a valid signature but custom value different than amount", async () => {
                const maximumBlock = web3.eth.blockNumber + 100
                const gasPrice = BancorGasPriceLimit.class_defaults.gasPrice
                const path = ethBntPath
                const amount = web3.toWei('1')
                const customVal = amount + '1'
                const { v, r, s } = sign(
                    maximumBlock,
                    gasPrice,
                    accounts[5],
                    accounts[5],
                    amount,
                    path,
                    signerAddress
                )

                await utils.catchRevert(bancorNetwork.xConvertPrioritized3(
                    path,                                               
                    amount,                                     
                    '1',                                                      
                    EOS_BLOCKCHAIN,                                           
                    eosAddress,                                               
                    '0',                                                      
                    [customVal, maximumBlock, v, r, s],
                    affiliateAddress, affiliateFee,
                    { from: accounts[5], value: amount }
                ))
            })

            it("should be able to xConvert2 from eth", async () => {
                const path = ethBntPath
                const amount = web3.toWei('1')

                const retAmount = await bancorNetwork.xConvert2.call(
                    path,                         
                    amount,               
                    '1',                                
                    EOS_BLOCKCHAIN,                     
                    eosAddress,                         
                    '0',                                
                    affiliateAddress, affiliateFee,
                    { from: accounts[5], value: amount }
                )

                const prevBalanceOfBancorX = await bntToken.balanceOf(bancorX.address)
                const prevBalanceAffiliate = await bntToken.balanceOf(affiliateAddress)

                const res = await bancorNetwork.xConvert2(
                    path,                                               
                    amount,                                     
                    '1',                                                      
                    EOS_BLOCKCHAIN,                                           
                    eosAddress,                                               
                    '0',                                                      
                    affiliateAddress, affiliateFee,
                    { from: accounts[5], value: amount }
                )

                assert.equal((await bntToken.balanceOf(bancorX.address)).minus(prevBalanceOfBancorX).toString(10), retAmount.toString(10))
                assert.equal((await bntToken.balanceOf(affiliateAddress)).minus(prevBalanceAffiliate).toString(10), expectedFee(retAmount, percent).toString(10))
            })

            it("should be able to xConvert2 from an ERC20", async () => {
                const maximumBlock = web3.eth.blockNumber + 100
                const gasPrice = BancorGasPriceLimit.class_defaults.gasPrice
                const path = erc20TokenBntPath
                const amount = web3.toWei('1')

                await erc20Token.approve(bancorNetwork.address, amount, { from: accounts[5] })

                const retAmount = await bancorNetwork.xConvert2.call(
                    path,                         
                    amount,               
                    '1',                                
                    EOS_BLOCKCHAIN,                     
                    eosAddress,                         
                    '0',                                
                    affiliateAddress, affiliateFee,
                    { from: accounts[5] }
                )

                const prevBalanceOfBancorX = await bntToken.balanceOf(bancorX.address)
                const prevBalanceAffiliate = await bntToken.balanceOf(affiliateAddress)

                const res = await bancorNetwork.xConvert2(
                    path,                                               
                    amount,                                     
                    '1',                                                      
                    EOS_BLOCKCHAIN,                                           
                    eosAddress,                                               
                    '0',                                                      
                    affiliateAddress, affiliateFee,
                    { from: accounts[5] }
                )

                assert.equal((await bntToken.balanceOf(bancorX.address)).minus(prevBalanceOfBancorX).toString(10), retAmount.toString(10))
                assert.equal((await bntToken.balanceOf(affiliateAddress)).minus(prevBalanceAffiliate).toString(10), expectedFee(retAmount, percent).toString(10))
            })
        })
    }
})

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
    signerAddress = accounts[4]
    nonSignerAddress = accounts[5]
    affiliateAddress = accounts[6]

    const gasPriceLimit = await BancorGasPriceLimit.new("30000000000"); // 30 gwei
    const bancorFormula = await BancorFormula.new();
    const contractRegistry = await ContractRegistry.new()
    const contractFeatures = await ContractFeatures.new()
    const tokenWhitelist = await NonStandardTokenRegistry.new()
        
    etherToken = await EtherToken.new()
    bntToken = await SmartToken.new('Bancor', 'BNT', 18)
    bntConverter = await BancorConverter.new(
        bntToken.address,
        contractRegistry.address,
        '30000',
        etherToken.address,
        '100000'
    )

    bancorX = await BancorX.new(
        MAX_LOCK_LIMIT,
        MAX_RELEASE_LIMIT,
        MIN_LIMIT,
        LIM_INC_PER_BLOCK,
        MIN_REQUIRED_REPORTS,
        contractRegistry.address,
        bntToken.address,
        true
    )

    await bancorX.setReporter(reporter1, true)
    await bancorX.setReporter(reporter2, true)
    await bancorX.setReporter(reporter3, true)

    await etherToken.deposit({ value: BNT_RESERVE_AMOUNT });
    await etherToken.transfer(bntConverter.address, BNT_RESERVE_AMOUNT);

    bancorNetwork = await BancorNetwork.new(contractRegistry.address);
    await bancorNetwork.setSignerAddress(signerAddress);
    await bancorNetwork.registerEtherToken(etherToken.address, true);

    await contractRegistry.registerAddress(bntTokenId, bntToken.address)
    await contractRegistry.registerAddress(bancorGasPriceLimitId, gasPriceLimit.address)
    await contractRegistry.registerAddress(bancorFormulaId, bancorFormula.address)
    await contractRegistry.registerAddress(bancorNetworkId, bancorNetwork.address)
    await contractRegistry.registerAddress(contractFeaturesId, contractFeatures.address)
    await contractRegistry.registerAddress(nonStandardTokenRegistryId, tokenWhitelist.address)
    await contractRegistry.registerAddress(bancorXId, bancorX.address)

    // issue bnt and transfer ownership to converter
    await bntToken.issue(accounts[0], BNT_AMOUNT)
    await bntToken.transferOwnership(bntConverter.address)

    // set bancorx address for bnt converter, and accept token ownership
    await bntConverter.acceptTokenOwnership()
    await bntConverter.setBancorX(bancorX.address)

    // creating second converter
    const relayToken = await SmartToken.new('Relay Token', 'RLY', 18)

    erc20Token = await ERC20Token.new('Test Token', 'TST', 0, web3.toWei('100'))
    erc20TokenConverter = await BancorConverter.new(
        relayToken.address,
        contractRegistry.address,
        '30000',
        bntToken.address,
        '500000' // 100% reserve ratio
    )

    await relayToken.issue(accounts[0], web3.toWei('200'))
    await erc20Token.transfer(erc20TokenConverter.address, web3.toWei('50'))
    await erc20Token.transfer(accounts[5], web3.toWei('50'))
    await bntToken.transfer(erc20TokenConverter.address, web3.toWei('100'))

    await erc20TokenConverter.addReserve(erc20Token.address, '500000')
    await relayToken.transferOwnership(erc20TokenConverter.address)
    await erc20TokenConverter.acceptTokenOwnership()

    // settings paths for easy use
    ethBntPath = [etherToken.address, bntToken.address, bntToken.address]
    bntEthPath = [bntToken.address, bntToken.address, etherToken.address]
    erc20TokenBntPath = [erc20Token.address, relayToken.address, bntToken.address]
    bntErc20Path = [bntToken.address, relayToken.address, erc20Token.address]
}

function getId() {
    if (this.id == undefined)
        this.id = 0
    return ++this.id
}

const Decimal = require("decimal.js")
Decimal.set({precision: 100, rounding: Decimal.ROUND_DOWN})

function expectedFee(amount, percent) {
    let fee = Decimal(amount.toFixed())
    const ratio = Decimal(percent).div(100)
    for (let n = 0; n < 4; n++)
        fee = fee.mul(ratio.pow(2 ** n).plus(1))
    return web3.toBigNumber(fee.mul(ratio).truncated())
}
