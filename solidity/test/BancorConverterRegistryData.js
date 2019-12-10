const utils = require('./helpers/Utils');
const ContractRegistryClient = require('./helpers/ContractRegistryClient');

contract('BancorConverterRegistryData', function(accounts) {
    let contractRegistry
    let converterRegistry;

    const keyAccounts = accounts.slice(0, 4);
    const valAccounts = accounts.slice(4, 8);
    const currentState = {convertibleTokens: [], smartTokens: []};

    before(async function() {
        contractRegistry = await artifacts.require('ContractRegistry').new();
        converterRegistry = await artifacts.require('BancorConverterRegistryData').new(contractRegistry.address);
        await contractRegistry.registerAddress(ContractRegistryClient.BANCOR_CONVERTER_REGISTRY, accounts[0]);
    });

    describe('security assertion:', function() {
        it('function addSmartToken should abort with an error if called without permission', async function() {
            await utils.catchRevert(converterRegistry.addSmartToken(accounts[0], {from: accounts[1]}));
        });

        it('function removeSmartToken should abort with an error if called without permission', async function() {
            await utils.catchRevert(converterRegistry.removeSmartToken(accounts[0], {from: accounts[1]}));
        });

        it('function addLiquidityPool should abort with an error if called without permission', async function() {
            await utils.catchRevert(converterRegistry.addLiquidityPool(accounts[0], {from: accounts[1]}));
        });

        it('function removeLiquidityPool should abort with an error if called without permission', async function() {
            await utils.catchRevert(converterRegistry.removeLiquidityPool(accounts[0], {from: accounts[1]}));
        });

        it('function addConvertibleToken should abort with an error if called without permission', async function() {
            await utils.catchRevert(converterRegistry.addConvertibleToken(accounts[0], accounts[0], {from: accounts[1]}));
        });

        it('function removeConvertibleToken should abort with an error if called without permission', async function() {
            await utils.catchRevert(converterRegistry.removeConvertibleToken(accounts[0], accounts[0], {from: accounts[1]}));
        });
    });

    describe('smart tokens basic verification:', function() {
        it('function addSmartToken should complete successfully if item does not exists', async function() {
            await converterRegistry.addSmartToken(accounts[0]);
        });

        it('function addSmartToken should abort with an error if item already exists', async function() {
            await utils.catchRevert(converterRegistry.addSmartToken(accounts[0]));
        });

        it('function removeSmartToken should complete successfully if item already exists', async function() {
            await converterRegistry.removeSmartToken(accounts[0]);
        });

        it('function removeSmartToken should abort with an error if item does not exist', async function() {
            await utils.catchRevert(converterRegistry.removeSmartToken(accounts[0]));
        });
    });

    describe('liquidity pools basic verification:', function() {
        it('function addLiquidityPool should complete successfully if item does not exists', async function() {
            await converterRegistry.addLiquidityPool(accounts[0]);
        });

        it('function addLiquidityPool should abort with an error if item already exists', async function() {
            await utils.catchRevert(converterRegistry.addLiquidityPool(accounts[0]));
        });

        it('function removeLiquidityPool should complete successfully if item already exists', async function() {
            await converterRegistry.removeLiquidityPool(accounts[0]);
        });

        it('function removeLiquidityPool should abort with an error if item does not exist', async function() {
            await utils.catchRevert(converterRegistry.removeLiquidityPool(accounts[0]));
        });
    });

    describe('convertible tokens basic verification:', function() {
        it('function addConvertibleToken should complete successfully if item does not exists', async function() {
            await converterRegistry.addConvertibleToken(keyAccounts[0], valAccounts[0]);
        });

        it('function addConvertibleToken should abort with an error if item already exists', async function() {
            await utils.catchRevert(converterRegistry.addConvertibleToken(keyAccounts[0], valAccounts[0]));
        });

        it('function removeConvertibleToken should complete successfully if item already exists', async function() {
            await converterRegistry.removeConvertibleToken(keyAccounts[0], valAccounts[0]);
        });

        it('function removeConvertibleToken should abort with an error if item does not exist', async function() {
            await utils.catchRevert(converterRegistry.removeConvertibleToken(keyAccounts[0], valAccounts[0]));
        });
    });

    describe('smart tokens advanced verification:', function() {
        it('remove first item until all items removed', async function() {
            await removeAllOneByOne(+1);
        });

        it('remove last item until all items removed', async function() {
            await removeAllOneByOne(-1);
        });

        async function removeAllOneByOne(direction) {
            console.log(`adding ${accounts.length} items...`);
            for (const account of accounts)
                await converterRegistry.addSmartToken(account);
            for (let items = accounts.slice(); items.length > 0; items.length--) {
                const bgnIndex = (items.length - 1) * (1 - direction) / 2;
                const endIndex = (items.length - 1) * (1 + direction) / 2;
                const item = await converterRegistry.getSmartToken(bgnIndex);
                await converterRegistry.removeSmartToken(item);
                assert.equal(item, items[bgnIndex]);
                items[bgnIndex] = items[endIndex];
                console.log(`item ${bgnIndex} removed`);
            }
        };
    });

    describe('liquidity pools advanced verification:', function() {
        it('remove first item until all items removed', async function() {
            await removeAllOneByOne(+1);
        });

        it('remove last item until all items removed', async function() {
            await removeAllOneByOne(-1);
        });

        async function removeAllOneByOne(direction) {
            console.log(`adding ${accounts.length} items...`);
            for (const account of accounts)
                await converterRegistry.addLiquidityPool(account);
            for (let items = accounts.slice(); items.length > 0; items.length--) {
                const bgnIndex = (items.length - 1) * (1 - direction) / 2;
                const endIndex = (items.length - 1) * (1 + direction) / 2;
                const item = await converterRegistry.getLiquidityPool(bgnIndex);
                await converterRegistry.removeLiquidityPool(item);
                assert.equal(item, items[bgnIndex]);
                items[bgnIndex] = items[endIndex];
                console.log(`item ${bgnIndex} removed`);
            }
        };
    });

    describe('convertible tokens advanced verification:', function() {
        for (const reverseKeys of [false, true]) {
            for (const reverseVals of [false, true]) {
                for (const addTuples of [rows, cols]) {
                    for (const removeTuples of [rows, cols]) {
                        for (const [convertibleToken, smartToken] of addTuples(false, false)) {
                            it(title(convertibleToken, smartToken, add), async function() {
                                await test(convertibleToken, smartToken, add);
                            });
                        }
                        for (const [convertibleToken, smartToken] of removeTuples(reverseKeys, reverseVals)) {
                            it(title(convertibleToken, smartToken, remove), async function() {
                                await test(convertibleToken, smartToken, remove);
                            });
                        }
                    }
                }
            }
        }

        function reorder(tokens, reverse) {return reverse ? tokens.slice().reverse() : tokens;}
        function stringify(state) {return accounts.reduce((result, account, index) => result.split(account).join(`${index}`), JSON.stringify(state));}
        function title(convertibleToken, smartToken, func) {return `${func.name}(${accounts.indexOf(convertibleToken)} --> ${accounts.indexOf(smartToken)})`;}
        function rows(reverseKeys, reverseVals) {return [].concat.apply([], reorder(keyAccounts, reverseKeys).map(x => reorder(valAccounts, reverseVals).map(y => [x, y])));}
        function cols(reverseKeys, reverseVals) {return [].concat.apply([], reorder(valAccounts, reverseVals).map(x => reorder(keyAccounts, reverseKeys).map(y => [y, x])));}

        async function test(convertibleToken, smartToken, func) {
            const response = await func(convertibleToken, smartToken);
            const convertibleTokens = await converterRegistry.getConvertibleTokens();
            const smartTokens = await Promise.all(convertibleTokens.map(convertibleToken => converterRegistry.getConvertibleTokenSmartTokens(convertibleToken)));
            assert.equal(stringify({convertibleTokens: convertibleTokens, smartTokens: smartTokens}), stringify(currentState));
        }

        async function add(convertibleToken, smartToken) {
            const index = currentState.convertibleTokens.indexOf(convertibleToken);
            if (index == -1) {
                currentState.convertibleTokens.push(convertibleToken);
                currentState.smartTokens.push([smartToken]);
            }
            else {
                currentState.smartTokens[index].push(smartToken);
            }
            return await converterRegistry.addConvertibleToken(convertibleToken, smartToken);
        }

        async function remove(convertibleToken, smartToken) {
            const index = currentState.convertibleTokens.indexOf(convertibleToken);
            if (currentState.smartTokens[index].length == 1) {
                currentState.smartTokens.splice(index, 1);
                swapLast(currentState.convertibleTokens, convertibleToken);
            }
            else {
                swapLast(currentState.smartTokens[index], smartToken);
            }
            return await converterRegistry.removeConvertibleToken(convertibleToken, smartToken);
        }

        function swapLast(array, item) {
            array[array.indexOf(item)] = array[array.length - 1];
            array.length -= 1;
        }
    });
});
