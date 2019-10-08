const fs     = require("fs");
const Web3   = require("web3");
const assert = require("assert");
const Finder = require(__dirname + "/../test/helpers/PathFinderWeb3v1.js");

const NODE_ADDRESS  = process.argv[2];
const PATH_FINDER   = process.argv[3];
const REGISTRY_LIST = process.argv.slice(4);

const FINDER_ABI   = JSON.parse(fs.readFileSync(__dirname + "/../build/BancorNetworkPathFinder.abi"));
const REGISTRY_ABI = JSON.parse(fs.readFileSync(__dirname + "/../build/BancorConverterRegistry.abi"));

async function run() {
    const web3 = new Web3(NODE_ADDRESS);
    const finder = new web3.eth.Contract(FINDER_ABI, PATH_FINDER);
    const anchorToken = await rpc(finder.methods.anchorToken().call());
    const registries = REGISTRY_LIST.map(x => new web3.eth.Contract(REGISTRY_ABI, x));
    for (const registry of registries) {
        const tokenCount = await rpc(registry.methods.tokenCount().call());
        for (let i = 0; i < tokenCount; i++) {
            const sourceToken = await rpc(registry.methods.tokens(i).call());
            for (let j = i + 1; j < tokenCount; j++) {
                const targetToken = await rpc(registry.methods.tokens(j).call());
                const expected = await Finder.get(web3, sourceToken, targetToken, anchorToken, REGISTRY_LIST);
                const actual = await rpc(finder.methods.get(sourceToken, targetToken, REGISTRY_LIST).call());
                assert.equal(actual.join(', ').toLowerCase(), expected.join(', ').toLowerCase());
                console.log(`path from ${i} to ${j} (out of ${tokenCount}): ${actual}`);
            }
        }
    }
}

async function rpc(func) {
    while (true) {
        try {
            return await func;
        }
        catch (error) {
            if (!error.message.startsWith("Invalid JSON RPC response"))
                return null;
        }
    }
}

run();