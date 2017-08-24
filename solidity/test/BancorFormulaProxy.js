/* global artifacts, contract, before, it, assert */
/* eslint-disable prefer-reflect */

const BancorFormulaProxy = artifacts.require('BancorFormulaProxy.sol');
const BancorFormula = artifacts.require('BancorFormula.sol');
const utils = require('./helpers/Utils');

const CRR40Percent = 400000;

let formula;
let formulaAddress;

contract('BancorFormulaProxy', (accounts) => {
    before(async () => {
        formula = await BancorFormula.new();
        formulaAddress = formula.address;
    });

    it('verifies the formula after construction', async () => {
        let proxy = await BancorFormulaProxy.new(formulaAddress);
        let formula = await proxy.formula.call();
        assert.equal(formula, formulaAddress);
    });

    it('should throw when attempting to construct the proxy with no formula', async () => {
        try {
            await BancorFormulaProxy.new('0x0');
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies the owner can update the formula contract address', async () => {
        let proxy = await BancorFormulaProxy.new(formulaAddress);
        await proxy.setFormula(accounts[3]);
        let formula = await proxy.formula.call();
        assert.equal(formula, accounts[3]);
    });

    it('should throw when a non owner attempts update the formula contract address', async () => {
        let proxy = await BancorFormulaProxy.new(formulaAddress);

        try {
            await proxy.setFormula(accounts[3], { from: accounts[1] });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when the owner attempts update the formula contract address with an invalid address', async () => {
        let proxy = await BancorFormulaProxy.new(formulaAddress);

        try {
            await proxy.setFormula('0x0');
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when the owner attempts update the formula contract address with the proxy address', async () => {
        let proxy = await BancorFormulaProxy.new(formulaAddress);

        try {
            await proxy.setFormula(proxy.address);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies that the purchase return proxy calls the formula purchase return', async () => {
        let proxy = await BancorFormulaProxy.new(formulaAddress);
        let proxyPurchaseReturn = await proxy.calculatePurchaseReturn(1000, 1000, CRR40Percent, 20);
        let formulaPurchaseReturn = await formula.calculatePurchaseReturn(1000, 1000, CRR40Percent, 20);
        assert.equal(proxyPurchaseReturn.toNumber(), formulaPurchaseReturn.toNumber());
    });

    it('verifies that the sale return proxy calls the formula sale return', async () => {
        let proxy = await BancorFormulaProxy.new(formulaAddress);
        let proxySaleReturn = await proxy.calculateSaleReturn(1000, 1000, CRR40Percent, 40);
        let formulaSaleReturn = await formula.calculateSaleReturn(1000, 1000, CRR40Percent, 40);
        assert.equal(proxySaleReturn.toNumber(), formulaSaleReturn.toNumber());
    });
});
