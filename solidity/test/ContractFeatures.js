/* global artifacts, contract, it, assert */
/* eslint-disable prefer-reflect */

const ContractFeatures = artifacts.require('ContractFeatures.sol');
const TestFeatures = artifacts.require('TestFeatures.sol');

let FEATURE1 = 1 << 0;
let FEATURE2 = 1 << 1;
let FEATURE3 = 1 << 2;

contract('ContractFeatures', () => {
    it('verifies that a given contract feature is not set after construction', async () => {
        let contractFeatures = await ContractFeatures.new();
        let testFeatures = await TestFeatures.new(contractFeatures.address);
        let isSupported = await contractFeatures.isSupported.call(testFeatures.address, FEATURE1);
        assert(!isSupported);
    });

    it('verifies that a contract can enable a feature', async () => {
        let contractFeatures = await ContractFeatures.new();
        let testFeatures = await TestFeatures.new(contractFeatures.address);
        await testFeatures.enableFeatures(FEATURE1, true);
        await testFeatures.enableFeatures(FEATURE3, true);
        let isSupported = await contractFeatures.isSupported.call(testFeatures.address, FEATURE1);
        assert(isSupported);
        isSupported = await contractFeatures.isSupported.call(testFeatures.address, FEATURE2);
        assert(!isSupported);
        isSupported = await contractFeatures.isSupported.call(testFeatures.address, FEATURE3);
        assert(isSupported);
    });

    it('verifies that a contract can enable multiple features with one call', async () => {
        let contractFeatures = await ContractFeatures.new();
        let testFeatures = await TestFeatures.new(contractFeatures.address);
        await testFeatures.enableFeatures(FEATURE1 | FEATURE3, true);
        let isSupported = await contractFeatures.isSupported.call(testFeatures.address, FEATURE1);
        assert(isSupported);
        isSupported = await contractFeatures.isSupported.call(testFeatures.address, FEATURE2);
        assert(!isSupported);
        isSupported = await contractFeatures.isSupported.call(testFeatures.address, FEATURE3);
        assert(isSupported);
    });

    it('verifies that a contract can attempt to enable a feature that is already enabled', async () => {
        let contractFeatures = await ContractFeatures.new();
        let testFeatures = await TestFeatures.new(contractFeatures.address);
        await testFeatures.enableFeatures(FEATURE1, true);
        await testFeatures.enableFeatures(FEATURE1, true);
        await testFeatures.enableFeatures(FEATURE3, true);
        let isSupported = await contractFeatures.isSupported.call(testFeatures.address, FEATURE1);
        assert(isSupported);
        isSupported = await contractFeatures.isSupported.call(testFeatures.address, FEATURE2);
        assert(!isSupported);
        isSupported = await contractFeatures.isSupported.call(testFeatures.address, FEATURE3);
        assert(isSupported);
    });

    it('verifies that a contract can disable a feature', async () => {
        let contractFeatures = await ContractFeatures.new();
        let testFeatures = await TestFeatures.new(contractFeatures.address);
        await testFeatures.enableFeatures(FEATURE1, true);
        await testFeatures.enableFeatures(FEATURE2, true);
        await testFeatures.enableFeatures(FEATURE3, true);
        let isSupported = await contractFeatures.isSupported.call(testFeatures.address, FEATURE1);
        assert(isSupported);
        isSupported = await contractFeatures.isSupported.call(testFeatures.address, FEATURE2);
        assert(isSupported);
        isSupported = await contractFeatures.isSupported.call(testFeatures.address, FEATURE3);
        assert(isSupported);

        await testFeatures.enableFeatures(FEATURE2, false);
        isSupported = await contractFeatures.isSupported.call(testFeatures.address, FEATURE1);
        assert(isSupported);
        isSupported = await contractFeatures.isSupported.call(testFeatures.address, FEATURE2);
        assert(!isSupported);
        isSupported = await contractFeatures.isSupported.call(testFeatures.address, FEATURE3);
        assert(isSupported);
    });
});
