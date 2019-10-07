const NODE_DIR     = "node_modules";
const INPUT_DIR    = "solidity/contracts";
const CONFIG_DIR   = "solidity/docgen";
const OUTPUT_DIR   = "solidity/docgen/docs";
const SUMMARY_FILE = "solidity/docgen/SUMMARY.md";

// Skip any file or folder whose name is in the list below
const SKIP_LIST = [
    INPUT_DIR + "/bancorx/interfaces",
    INPUT_DIR + "/bancorx/XTransferRerouter.sol",
    INPUT_DIR + "/converter/interfaces",
    INPUT_DIR + "/crowdsale",
    INPUT_DIR + "/helpers",
    INPUT_DIR + "/legacy",
    INPUT_DIR + "/token/interfaces",
    INPUT_DIR + "/utility/interfaces",
    INPUT_DIR + "/ContractIds.sol",
    INPUT_DIR + "/FeatureIds.sol",
    INPUT_DIR + "/IBancorConverterRegistry.sol",
    INPUT_DIR + "/IBancorNetwork.sol",
];

const fs        = require("fs");
const path      = require("path");
const spawnSync = require("child_process").spawnSync;

const relativePath = path.relative(path.dirname(SUMMARY_FILE), OUTPUT_DIR);

function scan(pathName, indentation) {
    if (!SKIP_LIST.includes(pathName)) {
        if (fs.lstatSync(pathName).isDirectory()) {
            fs.appendFileSync(SUMMARY_FILE, indentation + "* " + path.basename(pathName) + "\n");
            for (const fileName of fs.readdirSync(pathName))
                scan(pathName + "/" + fileName, indentation + "  ");
        }
        else if (pathName.endsWith(".sol")) {
            fs.appendFileSync(SUMMARY_FILE, indentation + "* [" + path.basename(pathName).slice(0, -4) + "](" + relativePath + pathName.slice(INPUT_DIR.length, -4) + ".md)\n");
        }
    }
}

function fix(pathName) {
    if (fs.lstatSync(pathName).isDirectory()) {
        for (const fileName of fs.readdirSync(pathName))
            fix(pathName + "/" + fileName);
    }
    else if (pathName.endsWith(".md")) {
        fs.writeFileSync(pathName, fs.readFileSync(pathName, {encoding: "utf8"}).split("\r").join("").split("\n").filter(line => line.trim().length > 0).join("\n\n") + "\n");
    }
}

fs.writeFileSync (SUMMARY_FILE, "# Summary\n");
fs.writeFileSync (".gitbook.yaml", "root: ./\n");
fs.appendFileSync(".gitbook.yaml", "structure:\n");
fs.appendFileSync(".gitbook.yaml", "  readme: README.md\n");
fs.appendFileSync(".gitbook.yaml", "  summary: " + SUMMARY_FILE + "\n");

scan(INPUT_DIR, "");

const args = [
    NODE_DIR + "/solidity-docgen/dist/cli.js",
    "--input="         + INPUT_DIR,
    "--output="        + OUTPUT_DIR,
    "--templates="     + CONFIG_DIR,
    "--solc-module="   + NODE_DIR + "/truffle/node_modules/solc",
    "--solc-settings=" + JSON.stringify({optimizer: {enabled: true, runs: 200}}),
    "--contract-pages"
];

const result = spawnSync("node", args, {stdio: ["inherit", "inherit", "pipe"]});
if (result.stderr.length > 0)
    throw new Error(result.stderr);

fix(OUTPUT_DIR);
