const { accounts, contract } = require('@openzeppelin/test-environment');
const { expectRevert, BN } = require('@openzeppelin/test-helpers');
const { expect } = require('../../chai-local');

const { registry } = require('./helpers/Constants');
const ContractRegistry = contract.fromArtifact('ContractRegistry');
const ConverterRegistryData = contract.fromArtifact('ConverterRegistryData');

describe('ConverterRegistryData', () => {
    let contractRegistry;
    let converterRegistry;
    const owner = accounts[0];
    const nonOwner = accounts[9];
    const address1 = accounts[1];
    const address2 = accounts[2];

    beforeEach(async () => {
        contractRegistry = await ContractRegistry.new();
        converterRegistry = await ConverterRegistryData.new(contractRegistry.address);

        // Allow the owner to manipulate the contract registry data.
        await contractRegistry.registerAddress(registry.CONVERTER_REGISTRY, owner);
    });

    describe('security assertions', () => {
        it('should revert when a non owner attempts to add an anchor', async () => {
            await expectRevert(converterRegistry.addSmartToken(address1, { from: nonOwner }), 'ERR_ACCESS_DENIED');
        });

        it('should revert when a non owner attempts to remove an anchor', async () => {
            await converterRegistry.addSmartToken(address1);
            await expectRevert(converterRegistry.removeSmartToken(address1, { from: nonOwner }), 'ERR_ACCESS_DENIED');
        });

        it('should revert when a non owner attempts to add a liquidity pool', async () => {
            await expectRevert(converterRegistry.addLiquidityPool(address1, { from: nonOwner }), 'ERR_ACCESS_DENIED');
        });

        it('should revert when a non owner attempts to remove a liquidity pool', async () => {
            await converterRegistry.addLiquidityPool(address1);
            await expectRevert(
                converterRegistry.removeLiquidityPool(address1, { from: nonOwner }),
                'ERR_ACCESS_DENIED'
            );
        });

        it('should revert when a non owner attempts to add a convertible token', async () => {
            await expectRevert(
                converterRegistry.addConvertibleToken(address1, address1, { from: nonOwner }),
                'ERR_ACCESS_DENIED'
            );
        });

        it('should revert when a non owner attempts to remove a convertible token', async () => {
            await converterRegistry.addConvertibleToken(address1, address1);
            await expectRevert(
                converterRegistry.removeConvertibleToken(address1, address2, { from: nonOwner }),
                'ERR_ACCESS_DENIED'
            );
        });
    });

    describe('anchors basic verification', () => {
        it('should add an anchor if it does not exists', async () => {
            expect(await converterRegistry.isSmartToken.call(address1)).to.be.false();
            expect(await converterRegistry.getSmartTokens.call()).not.to.include(address1);
            expect(await converterRegistry.getSmartTokenCount.call()).to.be.bignumber.equal(new BN(0));

            await converterRegistry.addSmartToken(address1);

            expect(await converterRegistry.isSmartToken.call(address1)).to.be.true();
            expect(await converterRegistry.getSmartTokens.call()).to.include(address1);
            expect(await converterRegistry.getSmartToken.call(0)).to.eql(address1);
            expect(await converterRegistry.getSmartTokenCount.call()).to.be.bignumber.equal(new BN(1));
        });

        it('should revert if adding an anchor that already exists', async () => {
            await converterRegistry.addSmartToken(address1);
            await expectRevert(converterRegistry.addSmartToken(address1), 'ERR_INVALID_ITEM');
        });

        it('should remove an anchor', async () => {
            await converterRegistry.addSmartToken(address1);

            expect(await converterRegistry.isSmartToken.call(address1)).to.be.true();
            expect(await converterRegistry.getSmartTokens.call()).to.include(address1);
            expect(await converterRegistry.getSmartToken.call(0)).to.eql(address1);
            expect(await converterRegistry.getSmartTokenCount.call()).to.be.bignumber.equal(new BN(1));

            await converterRegistry.removeSmartToken(address1);

            expect(await converterRegistry.isSmartToken.call(address1)).to.be.false();
            expect(await converterRegistry.getSmartTokens.call()).not.to.include(address1);
            expect(await converterRegistry.getSmartTokenCount.call()).to.be.bignumber.equal(new BN(0));
        });

        it("should revert if removing n anchor that doesn't not exist", async () => {
            await expectRevert(converterRegistry.removeSmartToken(address1), 'ERR_INVALID_ITEM');
        });
    });

    describe('liquidity pools basic verification', () => {
        it('should add a liquidity pool if it does not exists', async () => {
            expect(await converterRegistry.isLiquidityPool(address1)).to.be.false();
            expect(await converterRegistry.getLiquidityPools.call()).not.to.include(address1);
            expect(await converterRegistry.getLiquidityPoolCount.call()).to.be.bignumber.equal(new BN(0));

            await converterRegistry.addLiquidityPool(address1);

            expect(await converterRegistry.isLiquidityPool(address1)).to.be.true();
            expect(await converterRegistry.getLiquidityPools.call()).to.include(address1);
            expect(await converterRegistry.getLiquidityPool.call(0)).to.eql(address1);
            expect(await converterRegistry.getLiquidityPoolCount.call()).to.be.bignumber.equal(new BN(1));
        });

        it('should revert if adding a liquidity pool that already exists', async () => {
            await converterRegistry.addLiquidityPool(address1);
            await expectRevert(converterRegistry.addLiquidityPool(address1), 'ERR_INVALID_ITEM');
        });

        it('should remove a liquidity pool', async () => {
            await converterRegistry.addLiquidityPool(address1);
            expect(await converterRegistry.isLiquidityPool(address1)).to.be.true();
            expect(await converterRegistry.getLiquidityPools.call()).to.include(address1);
            expect(await converterRegistry.getLiquidityPool.call(0)).to.eql(address1);
            expect(await converterRegistry.getLiquidityPoolCount.call()).to.be.bignumber.equal(new BN(1));

            await converterRegistry.removeLiquidityPool(address1);
            expect(await converterRegistry.isLiquidityPool(address1)).to.be.false();
            expect(await converterRegistry.getLiquidityPools.call()).not.to.include(address1);
            expect(await converterRegistry.getLiquidityPoolCount.call()).to.be.bignumber.equal(new BN(0));
        });

        it("should revert if removing a liquidity pool that doesn't not exist", async () => {
            await expectRevert(converterRegistry.removeLiquidityPool(address1), 'ERR_INVALID_ITEM');
        });
    });

    describe('convertible tokens basic verification', () => {
        it('should add a convertible token if it does not exists', async () => {
            expect(await converterRegistry.isConvertibleToken(address1)).to.be.false();
            expect(await converterRegistry.getConvertibleTokens.call()).not.to.include(address1);
            expect(await converterRegistry.getConvertibleTokenCount.call()).to.be.bignumber.equal(new BN(0));
            expect(await converterRegistry.isConvertibleTokenSmartToken.call(address1, address2)).to.be.false();

            await converterRegistry.addConvertibleToken(address1, address2);

            expect(await converterRegistry.isConvertibleToken(address1)).to.be.true();
            expect(await converterRegistry.getConvertibleTokens.call()).to.include(address1);
            expect(await converterRegistry.getConvertibleToken.call(0)).to.eql(address1);
            expect(await converterRegistry.getConvertibleTokenCount.call()).to.be.bignumber.equal(new BN(1));
            expect(await converterRegistry.isConvertibleTokenSmartToken.call(address1, address2)).to.be.true();
            expect(await converterRegistry.getConvertibleTokenSmartToken.call(address1, 0)).to.be.equal(address2);
        });

        it('should revert if adding a convertible token that already exists', async () => {
            await converterRegistry.addConvertibleToken(address1, address2);
            await expectRevert(converterRegistry.addConvertibleToken(address1, address2), 'ERR_INVALID_ITEM');
        });

        it('should remove a convertible token', async () => {
            await converterRegistry.addConvertibleToken(address1, address2);
            expect(await converterRegistry.isConvertibleToken(address1)).to.be.true();
            expect(await converterRegistry.getConvertibleTokens.call()).to.include(address1);
            expect(await converterRegistry.getConvertibleToken.call(0)).to.eql(address1);
            expect(await converterRegistry.getConvertibleTokenCount.call()).to.be.bignumber.equal(new BN(1));
            expect(await converterRegistry.isConvertibleTokenSmartToken.call(address1, address2)).to.be.true();
            expect(await converterRegistry.getConvertibleTokenSmartToken.call(address1, 0)).to.be.equal(address2);

            await converterRegistry.removeConvertibleToken(address1, address2);
            expect(await converterRegistry.isConvertibleToken(address1)).to.be.false();
            expect(await converterRegistry.getConvertibleTokens.call()).not.to.include(address1);
            expect(await converterRegistry.getConvertibleTokenCount.call()).to.be.bignumber.equal(new BN(0));
            expect(await converterRegistry.isConvertibleTokenSmartToken.call(address1, address2)).to.be.false();
        });

        it("should revert if removing a convertible token that doesn't not exist", async () => {
            await expectRevert(converterRegistry.removeConvertibleToken(address1, address2), 'ERR_INVALID_ITEM');
        });
    });

    describe('anchors advanced verification', () => {
        const removeAllOneByOne = async (direction) => {
            for (const account of accounts) {
                await converterRegistry.addSmartToken(account);
            }

            for (let items = accounts.slice(); items.length > 0; items.length--) {
                const bgnIndex = ((items.length - 1) * (1 - direction)) / 2;
                const endIndex = ((items.length - 1) * (1 + direction)) / 2;
                const item = await converterRegistry.getSmartToken(bgnIndex);
                await converterRegistry.removeSmartToken(item);
                expect(item).to.eql(items[bgnIndex]);

                items[bgnIndex] = items[endIndex];
            }
        };

        it('remove first item until all items removed', async () => {
            await removeAllOneByOne(+1);
        });

        it('remove last item until all items removed', async () => {
            await removeAllOneByOne(-1);
        });
    });

    describe('liquidity pools advanced verification', () => {
        const removeAllOneByOne = async (direction) => {
            for (const account of accounts) {
                await converterRegistry.addLiquidityPool(account);
            }

            for (let items = accounts.slice(); items.length > 0; items.length--) {
                const bgnIndex = ((items.length - 1) * (1 - direction)) / 2;
                const endIndex = ((items.length - 1) * (1 + direction)) / 2;
                const item = await converterRegistry.getLiquidityPool(bgnIndex);
                await converterRegistry.removeLiquidityPool(item);
                expect(item).to.eql(items[bgnIndex]);

                items[bgnIndex] = items[endIndex];
            }
        };

        it('remove first item until all items removed', async () => {
            await removeAllOneByOne(+1);
        });

        it('remove last item until all items removed', async () => {
            await removeAllOneByOne(-1);
        });
    });

    describe('convertible tokens advanced verification', () => {
        const keyAccounts = accounts.slice(0, 4);
        const valAccounts = accounts.slice(4, 8);

        const test = async (convertibleToken, anchor, func, currentState) => {
            await func(convertibleToken, anchor, currentState);
            const convertibleTokens = await converterRegistry.getConvertibleTokens();
            const anchors = await Promise.all(
                convertibleTokens.map((convertibleToken) =>
                    converterRegistry.getConvertibleTokenSmartTokens(convertibleToken)
                )
            );

            expect({ convertibleTokens, anchors }).to.deep.eql(currentState);
        };

        const add = async (convertibleToken, anchor, currentState) => {
            const index = currentState.convertibleTokens.indexOf(convertibleToken);
            if (index === -1) {
                currentState.convertibleTokens.push(convertibleToken);
                currentState.anchors.push([anchor]);
            } else {
                currentState.anchors[index].push(anchor);
            }

            return converterRegistry.addConvertibleToken(convertibleToken, anchor);
        };

        const swapLast = (array, item) => {
            array[array.indexOf(item)] = array[array.length - 1];
            array.length -= 1;
        };

        const remove = async (convertibleToken, anchor, currentState) => {
            const index = currentState.convertibleTokens.indexOf(convertibleToken);
            if (currentState.anchors[index].length === 1) {
                currentState.anchors.splice(index, 1);
                swapLast(currentState.convertibleTokens, convertibleToken);
            } else {
                swapLast(currentState.anchors[index], anchor);
            }

            return converterRegistry.removeConvertibleToken(convertibleToken, anchor);
        };

        const reorder = (tokens, reverse) => {
            return reverse ? tokens.slice().reverse() : tokens;
        };

        const rows = (reverseKeys, reverseVals) => {
            return [].concat.apply(
                [],
                reorder(keyAccounts, reverseKeys).map((x) => reorder(valAccounts, reverseVals).map((y) => [x, y]))
            );
        };

        const cols = (reverseKeys, reverseVals) => {
            return [].concat.apply(
                [],
                reorder(valAccounts, reverseVals).map((x) => reorder(keyAccounts, reverseKeys).map((y) => [y, x]))
            );
        };

        it('should add and remove data', async () => {
            const currentState = { convertibleTokens: [], anchors: [] };

            for (const reverseKeys of [false, true]) {
                for (const reverseVals of [false, true]) {
                    for (const addTuples of [rows, cols]) {
                        for (const removeTuples of [rows, cols]) {
                            for (const [convertibleToken, anchor] of addTuples(false, false)) {
                                await test(convertibleToken, anchor, add, currentState);
                            }

                            for (const [convertibleToken, anchor] of removeTuples(reverseKeys, reverseVals)) {
                                await test(convertibleToken, anchor, remove, currentState);
                            }
                        }
                    }
                }
            }
        });
    });
});
