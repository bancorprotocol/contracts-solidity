const { expect } = require('chai');
const { expectRevert } = require('@openzeppelin/test-helpers');

const { registry } = require('./helpers/Constants');
const ContractRegistry = artifacts.require('ContractRegistry');
const ConverterRegistryData = artifacts.require('ConverterRegistryData');

contract('ConverterRegistryData', accounts => {
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
        it('should revert when a non owner attempts to add a smart token', async () => {
            await expectRevert(converterRegistry.addSmartToken(address1, { from: nonOwner }), 'ERR_ACCESS_DENIED');
        });

        it('should revert when a non owner attempts to remove a smart token', async () => {
            await converterRegistry.addSmartToken(address1);
            await expectRevert(converterRegistry.removeSmartToken(address1, { from: nonOwner }), 'ERR_ACCESS_DENIED');
        });

        it('should revert when a non owner attempts to add a liquidity pool', async () => {
            await expectRevert(converterRegistry.addLiquidityPool(address1, { from: nonOwner }), 'ERR_ACCESS_DENIED');
        });

        it('should revert when a non owner attempts to remove a liquidity pool', async () => {
            await converterRegistry.addLiquidityPool(address1);
            await expectRevert(converterRegistry.removeLiquidityPool(address1, { from: nonOwner }), 'ERR_ACCESS_DENIED');
        });

        it('should revert when a non owner attempts to add a convertible token', async () => {
            await expectRevert(converterRegistry.addConvertibleToken(address1, address1, { from: nonOwner }), 'ERR_ACCESS_DENIED');
        });

        it('should revert when a non owner attempts to remove a convertible token', async () => {
            await converterRegistry.addConvertibleToken(address1, address1);
            await expectRevert(converterRegistry.removeConvertibleToken(address1, address2, { from: nonOwner }), 'ERR_ACCESS_DENIED');
        });
    });

    describe('smart tokens basic verification', () => {
        it('should add a smart token if it does not exists', async () => {
            await converterRegistry.addSmartToken(address1);
            expect(await converterRegistry.isSmartToken(address1)).to.be.true();
        });

        it('should revert if adding a smart token that already exists', async () => {
            await converterRegistry.addSmartToken(address1);
            await expectRevert(converterRegistry.addSmartToken(address1), 'ERR_INVALID_ITEM');
        });

        it('should remove a smart token', async () => {
            await converterRegistry.addSmartToken(address1);
            await converterRegistry.removeSmartToken(address1);
            expect(await converterRegistry.isSmartToken(address1)).to.be.false();
        });

        it("should revert if removing a smart token that doesn't not exist", async () => {
            await expectRevert(converterRegistry.removeSmartToken(address1), 'ERR_INVALID_ITEM');
        });
    });

    describe('liquidity pools basic verification', () => {
        it('should add a liquidity pool if it does not exists', async () => {
            await converterRegistry.addLiquidityPool(address1);
            expect(await converterRegistry.isLiquidityPool(address1)).to.be.true();
        });

        it('should revert if adding a liquidity pool that already exists', async () => {
            await converterRegistry.addLiquidityPool(address1);
            await expectRevert(converterRegistry.addLiquidityPool(address1), 'ERR_INVALID_ITEM');
        });

        it('should remove a liquidity pool', async () => {
            await converterRegistry.addLiquidityPool(address1);
            await converterRegistry.removeLiquidityPool(address1);
            expect(await converterRegistry.isLiquidityPool(address1)).to.be.false();
        });

        it("should revert if removing a liquidity pool that doesn't not exist", async () => {
            await expectRevert(converterRegistry.removeLiquidityPool(address1), 'ERR_INVALID_ITEM');
        });
    });

    describe('convertible tokens basic verification', () => {
        it('should add a convertible token if it does not exists', async () => {
            await converterRegistry.addConvertibleToken(address1, address2);
            expect(await converterRegistry.isConvertibleToken(address1)).to.be.true();
        });

        it('should revert if adding a convertible token that already exists', async () => {
            await converterRegistry.addConvertibleToken(address1, address2);
            await expectRevert(converterRegistry.addConvertibleToken(address1, address2), 'ERR_INVALID_ITEM');
        });

        it('should remove a convertible token', async () => {
            await converterRegistry.addConvertibleToken(address1, address2);
            await converterRegistry.removeConvertibleToken(address1, address2);
            expect(await converterRegistry.isConvertibleToken(address1)).to.be.false();
        });

        it("should revert if removing a convertible token that doesn't not exist", async () => {
            await expectRevert(converterRegistry.removeConvertibleToken(address1, address2), 'ERR_INVALID_ITEM');
        });
    });

    describe('smart tokens advanced verification', () => {
        const removeAllOneByOne = async (direction) => {
            for (const account of accounts) {
                await converterRegistry.addSmartToken(account);
            }

            for (let items = accounts.slice(); items.length > 0; items.length--) {
                const bgnIndex = (items.length - 1) * (1 - direction) / 2;
                const endIndex = (items.length - 1) * (1 + direction) / 2;
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
                const bgnIndex = (items.length - 1) * (1 - direction) / 2;
                const endIndex = (items.length - 1) * (1 + direction) / 2;
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

        const test = async (convertibleToken, smartToken, func, currentState) => {
            await func(convertibleToken, smartToken, currentState);
            const convertibleTokens = await converterRegistry.getConvertibleTokens();
            const smartTokens = await Promise.all(convertibleTokens.map(convertibleToken =>
                converterRegistry.getConvertibleTokenSmartTokens(convertibleToken)));
            expect({ convertibleTokens, smartTokens }).to.deep.eql(currentState);
        };

        const add = async (convertibleToken, smartToken, currentState) => {
            const index = currentState.convertibleTokens.indexOf(convertibleToken);
            if (index === -1) {
                currentState.convertibleTokens.push(convertibleToken);
                currentState.smartTokens.push([smartToken]);
            } else {
                currentState.smartTokens[index].push(smartToken);
            }

            return converterRegistry.addConvertibleToken(convertibleToken, smartToken);
        };

        const swapLast = (array, item) => {
            array[array.indexOf(item)] = array[array.length - 1];
            array.length -= 1;
        };

        const remove = async (convertibleToken, smartToken, currentState) => {
            const index = currentState.convertibleTokens.indexOf(convertibleToken);
            if (currentState.smartTokens[index].length === 1) {
                currentState.smartTokens.splice(index, 1);
                swapLast(currentState.convertibleTokens, convertibleToken);
            } else {
                swapLast(currentState.smartTokens[index], smartToken);
            }

            return converterRegistry.removeConvertibleToken(convertibleToken, smartToken);
        };

        const reorder = (tokens, reverse) => {
            return reverse ? tokens.slice().reverse() : tokens;
        };

        const rows = (reverseKeys, reverseVals) => {
            return [].concat.apply([], reorder(keyAccounts, reverseKeys).map(x => reorder(valAccounts, reverseVals).map(y => [x, y])));
        };

        const cols = (reverseKeys, reverseVals) => {
            return [].concat.apply([], reorder(valAccounts, reverseVals).map(x => reorder(keyAccounts, reverseKeys).map(y => [y, x])));
        };

        it('should add and remove data', async () => {
            const currentState = { convertibleTokens: [], smartTokens: [] };

            for (const reverseKeys of [false, true]) {
                for (const reverseVals of [false, true]) {
                    for (const addTuples of [rows, cols]) {
                        for (const removeTuples of [rows, cols]) {
                            for (const [convertibleToken, smartToken] of addTuples(false, false)) {
                                await test(convertibleToken, smartToken, add, currentState);
                            }

                            for (const [convertibleToken, smartToken] of removeTuples(reverseKeys, reverseVals)) {
                                await test(convertibleToken, smartToken, remove, currentState);
                            }
                        }
                    }
                }
            }
        });
    });
});
