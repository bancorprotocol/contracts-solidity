const { expect } = require('chai');
const { ethers } = require('hardhat');
const { BigNumber } = require('ethers');

const { registry } = require('../helpers/Constants');

const Contracts = require('../../components/Contracts').default;

let contractRegistry;
let converterRegistry;

let accounts;
let owner;
let nonOwner;
let address1;
let address2;
let keyAccounts;
let valAccounts;

describe('ConverterRegistryData', () => {
    before(async () => {
        accounts = await ethers.getSigners();

        owner = accounts[0];
        nonOwner = accounts[9];
        address1 = accounts[1];
        address2 = accounts[2];
        keyAccounts = accounts.slice(0, 4);
        valAccounts = accounts.slice(4, 8);
    });

    beforeEach(async () => {
        contractRegistry = await Contracts.ContractRegistry.deploy();
        converterRegistry = await Contracts.ConverterRegistryData.deploy(contractRegistry.address);

        // Allow the owner to manipulate the contract registry data.
        await contractRegistry.registerAddress(registry.CONVERTER_REGISTRY, owner.address);
    });

    describe('security assertions', () => {
        it('should revert when a non owner attempts to add an anchor', async () => {
            await expect(converterRegistry.connect(nonOwner).addSmartToken(address1.address)).to.be.revertedWith(
                'ERR_ACCESS_DENIED'
            );
        });

        it('should revert when a non owner attempts to remove an anchor', async () => {
            await converterRegistry.addSmartToken(address1.address);
            await expect(converterRegistry.connect(nonOwner).removeSmartToken(address1.address)).to.be.revertedWith(
                'ERR_ACCESS_DENIED'
            );
        });

        it('should revert when a non owner attempts to add a liquidity pool', async () => {
            await expect(converterRegistry.connect(nonOwner).addLiquidityPool(address1.address)).to.be.revertedWith(
                'ERR_ACCESS_DENIED'
            );
        });

        it('should revert when a non owner attempts to remove a liquidity pool', async () => {
            await converterRegistry.addLiquidityPool(address1.address);
            await expect(converterRegistry.connect(nonOwner).removeLiquidityPool(address1.address)).to.be.revertedWith(
                'ERR_ACCESS_DENIED'
            );
        });

        it('should revert when a non owner attempts to add a convertible token', async () => {
            await expect(
                converterRegistry.connect(nonOwner).addConvertibleToken(address1.address, address1.address)
            ).to.be.revertedWith('ERR_ACCESS_DENIED');
        });

        it('should revert when a non owner attempts to remove a convertible token', async () => {
            await converterRegistry.addConvertibleToken(address1.address, address1.address);
            await expect(
                converterRegistry.connect(nonOwner).removeConvertibleToken(address1.address, address2.address)
            ).to.be.revertedWith('ERR_ACCESS_DENIED');
        });
    });

    describe('anchors basic verification', () => {
        it('should add an anchor if it does not exists', async () => {
            expect(await converterRegistry.isSmartToken(address1.address)).to.be.false;
            expect(await converterRegistry.getSmartTokens()).not.to.include(address1.address);
            expect(await converterRegistry.getSmartTokenCount()).to.equal(BigNumber.from(0));

            await converterRegistry.addSmartToken(address1.address);

            expect(await converterRegistry.isSmartToken(address1.address)).to.be.true;
            expect(await converterRegistry.getSmartTokens()).to.include(address1.address);
            expect(await converterRegistry.getSmartToken(0)).to.equal(address1.address);
            expect(await converterRegistry.getSmartTokenCount()).to.equal(BigNumber.from(1));
        });

        it('should revert if adding an anchor that already exists', async () => {
            await converterRegistry.addSmartToken(address1.address);
            await expect(converterRegistry.addSmartToken(address1.address)).to.be.revertedWith('ERR_INVALID_ITEM');
        });

        it('should remove an anchor', async () => {
            await converterRegistry.addSmartToken(address1.address);

            expect(await converterRegistry.isSmartToken(address1.address)).to.be.true;
            expect(await converterRegistry.getSmartTokens()).to.include(address1.address);
            expect(await converterRegistry.getSmartToken(0)).to.equal(address1.address);
            expect(await converterRegistry.getSmartTokenCount()).to.equal(BigNumber.from(1));

            await converterRegistry.removeSmartToken(address1.address);

            expect(await converterRegistry.isSmartToken(address1.address)).to.be.false;
            expect(await converterRegistry.getSmartTokens()).not.to.include(address1.address);
            expect(await converterRegistry.getSmartTokenCount()).to.equal(BigNumber.from(0));
        });

        it("should revert if removing n anchor that doesn't not exist", async () => {
            await expect(converterRegistry.removeSmartToken(address1.address)).to.be.revertedWith('ERR_INVALID_ITEM');
        });
    });

    describe('liquidity pools basic verification', () => {
        it('should add a liquidity pool if it does not exists', async () => {
            expect(await converterRegistry.isLiquidityPool(address1.address)).to.be.false;
            expect(await converterRegistry.getLiquidityPools()).not.to.include(address1.address);
            expect(await converterRegistry.getLiquidityPoolCount()).to.equal(BigNumber.from(0));

            await converterRegistry.addLiquidityPool(address1.address);

            expect(await converterRegistry.isLiquidityPool(address1.address)).to.be.true;
            expect(await converterRegistry.getLiquidityPools()).to.include(address1.address);
            expect(await converterRegistry.getLiquidityPool(0)).to.equal(address1.address);
            expect(await converterRegistry.getLiquidityPoolCount()).to.equal(BigNumber.from(1));
        });

        it('should revert if adding a liquidity pool that already exists', async () => {
            await converterRegistry.addLiquidityPool(address1.address);
            await expect(converterRegistry.addLiquidityPool(address1.address)).to.be.revertedWith('ERR_INVALID_ITEM');
        });

        it('should remove a liquidity pool', async () => {
            await converterRegistry.addLiquidityPool(address1.address);
            expect(await converterRegistry.isLiquidityPool(address1.address)).to.be.true;
            expect(await converterRegistry.getLiquidityPools()).to.include(address1.address);
            expect(await converterRegistry.getLiquidityPool(0)).to.equal(address1.address);
            expect(await converterRegistry.getLiquidityPoolCount()).to.equal(BigNumber.from(1));

            await converterRegistry.removeLiquidityPool(address1.address);
            expect(await converterRegistry.isLiquidityPool(address1.address)).to.be.false;
            expect(await converterRegistry.getLiquidityPools()).not.to.include(address1.address);
            expect(await converterRegistry.getLiquidityPoolCount()).to.equal(BigNumber.from(0));
        });

        it("should revert if removing a liquidity pool that doesn't not exist", async () => {
            await expect(converterRegistry.removeLiquidityPool(address1.address)).to.be.revertedWith(
                'ERR_INVALID_ITEM'
            );
        });
    });

    describe('convertible tokens basic verification', () => {
        it('should add a convertible token if it does not exists', async () => {
            expect(await converterRegistry.isConvertibleToken(address1.address)).to.be.false;
            expect(await converterRegistry.getConvertibleTokens()).not.to.include(address1.address);
            expect(await converterRegistry.getConvertibleTokenCount()).to.equal(BigNumber.from(0));
            expect(await converterRegistry.isConvertibleTokenSmartToken(address1.address, address2.address)).to.be
                .false;

            await converterRegistry.addConvertibleToken(address1.address, address2.address);

            expect(await converterRegistry.isConvertibleToken(address1.address)).to.be.true;
            expect(await converterRegistry.getConvertibleTokens()).to.include(address1.address);
            expect(await converterRegistry.getConvertibleToken(0)).to.equal(address1.address);
            expect(await converterRegistry.getConvertibleTokenCount()).to.equal(BigNumber.from(1));
            expect(await converterRegistry.isConvertibleTokenSmartToken(address1.address, address2.address)).to.be.true;
            expect(await converterRegistry.getConvertibleTokenSmartToken(address1.address, 0)).to.equal(
                address2.address
            );
        });

        it('should revert if adding a convertible token that already exists', async () => {
            await converterRegistry.addConvertibleToken(address1.address, address2.address);
            await expect(converterRegistry.addConvertibleToken(address1.address, address2.address)).to.be.revertedWith(
                'ERR_INVALID_ITEM'
            );
        });

        it('should remove a convertible token', async () => {
            await converterRegistry.addConvertibleToken(address1.address, address2.address);
            expect(await converterRegistry.isConvertibleToken(address1.address)).to.be.true;
            expect(await converterRegistry.getConvertibleTokens()).to.include(address1.address);
            expect(await converterRegistry.getConvertibleToken(0)).to.equal(address1.address);
            expect(await converterRegistry.getConvertibleTokenCount()).to.equal(BigNumber.from(1));
            expect(await converterRegistry.isConvertibleTokenSmartToken(address1.address, address2.address)).to.be.true;
            expect(await converterRegistry.getConvertibleTokenSmartToken(address1.address, 0)).to.equal(
                address2.address
            );

            await converterRegistry.removeConvertibleToken(address1.address, address2.address);
            expect(await converterRegistry.isConvertibleToken(address1.address)).to.be.false;
            expect(await converterRegistry.getConvertibleTokens()).not.to.include(address1.address);
            expect(await converterRegistry.getConvertibleTokenCount()).to.equal(BigNumber.from(0));
            expect(await converterRegistry.isConvertibleTokenSmartToken(address1.address, address2.address)).to.be
                .false;
        });

        it("should revert if removing a convertible token that doesn't not exist", async () => {
            await expect(
                converterRegistry.removeConvertibleToken(address1.address, address2.address)
            ).to.be.revertedWith('ERR_INVALID_ITEM');
        });
    });

    describe('anchors advanced verification', () => {
        const removeAllOneByOne = async (direction) => {
            for (const account of accounts) {
                await converterRegistry.addSmartToken(account.address);
            }

            for (let items = accounts.slice(); items.length > 0; items.length--) {
                const bgnIndex = ((items.length - 1) * (1 - direction)) / 2;
                const endIndex = ((items.length - 1) * (1 + direction)) / 2;
                const item = await converterRegistry.getSmartToken(bgnIndex);
                await converterRegistry.removeSmartToken(item);
                expect(item).to.equal(items[bgnIndex].address);

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
                await converterRegistry.addLiquidityPool(account.address);
            }

            for (let items = accounts.slice(); items.length > 0; items.length--) {
                const bgnIndex = ((items.length - 1) * (1 - direction)) / 2;
                const endIndex = ((items.length - 1) * (1 + direction)) / 2;
                const item = await converterRegistry.getLiquidityPool(bgnIndex);
                await converterRegistry.removeLiquidityPool(item);
                expect(item).to.equal(items[bgnIndex].address);

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
        const test = async (convertibleToken, anchor, func, currentState) => {
            await func(convertibleToken, anchor, currentState);
            const convertibleTokens = await converterRegistry.getConvertibleTokens();
            const anchors = await Promise.all(
                convertibleTokens.map((convertibleToken) =>
                    converterRegistry.getConvertibleTokenSmartTokens(convertibleToken)
                )
            );

            expect({ convertibleTokens, anchors }).to.deep.equal(currentState);
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
                                await test(convertibleToken.address, anchor.address, add, currentState);
                            }

                            for (const [convertibleToken, anchor] of removeTuples(reverseKeys, reverseVals)) {
                                await test(convertibleToken.address, anchor.address, remove, currentState);
                            }
                        }
                    }
                }
            }
        });
    });
});
