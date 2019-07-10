const NODE_DIR = "node_modules";
const CONS_DIR = "solidity/contracts";
const DOCS_DIR = "docs";

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

function scanDir(pathName = CONS_DIR, indentation = "") {
    if (!SKIP_LIST.map(x => CONS_DIR + "/" + x).includes(pathName)) {
        if (fs.lstatSync(pathName).isDirectory()) {
            fs.appendFileSync("SUMMARY.md", indentation + "* " + basename(pathName) + ":\n");
            for (const fileName of fs.readdirSync(pathName))
                scanDir(pathName + "/" + fileName, indentation + "  ");
        }
        else if (pathName.endsWith(".sol")) {
            fs.appendFileSync("SUMMARY.md", indentation + "* [" + basename(pathName).replace(".sol", "") + "](" + DOCS_DIR + "/" + basename(pathName).replace(".sol", ".md") + ")\n");
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

fs.writeFileSync(CONS_DIR + "/README.md", "");
fs.writeFileSync("SUMMARY.md", "# Summary\n");
scanDir();

runNode([
    NODE_DIR + "/solidity-docgen/dist/cli.js",
    "--contractsDir=" + CONS_DIR,
    "--outputDir="    + DOCS_DIR,
    "--templateFile=" + CONS_DIR + "/../docgen.hbs",
    "--solcModule="   + NODE_DIR + "/truffle/node_modules/solc"
]);

for (const contractDoc of fs.readFileSync(DOCS_DIR + "/index.md").toString().split("# Contract "))
    fs.writeFileSync(DOCS_DIR + "/" + contractDoc.split("`")[1] + ".md", "# Contract " + contractDoc);

runNode([
    NODE_DIR + "/gitbook-cli/bin/gitbook.js",
    "build"
]);

fs.unlinkSync(CONS_DIR + "/README.md");
fs.unlinkSync("SUMMARY.md");
removeDir(DOCS_DIR);
