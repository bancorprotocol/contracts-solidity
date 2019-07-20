/* global artifacts, contract, before, it, assert, web3 */
/* eslint-disable prefer-reflect */

const fs = require("fs");
const truffleContract = require("truffle-contract");
const NonStandardTokenRegistry = artifacts.require('NonStandardTokenRegistry.sol');
const BancorNetwork = artifacts.require('BancorNetwork.sol');
const TestBancorNetwork = artifacts.require('TestBancorNetwork.sol');
const ContractIds = artifacts.require('ContractIds.sol');
const SmartToken = artifacts.require('SmartToken.sol');
const NonStandardSmartToken = artifacts.require('NonStandardSmartToken.sol');
const BancorFormula = artifacts.require('BancorFormula.sol');
const BancorGasPriceLimit = artifacts.require('BancorGasPriceLimit.sol');
const ContractRegistry = artifacts.require('ContractRegistry.sol');
const ContractFeatures = artifacts.require('ContractFeatures.sol');

let smartToken1;
let smartToken2;
let smartToken3;
let contractRegistry;
let contractIds;
let converter;
let bancorNetwork;
let defaultGasPriceLimit = BancorGasPriceLimit.class_defaults.gasPrice;

async function createOldConverter(tokenAddress, registryAddress, maxConversionFee, connectorTokenAddress, weight) {
    const abi = fs.readFileSync(__dirname + "/bin/bancor_converter_v9.abi");
    const bin = fs.readFileSync(__dirname + "/bin/bancor_converter_v9.bin");
    const converterContract = truffleContract({abi: JSON.parse(abi), unlinked_binary: "0x" + bin});
    const block = await web3.eth.getBlock("latest");
    converterContract.setProvider(web3.currentProvider);
    converterContract.defaults({from: web3.eth.accounts[0], gas: block.gasLimit});
    return await converterContract.new(tokenAddress, registryAddress, maxConversionFee, connectorTokenAddress, weight);
}

/*
Token network structure:

         SmartToken2
         /         \
    SmartToken1   SmartToken3

*/

contract('BancorNetworkWithOldConverter', accounts => {
    before(async () => {
        contractRegistry = await ContractRegistry.new();
        contractIds = await ContractIds.new();

        let contractFeatures = await ContractFeatures.new();
        let contractFeaturesId = await contractIds.CONTRACT_FEATURES.call();
        await contractRegistry.registerAddress(contractFeaturesId, contractFeatures.address);

        let gasPriceLimit = await BancorGasPriceLimit.new(defaultGasPriceLimit);
        let gasPriceLimitId = await contractIds.BANCOR_GAS_PRICE_LIMIT.call();
        await contractRegistry.registerAddress(gasPriceLimitId, gasPriceLimit.address);

        let formula = await BancorFormula.new();
        let formulaId = await contractIds.BANCOR_FORMULA.call();
        await contractRegistry.registerAddress(formulaId, formula.address);

        let nonStandardTokenRegistry = await NonStandardTokenRegistry.new();
        let nonStandardTokenRegistryId = await contractIds.NON_STANDARD_TOKEN_REGISTRY.call();
        await contractRegistry.registerAddress(nonStandardTokenRegistryId, nonStandardTokenRegistry.address);

        bancorNetwork = await BancorNetwork.new(contractRegistry.address);
        let bancorNetworkId = await contractIds.BANCOR_NETWORK.call();
        await contractRegistry.registerAddress(bancorNetworkId, bancorNetwork.address);
        await bancorNetwork.setSignerAddress(accounts[3]);

        smartToken1 = await SmartToken.new('Token1', 'TKN1', 2);
        await smartToken1.issue(accounts[0], 1000000);

        smartToken2 = await NonStandardSmartToken.new('Token2', 'TKN2', 2);
        await smartToken2.issue(accounts[0], 2000000);

        smartToken3 = await SmartToken.new('Token3', 'TKN3', 2);
        await smartToken3.issue(accounts[0], 3000000);

        await nonStandardTokenRegistry.setAddress(smartToken2.address, true);

        converter = await createOldConverter(smartToken2.address, contractRegistry.address, 0, smartToken1.address, 300000);
        await converter.addConnector(smartToken3.address, 150000, false);

        await smartToken1.transfer(converter.address, 40000);
        await smartToken3.transfer(converter.address, 25000);

        await smartToken2.transferOwnership(converter.address);
        await converter.acceptTokenOwnership();
    });

    it('verifies that getReturnByPath returns the same amount as getReturn when converting a connector to the smart token', async () => {
        let getReturn = (await converter.getReturn.call(smartToken1.address, smartToken2.address, 100));
        let returnByPath = (await bancorNetwork.getReturnByPath.call([smartToken1.address, smartToken2.address, smartToken2.address], 100))[0];
        assert.equal(getReturn.toNumber(), returnByPath.toNumber());
    });

    it('verifies that getReturnByPath returns the same amount as getReturn when converting from a token to a connector', async () => {
        let getReturn = (await converter.getReturn.call(smartToken2.address, smartToken1.address, 100));
        let returnByPath = (await bancorNetwork.getReturnByPath.call([smartToken2.address, smartToken2.address, smartToken1.address], 100))[0];
        assert.equal(getReturn.toNumber(), returnByPath.toNumber());
    });

    for (let amount = 0; amount < 10; amount++) {
        for (let fee = 0; fee < 10; fee++) {
            it(`test old getReturn with amount = ${amount} and fee = ${fee}`, async () => {
                const tester = await TestBancorNetwork.new(amount, fee);
                const [_amount, _fee] = await tester.getReturnOld();
                const expected = `amount = ${amount} and fee = ${0}`;
                const actual = `amount = ${_amount} and fee = ${_fee}`;
                assert.equal(actual, expected);
            });
        }
    }

    for (let amount = 0; amount < 10; amount++) {
        for (let fee = 0; fee < 10; fee++) {
            it(`test new getReturn with amount = ${amount} and fee = ${fee}`, async () => {
                const tester = await TestBancorNetwork.new(amount, fee);
                const [_amount, _fee] = await tester.getReturnNew();
                const expected = `amount = ${amount} and fee = ${fee}`;
                const actual = `amount = ${_amount} and fee = ${_fee}`;
                assert.equal(actual, expected);
            });
        }
    }
});
