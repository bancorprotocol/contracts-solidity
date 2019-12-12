const WORK_DIR = "./solidity";
const NODE_DIR = "../node_modules";
const CONTRACT_NAME = process.argv[2];

const fs        = require("fs");
const path      = require("path");
const spawnSync = require("child_process").spawnSync;

function run() {
    for (const pathName of getPathNames("contracts")) {
        const contractName = path.basename(pathName, ".sol");
        if (CONTRACT_NAME == contractName)
            console.log(getSourceCode(pathName))
    }
}

function getPathNames(dirName) {
    let pathNames = [];
    for (const fileName of fs.readdirSync(WORK_DIR + "/" + dirName)) {
        if (fs.statSync(WORK_DIR + "/" + dirName + "/" + fileName).isDirectory())
            pathNames = pathNames.concat(getPathNames(dirName + "/" + fileName));
        else if (fileName.endsWith(".sol"))
            pathNames.push(dirName + "/" + fileName);
    }
    return pathNames;
}

function getSourceCode(pathName) {
    const result = spawnSync("node", [NODE_DIR + "/truffle-flattener/index.js", pathName], {cwd: WORK_DIR});
    return result.output.toString().slice(1, -1);
}

run();
