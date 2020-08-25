const WORK_DIR = './solidity';
const NODE_DIR = '../node_modules';
const CONTRACT_NAME = process.argv[2];

const fs = require('fs');
const path = require('path');
const spawnSync = require('child_process').spawnSync;

const run = () => {
    for (const pathName of getPathNames('contracts')) {
        const contractName = path.basename(pathName, '.sol');
        if (CONTRACT_NAME === contractName) {
            console.log(getSourceCode(pathName));
        }
    }
};

const getPathNames = (dirName) => {
    let pathNames = [];
    for (const fileName of fs.readdirSync(WORK_DIR + '/' + dirName)) {
        if (fs.statSync(WORK_DIR + '/' + dirName + '/' + fileName).isDirectory()) {
            pathNames = pathNames.concat(getPathNames(dirName + '/' + fileName));
        }
        else if (fileName.endsWith('.sol')) {
            pathNames.push(dirName + '/' + fileName);
        }
    }
    return pathNames;
};

const getSourceCode = (pathName) => {
    const result = spawnSync('node', [NODE_DIR + '/truffle-flattener/index.js', pathName], {
        cwd: WORK_DIR
    });

    // removing all occurrences of SPDX license identifiers except first
    // TODO: this is only ok if all files have the same license
    let i = 0;
    const source = result.output.toString().replace(/\/\/ SPDX-License-Identifier.*/g, m => !i++ ? m : '');
    return source.slice(1, -1);
};

run();
