const { accounts, contract } = require('@openzeppelin/test-environment');
const { BN } = require('@openzeppelin/test-helpers');
const { expect } = require('../../chai-local');

const { registry } = require('./helpers/Constants');
const ConverterHelper = require('./helpers/Converter');

const BancorNetwork = contract.fromArtifact('BancorNetwork');
const TestBancorNetwork = contract.fromArtifact('TestBancorNetwork');
const DSToken = contract.fromArtifact('DSToken');
const BancorFormula = contract.fromArtifact('BancorFormula');
const ContractRegistry = contract.fromArtifact('ContractRegistry');

/*
Token network structure:

         DSToken2
         /         \
    DSToken1   DSToken3

*/

describe('BancorNetworkWithOldConverter', () => {
    const OLD_CONVERTER_VERSION = 9;

    let poolToken1;
    let poolToken2;
    let poolToken3;
    let contractRegistry;
    let converter;
    let bancorNetwork;
    const owner = accounts[0];

    before(async () => {
        // The following contracts are unaffected by the underlying tests, this can be shared.
        contractRegistry = await ContractRegistry.new();

        const bancorFormula = await BancorFormula.new();
        await bancorFormula.init();
        await contractRegistry.registerAddress(registry.BANCOR_FORMULA, bancorFormula.address);
    });

    beforeEach(async () => {
        bancorNetwork = await BancorNetwork.new(contractRegistry.address);
        await contractRegistry.registerAddress(registry.BANCOR_NETWORK, bancorNetwork.address);

        poolToken1 = await DSToken.new('Token1', 'TKN1', 2);
        await poolToken1.issue(owner, 1000000);

        poolToken2 = await DSToken.new('Token2', 'TKN2', 2);
        await poolToken2.issue(owner, 2000000);

        poolToken3 = await DSToken.new('Token3', 'TKN3', 2);
        await poolToken3.issue(owner, 3000000);

        converter = await ConverterHelper.new(
            1,
            poolToken2.address,
            contractRegistry.address,
            0,
            poolToken1.address,
            300000,
            OLD_CONVERTER_VERSION
        );
        await converter.addConnector(poolToken3.address, 150000, false);

        await poolToken1.transfer(converter.address, 40000);
        await poolToken3.transfer(converter.address, 25000);

        await poolToken2.transferOwnership(converter.address);
        await converter.acceptTokenOwnership();
    });

    it('verifies that isV28OrHigherConverter returns false', async () => {
        const network = await TestBancorNetwork.new(0, 0);

        expect(await network.isV28OrHigherConverterExternal.call(converter.address)).to.be.false();
    });

    it('verifies that getReturnByPath returns the same amount as getReturn when converting a reserve to the liquid token', async () => {
        const value = new BN(100);
        const getReturn = await converter.getReturn.call(poolToken1.address, poolToken2.address, value);
        const returnByPath = (
            await bancorNetwork.getReturnByPath.call(
                [poolToken1.address, poolToken2.address, poolToken2.address],
                value
            )
        )[0];

        expect(getReturn).to.be.bignumber.equal(returnByPath);
    });

    it('verifies that getReturnByPath returns the same amount as getReturn when converting from a token to a reserve', async () => {
        const value = new BN(100);
        const getReturn = await converter.getReturn.call(poolToken2.address, poolToken1.address, value);
        const returnByPath = (
            await bancorNetwork.getReturnByPath.call(
                [poolToken2.address, poolToken2.address, poolToken1.address],
                value
            )
        )[0];

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
