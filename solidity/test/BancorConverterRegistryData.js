const utils = require('./helpers/Utils');
const ContractRegistryClient = require('./helpers/ContractRegistryClient');

contract('BancorConverterRegistryData', function(accounts) {
    let contractRegistry
    let converterRegistry;

    const keyAccounts = accounts.slice(0, 4);
    const valAccounts = accounts.slice(4, 8);
    const currentState = {convertibleTokenArray: [], smartTokenTable: []};

    before(async function() {
        contractRegistry = await artifacts.require('ContractRegistry').new();
        converterRegistry = await artifacts.require('BancorConverterRegistryData').new(contractRegistry.address);
        await contractRegistry.registerAddress(ContractRegistryClient.BANCOR_CONVERTER_REGISTRY_LOGIC, accounts[0]);
    });

    describe('security assertion:', function() {
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

    describe('liquidity pools basic verification:', function() {
        it('function addLiquidityPool should complete successfully if pool does not exists', async function() {
            await converterRegistry.addLiquidityPool(accounts[0]);
        });

        it('function addLiquidityPool should abort with an error if pool already exists', async function() {
            await utils.catchRevert(converterRegistry.addLiquidityPool(accounts[0]));
        });

        it('function removeLiquidityPool should complete successfully if pool already exists', async function() {
            await converterRegistry.removeLiquidityPool(accounts[0]);
        });

        it('function removeLiquidityPool should abort with an error if pool does not exist', async function() {
            await utils.catchRevert(converterRegistry.removeLiquidityPool(accounts[0]));
        });
    });

    describe('convertible tokens basic verification:', function() {
        it('function addConvertibleToken should complete successfully if token does not exists', async function() {
            await converterRegistry.addConvertibleToken(keyAccounts[0], valAccounts[0]);
        });

        it('function addConvertibleToken should abort with an error if token already exists', async function() {
            await utils.catchRevert(converterRegistry.addConvertibleToken(keyAccounts[0], valAccounts[0]));
        });

        it('function removeConvertibleToken should complete successfully if token already exists', async function() {
            await converterRegistry.removeConvertibleToken(keyAccounts[0], valAccounts[0]);
        });

        it('function removeConvertibleToken should abort with an error if token does not exist', async function() {
            await utils.catchRevert(converterRegistry.removeConvertibleToken(keyAccounts[0], valAccounts[0]));
        });
    });

    describe('liquidity pools advanced verification:', function() {
        it('remove first pool until all pools removed', async function() {
            await removeAllOneByOne(+1);
        });

        it('remove last pool until all pools removed', async function() {
            await removeAllOneByOne(-1);
        });

        async function removeAllOneByOne(direction) {
            console.log(`adding ${accounts.length} pools...`);
            for (const account of accounts)
                await converterRegistry.addLiquidityPool(account);
            for (let pools = accounts.slice(); pools.length > 0; pools.length--) {
                const bgnIndex = (pools.length - 1) * (1 - direction) / 2;
                const endIndex = (pools.length - 1) * (1 + direction) / 2;
                const pool = await converterRegistry.getLiquidityPool(bgnIndex);
                await converterRegistry.removeLiquidityPool(pool);
                assert.equal(pool, pools[bgnIndex]);
                pools[bgnIndex] = pools[endIndex];
                console.log(`pool ${bgnIndex} removed`);
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
            const convertibleTokenArray = await converterRegistry.getConvertibleTokenArray();
            const smartTokenTable = await Promise.all(convertibleTokenArray.map(convertibleToken => converterRegistry.getSmartTokenArray(convertibleToken)));
            assert.equal(stringify({convertibleTokenArray: convertibleTokenArray, smartTokenTable: smartTokenTable}), stringify(currentState));
        }

        async function add(convertibleToken, smartToken) {
            const index = currentState.convertibleTokenArray.indexOf(convertibleToken);
            if (index == -1) {
                currentState.convertibleTokenArray.push(convertibleToken);
                currentState.smartTokenTable.push([smartToken]);
            }
            else {
                currentState.smartTokenTable[index].push(smartToken);
            }
            return await converterRegistry.addConvertibleToken(convertibleToken, smartToken);
        }

        async function remove(convertibleToken, smartToken) {
            const index = currentState.convertibleTokenArray.indexOf(convertibleToken);
            if (currentState.smartTokenTable[index].length == 1) {
                currentState.smartTokenTable.splice(index, 1);
                swapLast(currentState.convertibleTokenArray, convertibleToken);
            }
            else {
                swapLast(currentState.smartTokenTable[index], smartToken);
            }
            return await converterRegistry.removeConvertibleToken(convertibleToken, smartToken);
        }

        function swapLast(array, item) {
            array[array.indexOf(item)] = array[array.length - 1];
            array.length -= 1;
        }
    });
});
