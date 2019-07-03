const NODE_DIR = "node_modules";
const CONS_DIR = "solidity/contracts";
const DOCS_DIR = "documents";

const fs        = require("fs");
const spawnSync = require("child_process").spawnSync;

fs.writeFileSync("SUMMARY.md", "# Summary\n\n");
fs.appendFileSync("SUMMARY.md", `* [main](${DOCS_DIR}/index.md)\n`);

for (const fileName of fs.readdirSync(CONS_DIR)) {
    if (fs.lstatSync(CONS_DIR + "/" + fileName).isDirectory()) {
        fs.writeFileSync(CONS_DIR + "/" + fileName + "/README.md", "");
        fs.appendFileSync("SUMMARY.md", `* [${fileName}](${DOCS_DIR}/${fileName}.md)\n`);
    }
}

spawnSync("node", [
    NODE_DIR + "/solidity-docgen/dist/cli.js",
    "--contractsDir=" + CONS_DIR,
    "--outputDir="    + DOCS_DIR,
    "--templateFile=" + "solidity/docgen.hbs",
    "--solcModule="   + NODE_DIR + "/truffle/node_modules/solc"
]);

spawnSync("node", [
    NODE_DIR + "/gitbook-cli/bin/gitbook.js",
    "build"
]);
