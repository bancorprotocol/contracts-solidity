const { accounts, defaultSender, contract } = require('@openzeppelin/test-environment');
const { expectRevert, expectEvent, BN, constants } = require('@openzeppelin/test-helpers');
const { expect } = require('../../chai-local');

const ContractRegistry = contract.fromArtifact('ContractRegistry');
const ConverterFactory = contract.fromArtifact('TestConverterFactory');
const LiquidityPoolV1ConverterFactory = contract.fromArtifact('LiquidityPoolV1ConverterFactory');
const StandardPoolConverterFactory = contract.fromArtifact('StandardPoolConverterFactory');
const FixedRatePoolConverterFactory = contract.fromArtifact('FixedRatePoolConverterFactory');
const TypedConverterAnchorFactory = contract.fromArtifact('TestTypedConverterAnchorFactory');
const TypedConverterCustomFactory = contract.fromArtifact('TestTypedConverterCustomFactory');
const ConverterBase = contract.fromArtifact('ConverterBase');
const DSToken = contract.fromArtifact('DSToken');

const Factories = {
    LiquidityPoolV1ConverterFactory,
    StandardPoolConverterFactory,
    FixedRatePoolConverterFactory
};

describe('ConverterFactory', () => {
    let contractRegistry;
    let converterFactory;
    let anchorFactory;
    let customFactory;
    let factory;
    const owner = defaultSender;
    const nonOwner = accounts[1];

    const MAX_CONVERSION_FEE = new BN(10000);

    for (const contractName in Factories) {
        describe(contractName, () => {
            before(async () => {
                // The following contracts are unaffected by the underlying tests, this can be shared.
                contractRegistry = await ContractRegistry.new();
            });

            beforeEach(async () => {
                converterFactory = await ConverterFactory.new();
                anchorFactory = await TypedConverterAnchorFactory.new('TypedAnchor');
                customFactory = await TypedConverterCustomFactory.new('TypedAnchor');
                factory = await Factories[contractName].new();
            });

            it('should allow the owner to register a typed converter anchor factory', async () => {
                await converterFactory.registerTypedConverterAnchorFactory(anchorFactory.address);
                expect(await converterFactory.anchorFactories.call(await anchorFactory.converterType.call())).to.eql(
                    anchorFactory.address
                );
            });

            it('should allow the owner to reregister a typed converter anchor factory', async () => {
                await converterFactory.registerTypedConverterAnchorFactory(anchorFactory.address);

                const anchorFactory2 = await TypedConverterAnchorFactory.new('TypedAnchor2');
                expect(await anchorFactory.converterType.call()).to.be.bignumber.equal(
                    await anchorFactory.converterType.call()
                );

                await converterFactory.registerTypedConverterAnchorFactory(anchorFactory2.address);
                expect(await converterFactory.anchorFactories.call(await anchorFactory2.converterType.call())).to.eql(
                    anchorFactory2.address
                );
            });

            it('should revert if a non-owner attempts to register a typed converter anchor factory', async () => {
                await expectRevert(
                    converterFactory.registerTypedConverterAnchorFactory(anchorFactory.address, { from: nonOwner }),
                    'ERR_ACCESS_DENIED'
                );
            });

            it('should allow the owner to register a typed converter factory', async () => {
                await converterFactory.registerTypedConverterFactory(factory.address);
                expect(await converterFactory.converterFactories.call(await factory.converterType.call())).to.eql(
                    factory.address
                );
            });

            it('should allow the owner to reregister a typed converter factory', async () => {
                await converterFactory.registerTypedConverterFactory(factory.address);

                const factory2 = await Factories[contractName].new();
                expect(await factory.converterType.call()).to.be.bignumber.equal(await factory2.converterType.call());

                await converterFactory.registerTypedConverterFactory(factory2.address);
                expect(await converterFactory.converterFactories.call(await factory2.converterType.call())).to.eql(
                    factory2.address
                );
            });

            it('should revert if a non-owner attempts to register a typed converter factory', async () => {
                await expectRevert(
                    converterFactory.registerTypedConverterFactory(factory.address, { from: nonOwner }),
                    'ERR_ACCESS_DENIED'
                );
            });

            it('should allow the owner to register a typed converter custom factory', async () => {
                await converterFactory.registerTypedConverterCustomFactory(customFactory.address);
                expect(await converterFactory.customFactories.call(await customFactory.converterType.call())).to.eql(
                    customFactory.address
                );
            });

            it('should allow the owner to reregister a typed converter custom factory', async () => {
                await converterFactory.registerTypedConverterCustomFactory(customFactory.address);

                const customFactory2 = await TypedConverterCustomFactory.new('TypedCustom2');
                expect(await customFactory.converterType.call()).to.be.bignumber.equal(
                    await customFactory.converterType.call()
                );

                await converterFactory.registerTypedConverterCustomFactory(customFactory2.address);
                expect(await converterFactory.customFactories.call(await customFactory2.converterType.call())).to.eql(
                    customFactory2.address
                );
            });

            it('should revert if a non-owner attempts to register a typed converter custom factory', async () => {
                await expectRevert(
                    converterFactory.registerTypedConverterCustomFactory(customFactory.address, { from: nonOwner }),
                    'ERR_ACCESS_DENIED'
                );
            });

            it('should allow the owner to unregister a registered typed converter anchor factory', async () => {
                await converterFactory.registerTypedConverterAnchorFactory(anchorFactory.address);

                expect(await converterFactory.anchorFactories.call(await anchorFactory.converterType.call())).to.eql(
                    anchorFactory.address
                );

                await converterFactory.unregisterTypedConverterAnchorFactory(anchorFactory.address);

                expect(await converterFactory.anchorFactories.call(await anchorFactory.converterType.call())).to.eql(
                    constants.ZERO_ADDRESS
                );
            });

            it('should revert if the owner attempts to unregister an unregistered typed converter anchor factory', async () => {
                await converterFactory.registerTypedConverterAnchorFactory(anchorFactory.address);

                expect(await converterFactory.anchorFactories.call(await anchorFactory.converterType.call())).to.eql(
                    anchorFactory.address
                );

                const factory2 = await Factories[contractName].new();
                expect(await factory.converterType.call()).to.be.bignumber.equal(await factory2.converterType.call());

                await expectRevert(
                    converterFactory.unregisterTypedConverterAnchorFactory(factory2.address),
                    'ERR_NOT_REGISTERED'
                );

                expect(await converterFactory.anchorFactories.call(await anchorFactory.converterType.call())).to.eql(
                    anchorFactory.address
                );
            });

            it('should revert if a non-owner attempts to unregister a registered typed converter anchor factory', async () => {
                await converterFactory.registerTypedConverterAnchorFactory(anchorFactory.address);

                expect(await converterFactory.anchorFactories.call(await anchorFactory.converterType.call())).to.eql(
                    anchorFactory.address
                );

                await expectRevert(
                    converterFactory.unregisterTypedConverterAnchorFactory(anchorFactory.address, { from: nonOwner }),
                    'ERR_ACCESS_DENIED'
                );

                expect(await converterFactory.anchorFactories.call(await anchorFactory.converterType.call())).to.eql(
                    anchorFactory.address
                );
            });

            it('should allow the owner to unregister a registered typed converter factory', async () => {
                await converterFactory.registerTypedConverterFactory(factory.address);

                expect(await converterFactory.converterFactories.call(await factory.converterType.call())).to.eql(
                    factory.address
                );

                await converterFactory.unregisterTypedConverterFactory(factory.address);

                expect(await converterFactory.converterFactories.call(await factory.converterType.call())).to.eql(
                    constants.ZERO_ADDRESS
                );
            });

            it('should revert if the owner attempts to unregister an unregistered typed converter factory', async () => {
                await converterFactory.registerTypedConverterFactory(factory.address);

                expect(await converterFactory.converterFactories.call(await factory.converterType.call())).to.eql(
                    factory.address
                );

                const factory2 = await Factories[contractName].new();
                expect(await factory.converterType.call()).to.be.bignumber.equal(await factory2.converterType.call());

                await expectRevert(
                    converterFactory.unregisterTypedConverterFactory(factory2.address),
                    'ERR_NOT_REGISTERED'
                );

                expect(await converterFactory.converterFactories.call(await factory.converterType.call())).to.eql(
                    factory.address
                );
            });

            it('should revert if a non-owner attempts to unregister a registered typed converter factory', async () => {
                await converterFactory.registerTypedConverterFactory(factory.address);

                expect(await converterFactory.converterFactories.call(await factory.converterType.call())).to.eql(
                    factory.address
                );

                await expectRevert(
                    converterFactory.unregisterTypedConverterFactory(factory.address, { from: nonOwner }),
                    'ERR_ACCESS_DENIED'
                );

                expect(await converterFactory.converterFactories.call(await factory.converterType.call())).to.eql(
                    factory.address
                );
            });

            it('should allow the owner to unregister a registered typed converter custom factory', async () => {
                await converterFactory.registerTypedConverterCustomFactory(customFactory.address);

                expect(await converterFactory.customFactories.call(await customFactory.converterType.call())).to.eql(
                    customFactory.address
                );

                await converterFactory.unregisterTypedConverterCustomFactory(customFactory.address);

                expect(await converterFactory.customFactories.call(await customFactory.converterType.call())).to.eql(
                    constants.ZERO_ADDRESS
                );
            });

            it('should revert if the owner attempts to unregister an unregistered typed converter custom factory', async () => {
                await converterFactory.registerTypedConverterCustomFactory(customFactory.address);

                expect(await converterFactory.customFactories.call(await customFactory.converterType.call())).to.eql(
                    customFactory.address
                );

                const factory2 = await Factories[contractName].new();
                expect(await factory.converterType.call()).to.be.bignumber.equal(await factory2.converterType.call());

                await expectRevert(
                    converterFactory.unregisterTypedConverterCustomFactory(factory2.address),
                    'ERR_NOT_REGISTERED'
                );

                expect(await converterFactory.customFactories.call(await customFactory.converterType.call())).to.eql(
                    customFactory.address
                );
            });

            it('should revert if a non-owner attempts to unregister a registered typed converter custom factory', async () => {
                await converterFactory.registerTypedConverterCustomFactory(customFactory.address);

                expect(await converterFactory.customFactories.call(await customFactory.converterType.call())).to.eql(
                    customFactory.address
                );

                await expectRevert(
                    converterFactory.unregisterTypedConverterCustomFactory(customFactory.address, { from: nonOwner }),
                    'ERR_ACCESS_DENIED'
                );

                expect(await converterFactory.customFactories.call(await customFactory.converterType.call())).to.eql(
                    customFactory.address
                );
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

                const res = await converterFactory.createConverter(
                    converterType,
                    anchor.address,
                    contractRegistry.address,
                    MAX_CONVERSION_FEE
                );
                const converterAddress = await converterFactory.createdConverter.call();
                const converter = await ConverterBase.at(converterAddress);

                expect(await converter.anchor.call()).to.be.eql(anchor.address);
                expect(await converter.registry.call()).to.be.eql(contractRegistry.address);
                expect(await converter.maxConversionFee.call()).to.be.bignumber.equal(MAX_CONVERSION_FEE);
                expect(await converter.owner.call()).to.be.eql(converterFactory.address);
                expect(await converter.newOwner.call()).to.be.eql(owner);

                expectEvent(res, 'NewConverter', {
                    _type: converterType,
                    _converter: converter.address,
                    _owner: owner
                });
            });
        });
    }
});
