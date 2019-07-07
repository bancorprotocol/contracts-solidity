const NODE_DIR = "node_modules";
const CONS_DIR = "solidity/contracts";
const DOCS_DIR = "docs";
const SKIP_DIR = ["helpers"];

const fs        = require("fs");
const spawnSync = require("child_process").spawnSync;

fs.writeFileSync(CONS_DIR + "/README.md", "");
fs.writeFileSync("SUMMARY.md", `* [main](${DOCS_DIR}/index.md)\n`);

for (const fileName of fs.readdirSync(CONS_DIR)) {
    if (fs.lstatSync(CONS_DIR + "/" + fileName).isDirectory() && !SKIP_DIR.includes(fileName)) {
        fs.writeFileSync(CONS_DIR + "/" + fileName + "/README.md", "");
        fs.appendFileSync("SUMMARY.md", `* [${fileName}](${DOCS_DIR}/${fileName}.md)\n`);
    }
}

function runNode(args) {
    const result = spawnSync("node", args)
    if (result.stdout.toString()) process.stdout.write(result.stdout.toString());
    if (result.stderr.toString()) throw new Error(result.stderr.toString());
    if (result.error) throw result.error;
}

runNode([
    NODE_DIR + "/solidity-docgen/dist/cli.js",
    "--contractsDir=" + CONS_DIR,
    "--outputDir="    + DOCS_DIR,
    "--ignore="       + SKIP_DIR.join(","),
    "--templateFile=" + CONS_DIR + "/../docgen.hbs",
    "--solcModule="   + NODE_DIR + "/truffle/node_modules/solc"
]);

runNode([
    NODE_DIR + "/gitbook-cli/bin/gitbook.js",
    "build"
]);
