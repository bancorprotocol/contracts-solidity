let WORK_DIR   = "./solidity";
let NODE_DIR   = "../node_modules";
let INPUT_DIR  = "./solidity/build/contracts/";
let OUTPUT_DIR = "./solidity/build/";

let fs    = require("fs");
let spawn = require("child_process").spawn;

function extractBinaries() {
    for (let fileName of fs.readdirSync(INPUT_DIR)) {
         let data = JSON.parse(fs.readFileSync(INPUT_DIR + fileName, {encoding: "utf8"}));
         fs.writeFileSync(OUTPUT_DIR + fileName.replace(".json", ".abi"), JSON.stringify(data.abi)  , {encoding: "utf8"});
         fs.writeFileSync(OUTPUT_DIR + fileName.replace(".json", ".bin"), data.bytecode.substring(2), {encoding: "utf8"});
    }
}

let cp = spawn("node", [NODE_DIR + "/truffle/build/cli.bundled.js", "compile", "--all", "--fix_paths"], {cwd: WORK_DIR});

cp.stdout.on("data", function(data) {process.stdout.write(data.toString());});
cp.stderr.on("data", function(data) {process.stderr.write(data.toString());});
cp.on("error", function(error) {process.stderr.write(error.toString());});
cp.on("exit", function(code, signal) {extractBinaries()});
