const { expect } = require('chai');
const { BN } = require('@openzeppelin/test-helpers');

const { registry } = require('./helpers/Constants');
const ConverterHelper = require('./helpers/Converter');

const BancorNetwork = artifacts.require('BancorNetwork');
const TestBancorNetwork = artifacts.require('TestBancorNetwork');
const SmartToken = artifacts.require('SmartToken');
const BancorFormula = artifacts.require('BancorFormula');
const ContractRegistry = artifacts.require('ContractRegistry');

/*
Token network structure:

         SmartToken2
         /         \
    SmartToken1   SmartToken3

*/

contract('BancorNetworkWithOldConverter', accounts => {
    const OLD_CONVERTER_VERSION = 9;

    let smartToken1;
    let smartToken2;
    let smartToken3;
    let contractRegistry;
    let converter;
    let bancorNetwork;
    const owner = accounts[0];

    beforeEach(async () => {
        contractRegistry = await ContractRegistry.new();

        const bancorFormula = await BancorFormula.new();
        await contractRegistry.registerAddress(registry.BANCOR_FORMULA, bancorFormula.address);

        bancorNetwork = await BancorNetwork.new(contractRegistry.address);
        await contractRegistry.registerAddress(registry.BANCOR_NETWORK, bancorNetwork.address);

        smartToken1 = await SmartToken.new('Token1', 'TKN1', 2);
        await smartToken1.issue(owner, 1000000);

        smartToken2 = await SmartToken.new('Token2', 'TKN2', 2);
        await smartToken2.issue(owner, 2000000);

        smartToken3 = await SmartToken.new('Token3', 'TKN3', 2);
        await smartToken3.issue(owner, 3000000);

        converter = await ConverterHelper.new(1, smartToken2.address, contractRegistry.address, 0, smartToken1.address,
            300000, OLD_CONVERTER_VERSION);
        await converter.addConnector(smartToken3.address, 150000, false);

        await smartToken1.transfer(converter.address, 40000);
        await smartToken3.transfer(converter.address, 25000);

        await smartToken2.transferOwnership(converter.address);
        await converter.acceptTokenOwnership();
    });

    it('verifies that isV28OrHigherConverter returns false', async () => {
        const network = await TestBancorNetwork.new(0, 0);

        expect(await network.isV28OrHigherConverterExternal.call(converter.address)).to.be.false();
    });

    it('verifies that getReturnByPath returns the same amount as getReturn when converting a reserve to the smart token', async () => {
        const value = new BN(100);
        const getReturn = (await converter.getReturn.call(smartToken1.address, smartToken2.address, value));
        const returnByPath = (await bancorNetwork.getReturnByPath.call([smartToken1.address, smartToken2.address, smartToken2.address], value))[0];

        expect(getReturn).to.be.bignumber.equal(returnByPath);
    });

    it('verifies that getReturnByPath returns the same amount as getReturn when converting from a token to a reserve', async () => {
        const value = new BN(100);
        const getReturn = (await converter.getReturn.call(smartToken2.address, smartToken1.address, value));
        const returnByPath = (await bancorNetwork.getReturnByPath.call([smartToken2.address, smartToken2.address, smartToken1.address], value))[0];

        expect(getReturn).to.be.bignumber.equal(returnByPath);
    });

    for (let amount = 0; amount < 10; amount++) {
        for (let fee = 0; fee < 10; fee++) {
            it(`test old getReturn with amount = ${amount} and fee = ${fee}`, async () => {
                const tester = await TestBancorNetwork.new(amount, fee);
                const amounts = await tester.getReturnOld.call();
                const returnAmount = amounts[0];
                const returnFee = amounts[1];

                expect(returnAmount).to.be.bignumber.equal(new BN(amount));
                expect(returnFee).to.be.bignumber.equal(new BN(0));
            });
        }
    }

    for (let amount = 0; amount < 10; amount++) {
        for (let fee = 0; fee < 10; fee++) {
            it(`test new getReturn with amount = ${amount} and fee = ${fee}`, async () => {
                const tester = await TestBancorNetwork.new(amount, fee);
                const amounts = await tester.getReturnNew.call();
                const returnAmount = amounts[0];
                const returnFee = amounts[1];

                expect(returnAmount).to.be.bignumber.equal(new BN(amount));
                expect(returnFee).to.be.bignumber.equal(new BN(fee));
            });
        }
    }
});
