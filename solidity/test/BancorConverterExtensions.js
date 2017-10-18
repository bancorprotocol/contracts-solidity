/* global artifacts, contract, before, it, assert */
/* eslint-disable prefer-reflect */

const BancorConverterExtensions = artifacts.require('BancorConverterExtensions.sol');
const BancorFormula = artifacts.require('BancorFormula.sol');
const BancorGasPriceLimit = artifacts.require('BancorGasPriceLimit.sol');
const BancorQuickConverter = artifacts.require('BancorQuickConverter.sol');
const utils = require('./helpers/Utils');

let formulaAddress;
let gasPriceLimitAddress;
let quickConverterAddress;

async function initConverterExtensions() {
    return await BancorConverterExtensions.new(formulaAddress, gasPriceLimitAddress, quickConverterAddress);
}

contract('BancorConverterExtensions', (accounts) => {
    before(async () => {
        let formula = await BancorFormula.new();
        let gasPriceLimit = await BancorGasPriceLimit.new(22000000000);
        let quickConverter = await BancorQuickConverter.new();
        formulaAddress = formula.address;
        gasPriceLimitAddress = gasPriceLimit.address;
        quickConverterAddress = quickConverter.address;
    });

    it('verifies the data after construction', async () => {
        let converterExtensions = await initConverterExtensions();
        let formula = await converterExtensions.formula.call();
        assert.equal(formula, formulaAddress);

        let gasPriceLimit = await converterExtensions.gasPriceLimit.call();
        assert.equal(gasPriceLimit, gasPriceLimitAddress);

        let quickConverter = await converterExtensions.quickConverter.call();
        assert.equal(quickConverter, quickConverterAddress);
    });

    it('should throw when attempting to construct the converter extensions with no formula', async () => {
        try {
            await BancorConverterExtensions.new('0x0', gasPriceLimitAddress, quickConverterAddress);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to construct the converter extensions with no gas price limit', async () => {
        try {
            await BancorConverterExtensions.new(formulaAddress, '0x0', quickConverterAddress);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to construct the converter extensions with no quick converter', async () => {
        try {
            await BancorConverterExtensions.new(formulaAddress, gasPriceLimitAddress, '0x0');
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies the owner can update the formula contract address', async () => {
        let converterExtensions = await initConverterExtensions();
        await converterExtensions.setFormula(accounts[3]);
        let formula = await converterExtensions.formula.call();
        assert.equal(formula, accounts[3]);
    });

    it('should throw when a non owner attempts update the formula contract address', async () => {
        let converterExtensions = await initConverterExtensions();

        try {
            await converterExtensions.setFormula(accounts[3], { from: accounts[1] });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when the owner attempts update the formula contract address with an invalid address', async () => {
        let converterExtensions = await initConverterExtensions();

        try {
            await converterExtensions.setFormula('0x0');
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when the owner attempts update the formula contract address with the converter extensions address', async () => {
        let converterExtensions = await initConverterExtensions();

        try {
            await converterExtensions.setFormula(converterExtensions.address);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies the owner can update the gas price limit contract address', async () => {
        let converterExtensions = await initConverterExtensions();
        await converterExtensions.setGasPriceLimit(accounts[3]);
        let gasPriceLimit = await converterExtensions.gasPriceLimit.call();
        assert.equal(gasPriceLimit, accounts[3]);
    });

    it('should throw when a non owner attempts update the gas price limit contract address', async () => {
        let converterExtensions = await initConverterExtensions();

        try {
            await converterExtensions.setGasPriceLimit(accounts[3], { from: accounts[1] });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when the owner attempts update the gas price limit contract address with an invalid address', async () => {
        let converterExtensions = await initConverterExtensions();

        try {
            await converterExtensions.setGasPriceLimit('0x0');
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when the owner attempts update the gas price limit contract address with the converter extensions address', async () => {
        let converterExtensions = await initConverterExtensions();

        try {
            await converterExtensions.setGasPriceLimit(converterExtensions.address);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies the owner can update the quick converter contract address', async () => {
        let converterExtensions = await initConverterExtensions();
        await converterExtensions.setQuickConverter(accounts[3]);
        let quickConverter = await converterExtensions.quickConverter.call();
        assert.equal(quickConverter, accounts[3]);
    });

    it('should throw when a non owner attempts update the quick converter contract address', async () => {
        let converterExtensions = await initConverterExtensions();

        try {
            await converterExtensions.setQuickConverter(accounts[3], { from: accounts[1] });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when the owner attempts update the quick converter contract address with an invalid address', async () => {
        let converterExtensions = await initConverterExtensions();

        try {
            await converterExtensions.setQuickConverter('0x0');
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when the owner attempts update the quick converter contract address with the converter extensions address', async () => {
        let converterExtensions = await initConverterExtensions();

        try {
            await converterExtensions.setQuickConverter(converterExtensions.address);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });
});
