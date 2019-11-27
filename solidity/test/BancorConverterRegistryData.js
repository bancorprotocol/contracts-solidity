contract("BancorConverterRegistryData", function(accounts) {
    let registry;

    const utils = require("./helpers/Utils");

    const erc20Tokens = accounts.slice(0, 4);
    const smartTokens = accounts.slice(4, 8);
    const currentState = {erc20TokenArray: [], smartTokenTable: []};

    before(async function() {
        registry = await artifacts.require("BancorConverterRegistryData").new();
    });

    describe("basic verification:", function() {
        it("function add should complete successfully if mapping does not exists", async function() {
            await test(erc20Tokens[0], smartTokens[0], registry.add, "Added");
        });

        it("function add should abort with an error if mapping already exists", async function() {
            await utils.catchRevert(registry.add(erc20Tokens[0], smartTokens[0]));
        });

        it("function remove should complete successfully if mapping already exists", async function() {
            await test(erc20Tokens[0], smartTokens[0], registry.remove, "Removed");
        });

        it("function remove should abort with an error if mapping does not exist", async function() {
            await utils.catchRevert(registry.remove(erc20Tokens[0], smartTokens[0]));
        });

        async function test(erc20Token, smartToken, func, eventName) {
            const response = await func(erc20Token, smartToken);
            const log      = response.logs[0];
            const expected = eventName + "(" +           erc20Token + "," +           smartToken + ")";
            const actual   = log.event + "(" + log.args._erc20Token + "," + log.args._smartToken + ")";
            assert.equal(actual, expected);
        }
    });

    describe("advanced verification:", function() {
        for (const reverseKeys of [false, true]) {
            for (const reverseVals of [false, true]) {
                for (const addTuples of [rows, cols]) {
                    for (const removeTuples of [rows, cols]) {
                        for (const [erc20Token, smartToken] of addTuples(false, false)) {
                            it(title(erc20Token, smartToken, add), async function() {
                                await test(erc20Token, smartToken, add);
                            });
                        }
                        for (const [erc20Token, smartToken] of removeTuples(reverseKeys, reverseVals)) {
                            it(title(erc20Token, smartToken, remove), async function() {
                                await test(erc20Token, smartToken, remove);
                            });
                        }
                    }
                }
            }
        }

        function reorder(tokens, reverse) {return reverse ? tokens.slice().reverse() : tokens;}
        function title(erc20Token, smartToken, func) {return `${func.name}(${accounts.indexOf(erc20Token)} --> ${accounts.indexOf(smartToken)})`;}
        function stringify(state) {return accounts.reduce((result, account, index) => result.split(account).join(`${index}`), JSON.stringify(state));}
        function rows(reverseKeys, reverseVals) {return [].concat.apply([], reorder(erc20Tokens, reverseKeys).map(x => reorder(smartTokens, reverseVals).map(y => [x, y])));}
        function cols(reverseKeys, reverseVals) {return [].concat.apply([], reorder(smartTokens, reverseVals).map(x => reorder(erc20Tokens, reverseKeys).map(y => [y, x])));}

        async function test(erc20Token, smartToken, func) {
            const response = await func(erc20Token, smartToken);
            const erc20TokenArray = await registry.getERC20TokenArray();
            const smartTokenTable = await Promise.all(erc20TokenArray.map(erc20Token => registry.getSmartTokenArray(erc20Token)));
            assert.equal(stringify({erc20TokenArray: erc20TokenArray, smartTokenTable: smartTokenTable}), stringify(currentState));
        }

        async function add(erc20Token, smartToken) {
            const index = currentState.erc20TokenArray.indexOf(erc20Token);
            if (index == -1) {
                currentState.erc20TokenArray.push(erc20Token);
                currentState.smartTokenTable.push([smartToken]);
            }
            else {
                currentState.smartTokenTable[index].push(smartToken);
            }
            return await registry.add(erc20Token, smartToken);
        }

        async function remove(erc20Token, smartToken) {
            const index = currentState.erc20TokenArray.indexOf(erc20Token);
            if (currentState.smartTokenTable[index].length == 1) {
                currentState.smartTokenTable.splice(index, 1);
                swapLast(currentState.erc20TokenArray, erc20Token);
            }
            else {
                swapLast(currentState.smartTokenTable[index], smartToken);
            }
            return await registry.remove(erc20Token, smartToken);
        }

        function swapLast(array, item) {
            array[array.indexOf(item)] = array[array.length - 1];
            array.length -= 1;
        }
    });
});
