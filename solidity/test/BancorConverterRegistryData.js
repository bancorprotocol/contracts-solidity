contract("BancorConverterRegistryData", function(accounts) {
    let registry;

    const utils = require("./helpers/Utils");

    const keyAccounts = accounts.slice(0, 4);
    const valAccounts = accounts.slice(4, 8);
    const currentState = {convertibleTokenArray: [], smartTokenTable: []};

    before(async function() {
        registry = await artifacts.require("BancorConverterRegistryData").new();
    });

    describe("liquidity pools basic verification:", function() {
        it("function addLiquidityPool should complete successfully if pool does not exists", async function() {
            await test(accounts[0], registry.addLiquidityPool, "LiquidityPoolAdded");
        });

        it("function addLiquidityPool should abort with an error if pool already exists", async function() {
            await utils.catchRevert(registry.addLiquidityPool(accounts[0]));
        });

        it("function removeLiquidityPool should complete successfully if pool already exists", async function() {
            await test(accounts[0], registry.removeLiquidityPool, "LiquidityPoolRemoved");
        });

        it("function removeLiquidityPool should abort with an error if pool does not exist", async function() {
            await utils.catchRevert(registry.removeLiquidityPool(accounts[0]));
        });

        async function test(liquidityPool, func, eventName) {
            const response = await func(liquidityPool);
            const log      = response.logs[0];
            const expected = eventName + "(" +           liquidityPool + ")";
            const actual   = log.event + "(" + log.args._liquidityPool + ")";
            assert.equal(actual, expected);
        }
    });

    describe("convertible tokens basic verification:", function() {
        it("function addConvertibleToken should complete successfully if token does not exists", async function() {
            await test(keyAccounts[0], valAccounts[0], registry.addConvertibleToken, "ConvertibleTokenAdded");
        });

        it("function addConvertibleToken should abort with an error if token already exists", async function() {
            await utils.catchRevert(registry.addConvertibleToken(keyAccounts[0], valAccounts[0]));
        });

        it("function removeConvertibleToken should complete successfully if token already exists", async function() {
            await test(keyAccounts[0], valAccounts[0], registry.removeConvertibleToken, "ConvertibleTokenRemoved");
        });

        it("function removeConvertibleToken should abort with an error if token does not exist", async function() {
            await utils.catchRevert(registry.removeConvertibleToken(keyAccounts[0], valAccounts[0]));
        });

        async function test(convertibleToken, smartToken, func, eventName) {
            const response = await func(convertibleToken, smartToken);
            const log      = response.logs[0];
            const expected = eventName + "(" +           convertibleToken + "," +           smartToken + ")";
            const actual   = log.event + "(" + log.args._convertibleToken + "," + log.args._smartToken + ")";
            assert.equal(actual, expected);
        }
    });

    describe("liquidity pools advanced verification:", function() {
        it('remove first pool until all pools removed', async function() {
            await removeAllOneByOne(+1);
        });

        it('remove last pool until all pools removed', async function() {
            await removeAllOneByOne(-1);
        });

        async function removeAllOneByOne(direction) {
            console.log(`adding ${accounts.length} pools...`);
            for (const account of accounts)
                await registry.addLiquidityPool(account);
            for (let pools = accounts.slice(); pools.length > 0; pools.length--) {
                const bgnIndex = (pools.length - 1) * (1 - direction) / 2;
                const endIndex = (pools.length - 1) * (1 + direction) / 2;
                const pool = await registry.getLiquidityPool(bgnIndex);
                await registry.removeLiquidityPool(pool);
                assert.equal(pool, pools[bgnIndex]);
                pools[bgnIndex] = pools[endIndex];
                console.log(`pool ${bgnIndex} removed`);
            }
        };
    });

    describe("convertible tokens advanced verification:", function() {
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
            const convertibleTokenArray = await registry.getConvertibleTokenArray();
            const smartTokenTable = await Promise.all(convertibleTokenArray.map(convertibleToken => registry.getSmartTokenArray(convertibleToken)));
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
            return await registry.addConvertibleToken(convertibleToken, smartToken);
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
            return await registry.removeConvertibleToken(convertibleToken, smartToken);
        }

        function swapLast(array, item) {
            array[array.indexOf(item)] = array[array.length - 1];
            array.length -= 1;
        }
    });
});
