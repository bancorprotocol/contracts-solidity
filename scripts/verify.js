let WORK_DIR = "./solidity";
let NODE_DIR = "../node_modules";
let INPUT_FILE = process.argv[2];

let fs        = require("fs");
let path      = require("path");
let request   = require("request");
let spawnSync = require("child_process").spawnSync;

let input = JSON.parse(fs.readFileSync(INPUT_FILE, {encoding: "utf8"}));
//  input example:
//  {
//      "network"        : "api", // use "api" for mainnet or "api-<testnet>" for testnet
//      "apiKey"         : "",    // generate this value at https://etherscan.io/myapikey
//      "compilerVersion": "v0.4.24+commit.e67f0147",
//      "optimization"   : {"used": 1, "runs": 200},
//      "contracts"      : {
//          "Contract1": {"addr": "0x0000000000000000000000000000000000000001", "args": "<abi-encoded constructor arguments>"},
//          "Contract2": {"addr": "0x0000000000000000000000000000000000000002", "args": "<abi-encoded constructor arguments>"},
//          "Contract3": {"addr": "0x0000000000000000000000000000000000000003", "args": "<abi-encoded constructor arguments>"}
//      }
//  }

function run() {
    for (let pathName of getPathNames("contracts")) {
        let contractName = path.basename(pathName, ".sol");
        if (input.contracts.hasOwnProperty(contractName))
            post(contractName, getSourceCode(pathName));
    }
}

function getPathNames(dirName) {
    let pathNames = [];
    for (let fileName of fs.readdirSync(WORK_DIR + "/" + dirName)) {
        if (fs.statSync(WORK_DIR + "/" + dirName + "/" + fileName).isDirectory())
            pathNames = pathNames.concat(getPathNames(dirName + "/" + fileName));
        else if (fileName.endsWith(".sol"))
            pathNames.push(dirName + "/" + fileName);
    }
    return pathNames;
}

function getSourceCode(pathName) {
    let result = spawnSync("node", [NODE_DIR + "/truffle-flattener/index.js", pathName], {cwd: WORK_DIR});
    return result.output.toString().slice(1, -1);
}

function post(contractName, sourceCode) {
    console.log(contractName + ": sending verification request...");
    request.post({
            url: "https://" + input.network + ".etherscan.io/api",
            form: {
                module               : "contract",
                action               : "verifysourcecode",
                sourceCode           : sourceCode,
                contractname         : contractName,
                apikey               : input.apiKey,
                compilerversion      : input.compilerVersion,
                optimizationUsed     : input.optimization.used,
                runs                 : input.optimization.runs,
                contractaddress      : input.contracts[contractName].addr,
                constructorArguements: input.contracts[contractName].args,
            }
        },
        function(error, response, body) {
            if (error) {
                console.log(contractName + ": " + error);
            }
            else {
                body = JSON.parse(body);
                if (body.status == "1")
                    get(contractName, body.result);
                else
                    console.log(contractName + ": " + body.result);
            }
        }
    );
}

function get(contractName, guid) {
    console.log(contractName + ": checking verification status...");
    request.get(
        "https://" + input.network + ".etherscan.io/api?module=contract&action=checkverifystatus&guid=" + guid,
        function(error, response, body) {
            if (error) {
                console.log(contractName + ": " + error);
            }
            else {
                body = JSON.parse(body);
                if (body.result == "Pending in queue")
                    get(contractName, guid);
                else
                    console.log(contractName + ": " + body.result);
            }
        }
    );
}

run();