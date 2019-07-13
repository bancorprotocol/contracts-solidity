const NODE_DIR = "node_modules";
const INPUT_DIR = "solidity/contracts";
const OUTPUT_DIR = "docs";
const TEMPLATE_DIR = "solidity/docgen";

// Skip any file or folder whose name is in the list below
const SKIP_LIST = [
    "bancorx/interfaces",
    "converter/interfaces",
    "crowdsale",
    "helpers",
    "legacy",
    "token/interfaces",
    "utility/interfaces",
    "ContractIds.sol",
    "FeatureIds.sol",
    "IBancorNetwork.sol"
];

const fs        = require("fs");
const basename  = require("path").basename;
const spawnSync = require("child_process").spawnSync;

function scanDir(pathName = INPUT_DIR, indentation = "") {
    if (!SKIP_LIST.map(x => INPUT_DIR + "/" + x).includes(pathName)) {
        if (fs.lstatSync(pathName).isDirectory()) {
            fs.appendFileSync("SUMMARY.md", indentation + "* " + basename(pathName) + ":\n");
            for (const fileName of fs.readdirSync(pathName))
                scanDir(pathName + "/" + fileName, indentation + "  ");
        }
        else if (pathName.endsWith(".sol")) {
            fs.appendFileSync("SUMMARY.md", indentation + "* [" + basename(pathName).replace(".sol", "") + "](" + OUTPUT_DIR + pathName.replace(INPUT_DIR, "").replace(".sol", ".md") + ")\n");
        }
    }
}

function removeDir(pathName) {
    for (const fileName of fs.readdirSync(pathName)) {
        if (fs.lstatSync(pathName + "/" + fileName).isDirectory())
            removeDir(pathName + "/" + fileName);
        else
            fs.unlinkSync(pathName + "/" + fileName);
    }
    fs.rmdirSync(pathName);
};

function runNode(args) {
    const result = spawnSync("node", args)
    if (result.stdout.toString()) process.stdout.write(result.stdout.toString());
    if (result.stderr.toString()) throw new Error(result.stderr.toString());
    if (result.error) throw result.error;
}

fs.writeFileSync("SUMMARY.md", "# Summary\n");
scanDir();

runNode([
    NODE_DIR + "/solidity-docgen/dist/cli.js",
    "--input="       + INPUT_DIR,
    "--output="      + OUTPUT_DIR,
    "--templates="   + TEMPLATE_DIR,
    "--solc-module=" + NODE_DIR + "/truffle/node_modules/solc",
    "--contract-pages"
]);

runNode([
    NODE_DIR + "/gitbook-cli/bin/gitbook.js",
    "build"
]);

fs.unlinkSync("SUMMARY.md");
removeDir(OUTPUT_DIR);
