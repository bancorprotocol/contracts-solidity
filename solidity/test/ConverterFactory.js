const { expect } = require('chai');
const { expectRevert, expectEvent, BN } = require('@openzeppelin/test-helpers');

const ContractRegistry = artifacts.require('ContractRegistry');
const ConverterFactory = artifacts.require('TestConverterFactory');
const LiquidTokenConverterFactory = artifacts.require('LiquidTokenConverterFactory');
const LiquidityPoolV1ConverterFactory = artifacts.require('LiquidityPoolV1ConverterFactory');
const LiquidityPoolV2ConverterFactory = artifacts.require('LiquidityPoolV2ConverterFactory');
const TypedConverterAnchorFactory = artifacts.require('TestTypedConverterAnchorFactory');
const ConverterBase = artifacts.require('ConverterBase');
const DSToken = artifacts.require('DSToken');

contract('ConverterFactory', accounts => {
    let contractRegistry;
    let converterFactory;
    let anchorFactory;
    let factory;
    const owner = accounts[0];
    const nonOwner = accounts[1];

    const MAX_CONVERSION_FEE = new BN(10000);

    for (const Factory of [LiquidTokenConverterFactory, LiquidityPoolV1ConverterFactory, LiquidityPoolV2ConverterFactory]) {
        describe(Factory.contractName, () => {

    before(async () => {
        // The following contracts are unaffected by the underlying tests, this can be shared.
        contractRegistry = await ContractRegistry.new();
    });

    beforeEach(async () => {
        converterFactory = await ConverterFactory.new();
        anchorFactory = await TypedConverterAnchorFactory.new('TypedAnchor');
        factory = await Factory.new();
    });

    it('should allow the owner to register a typed converter anchor factory', async () => {
        await converterFactory.registerTypedConverterAnchorFactory(anchorFactory.address);
        expect(await converterFactory.anchorFactories.call(await anchorFactory.converterType.call())).to.eql(anchorFactory.address);
    });

    it('should allow the owner to reregister a typed converter anchor factory', async () => {
        await converterFactory.registerTypedConverterAnchorFactory(anchorFactory.address);

        const anchorFactory2 = await TypedConverterAnchorFactory.new('TypedAnchor2');
        expect(await anchorFactory.converterType.call()).to.be.bignumber.equal(await anchorFactory.converterType.call());

        await converterFactory.registerTypedConverterAnchorFactory(anchorFactory2.address);
        expect(await converterFactory.anchorFactories.call(await anchorFactory2.converterType.call())).to.eql(anchorFactory2.address);
    });

    it('should revert if a non-owner attempts to register a typed converter anchor factory', async () => {
        await expectRevert(converterFactory.registerTypedConverterAnchorFactory(anchorFactory.address, { from: nonOwner }), 'ERR_ACCESS_DENIED');
    });

    it('should allow the owner to register a typed converter factory', async () => {
        await converterFactory.registerTypedConverterFactory(factory.address);
        expect(await converterFactory.converterFactories.call(await factory.converterType.call())).to.eql(factory.address);
    });

    it('should allow the owner to reregister a typed converter factory', async () => {
        await converterFactory.registerTypedConverterFactory(factory.address);

        const factory2 = await Factory.new();
        expect(await factory.converterType.call()).to.be.bignumber.equal(await factory2.converterType.call());

        await converterFactory.registerTypedConverterFactory(factory2.address);
        expect(await converterFactory.converterFactories.call(await factory2.converterType.call())).to.eql(factory2.address);
    });

    it('should revert if a non-owner attempts to register a typed converter factory', async () => {
        await expectRevert(converterFactory.registerTypedConverterFactory(factory.address, { from: nonOwner }), 'ERR_ACCESS_DENIED');
    });

    it('should create an achor using an existing factory', async () => {
        await converterFactory.registerTypedConverterAnchorFactory(anchorFactory.address);

        const name = 'Anchor1';
        await converterFactory.createAnchor(await anchorFactory.converterType.call(), name, 'ANCHOR1', 2);

        const anchorAddress = await converterFactory.createdAnchor.call();
        const anchor = await DSToken.at(anchorAddress);

        expect(await anchor.name.call()).to.not.be.eql(name);
        expect(await anchor.name.call()).to.be.eql(await anchorFactory.name.call());
        expect(await anchor.owner.call()).to.be.eql(converterFactory.address);
        expect(await anchor.newOwner.call()).to.be.eql(owner);
    });

    it('should create an achor using custom settings', async () => {
        const name = 'Anchor1';
        await converterFactory.createAnchor(11, name, 'ANCHOR1', 2);

        const anchorAddress = await converterFactory.createdAnchor.call();
        const anchor = await DSToken.at(anchorAddress);

        expect(await anchor.name.call()).to.be.eql(name);
        expect(await anchor.name.call()).not.to.be.eql(await anchorFactory.name.call());
        expect(await anchor.owner.call()).to.be.eql(converterFactory.address);
        expect(await anchor.newOwner.call()).to.be.eql(owner);
    });

    it('should create converter', async () => {
        await converterFactory.registerTypedConverterFactory(factory.address);

        const anchor = await DSToken.new('Token1', 'TKN1', 2);

        const converterType = await factory.converterType.call();

        const res = await converterFactory.createConverter(converterType, anchor.address,
            contractRegistry.address, MAX_CONVERSION_FEE);
        const converterAddress = await converterFactory.createdConverter.call();
        const converter = await ConverterBase.at(converterAddress);

        expect(await converter.anchor.call()).to.be.eql(anchor.address);
        expect(await converter.registry.call()).to.be.eql(contractRegistry.address);
        expect(await converter.maxConversionFee.call()).to.be.bignumber.equal(MAX_CONVERSION_FEE);
        expect(await converter.owner.call()).to.be.eql(converterFactory.address);
        expect(await converter.newOwner.call()).to.be.eql(owner);

        expectEvent(res, 'NewConverter', { _type: converterType, _converter: converter.address, _owner: owner });
    });
    });
    }
});
