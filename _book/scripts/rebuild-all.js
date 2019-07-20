const WORK_DIR   = "./solidity";
const NODE_DIR   = "../node_modules";
const INPUT_DIR  = "./solidity/build/contracts/";
const OUTPUT_DIR = "./solidity/build/";

const fs    = require("fs");
const spawn = require("child_process").spawn;

function extractBinaries() {
    for (const fileName of fs.readdirSync(INPUT_DIR)) {
        const data = JSON.parse(fs.readFileSync(INPUT_DIR + fileName, {encoding: "utf8"}));
        fs.writeFileSync(OUTPUT_DIR + fileName.replace(".json", ".abi"), JSON.stringify(data.abi)  , {encoding: "utf8"});
        fs.writeFileSync(OUTPUT_DIR + fileName.replace(".json", ".bin"), data.bytecode.substring(2), {encoding: "utf8"});
    }
}

const cp = spawn("node", [NODE_DIR + "/truffle/build/cli.bundled.js", "compile", "--all", "--fix_paths"], {cwd: WORK_DIR});

cp.stdout.on("data", function(data) {process.stdout.write(data.toString());});
cp.stderr.on("data", function(data) {process.stderr.write(data.toString());});
cp.on("error", function(error) {process.stderr.write(error.toString());});
cp.on("exit", function(code, signal) {extractBinaries();});
