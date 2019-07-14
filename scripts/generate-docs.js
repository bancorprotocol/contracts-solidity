const NODE_DIR     = "node_modules";
const INPUT_DIR    = "solidity/contracts";
const CONFIG_DIR   = "solidity/docgen";
const OUTPUT_DIR   = "solidity/docgen/docs";
const SUMMARY_FILE = "solidity/docgen/SUMMARY.md";

// Skip any file or folder whose name is in the list below
const SKIP_LIST = [
    INPUT_DIR + "/bancorx/interfaces",
    INPUT_DIR + "/converter/interfaces",
    INPUT_DIR + "/crowdsale",
    INPUT_DIR + "/helpers",
    INPUT_DIR + "/legacy",
    INPUT_DIR + "/token/interfaces",
    INPUT_DIR + "/utility/interfaces",
    INPUT_DIR + "/ContractIds.sol",
    INPUT_DIR + "/FeatureIds.sol",
    INPUT_DIR + "/IBancorNetwork.sol"
];

const fs        = require("fs");
const basename  = require("path").basename;
const spawnSync = require("child_process").spawnSync;

function scan(pathName, indentation) {
    if (!SKIP_LIST.includes(pathName)) {
        if (fs.lstatSync(pathName).isDirectory()) {
            fs.appendFileSync(SUMMARY_FILE, indentation + "* " + basename(pathName) + "\n");
            for (const fileName of fs.readdirSync(pathName))
                scan(pathName + "/" + fileName, indentation + "  ");
        }
        else if (pathName.endsWith(".sol")) {
            fs.appendFileSync(SUMMARY_FILE, indentation + "* [" + basename(pathName).slice(0, -4) + "](" + OUTPUT_DIR + pathName.slice(INPUT_DIR.length, -4) + ".md)\n");
        }
    }
}

fs.writeFileSync(SUMMARY_FILE, "# Summary\n");

scan(INPUT_DIR, "");

const args = [
    NODE_DIR + "/solidity-docgen/dist/cli.js",
    "--input="       + INPUT_DIR,
    "--output="      + OUTPUT_DIR,
    "--templates="   + CONFIG_DIR,
    "--solc-module=" + NODE_DIR + "/truffle/node_modules/solc",
    "--contract-pages"
];

const result = spawnSync("node", args, {stdio: "inherit"});
if (result.error)
    throw result.error;
