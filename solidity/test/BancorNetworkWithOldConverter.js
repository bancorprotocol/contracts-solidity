/* global artifacts, contract, before, it, assert, web3 */
/* eslint-disable prefer-reflect */

const BancorConverter = require('./helpers/BancorConverter');
const NonStandardTokenRegistry = artifacts.require('NonStandardTokenRegistry');
const BancorNetwork = artifacts.require('BancorNetwork');
const TestBancorNetwork = artifacts.require('TestBancorNetwork');
const SmartToken = artifacts.require('SmartToken');
const NonStandardSmartToken = artifacts.require('NonStandardSmartToken');
const BancorFormula = artifacts.require('BancorFormula');
const BancorGasPriceLimit = artifacts.require('BancorGasPriceLimit');
const ContractRegistry = artifacts.require('ContractRegistry');
const ContractFeatures = artifacts.require('ContractFeatures');

const OLD_CONVERTER_VERSION = 9;

let smartToken1;
let smartToken2;
let smartToken3;
let contractRegistry;
let converter;
let bancorNetwork;

/*
Token network structure:

         SmartToken2
         /         \
    SmartToken1   SmartToken3

*/

contract('BancorNetworkWithOldConverter', accounts => {
    before(async () => {
        contractRegistry = await ContractRegistry.new();

        let contractFeatures = await ContractFeatures.new();
        let contractFeaturesId = web3.fromAscii('ContractFeatures');
        await contractRegistry.registerAddress(contractFeaturesId, contractFeatures.address);

        let gasPriceLimit = await BancorGasPriceLimit.new(BancorGasPriceLimit.class_defaults.gasPrice);
        let gasPriceLimitId = web3.fromAscii('BancorGasPriceLimit');
        await contractRegistry.registerAddress(gasPriceLimitId, gasPriceLimit.address);

        let formula = await BancorFormula.new();
        let formulaId = web3.fromAscii('BancorFormula');
        await contractRegistry.registerAddress(formulaId, formula.address);

        let nonStandardTokenRegistry = await NonStandardTokenRegistry.new();
        let nonStandardTokenRegistryId = web3.fromAscii('NonStandardTokenRegistry');
        await contractRegistry.registerAddress(nonStandardTokenRegistryId, nonStandardTokenRegistry.address);

        bancorNetwork = await BancorNetwork.new(contractRegistry.address);
        let bancorNetworkId = web3.fromAscii('BancorNetwork');
        await contractRegistry.registerAddress(bancorNetworkId, bancorNetwork.address);
        await bancorNetwork.setSignerAddress(accounts[3]);

        smartToken1 = await SmartToken.new('Token1', 'TKN1', 2);
        await smartToken1.issue(accounts[0], 1000000);

        smartToken2 = await NonStandardSmartToken.new('Token2', 'TKN2', 2);
        await smartToken2.issue(accounts[0], 2000000);

        smartToken3 = await SmartToken.new('Token3', 'TKN3', 2);
        await smartToken3.issue(accounts[0], 3000000);

        await nonStandardTokenRegistry.setAddress(smartToken2.address, true);

        converter = await BancorConverter.new(smartToken2.address, contractRegistry.address, 0, smartToken1.address, 300000, OLD_CONVERTER_VERSION);
        await converter.addConnector(smartToken3.address, 150000, false);

        await smartToken1.transfer(converter.address, 40000);
        await smartToken3.transfer(converter.address, 25000);

        await smartToken2.transferOwnership(converter.address);
        await converter.acceptTokenOwnership();
    });

    it('verifies that getReturnByPath returns the same amount as getReturn when converting a reserve to the smart token', async () => {
        let getReturn = (await converter.getReturn.call(smartToken1.address, smartToken2.address, 100));
        let returnByPath = (await bancorNetwork.getReturnByPath.call([smartToken1.address, smartToken2.address, smartToken2.address], 100))[0];
        assert.equal(getReturn.toNumber(), returnByPath.toNumber());
    });

    it('verifies that getReturnByPath returns the same amount as getReturn when converting from a token to a reserve', async () => {
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
