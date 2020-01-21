// See <https://www.npmjs.com/package/solidity-coverage#options>
module.exports = {
    port:           7555,
    norpc:          true,
    testCommand:    "node ../../node_modules/truffle/build/cli.bundled.js test --network=coverage",
    compileCommand: "node ../../node_modules/truffle/build/cli.bundled.js compile --network=coverage",
    skipFiles:      [
        "helpers/Migrations.sol",
        "legacy/BancorGasPriceLimit.sol",
        "legacy/BancorPriceFloor.sol"
    ]
};
