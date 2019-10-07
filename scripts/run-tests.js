const TRUFFLE_TEST = "1";
const SOL_COVERAGE = "2";

const WORK_DIR = "./solidity";
const NODE_DIR = "../node_modules";

const spawn = require("child_process").spawn;

function getArgs(id, args) {
    switch (id) {
        case TRUFFLE_TEST: return args.TRUFFLE_TEST;
        case SOL_COVERAGE: return args.SOL_COVERAGE;
    }
    throw `invalid input = '${id}'`;
}

function server(id) {
    const args = getArgs(id, {
        TRUFFLE_TEST: [NODE_DIR + "/ganache-cli/cli.js"          , "--port=7545", "--gasPrice=20000000000", "--gasLimit=6721975"         ],
        SOL_COVERAGE: [NODE_DIR + "/ethereumjs-testrpc-sc/cli.js", "--port=7555", "--gasPrice=0x1"        , "--gasLimit=0x1fffffffffffff"],
    });
    const cp = spawn("node", [...args,
        "--account=0x0000000000000000000000000000000000000000000000000000000000000001,1000000000000000000000000000000000000000",
        "--account=0x0000000000000000000000000000000000000000000000000000000000000002,1000000000000000000000000000000000000000",
        "--account=0x0000000000000000000000000000000000000000000000000000000000000003,1000000000000000000000000000000000000000",
        "--account=0x0000000000000000000000000000000000000000000000000000000000000004,1000000000000000000000000000000000000000",
        "--account=0x0000000000000000000000000000000000000000000000000000000000000005,1000000000000000000000000000000000000000",
        "--account=0x0000000000000000000000000000000000000000000000000000000000000006,1000000000000000000000000000000000000000",
        "--account=0x0000000000000000000000000000000000000000000000000000000000000007,1000000000000000000000000000000000000000",
        "--account=0x0000000000000000000000000000000000000000000000000000000000000008,1000000000000000000000000000000000000000",
        "--account=0x0000000000000000000000000000000000000000000000000000000000000009,1000000000000000000000000000000000000000",
        "--account=0x000000000000000000000000000000000000000000000000000000000000000a,1000000000000000000000000000000000000000"], {cwd: WORK_DIR});
    cp.stdout.on("data", function(data) {/*process.stdout.write(data.toString());*/});
    cp.stderr.on("data", function(data) {process.stderr.write(data.toString());});
    cp.on("error", function(error) {process.stderr.write(error.toString());});
    return cp;
}

function client(id) {
    const args = getArgs(id, {
        TRUFFLE_TEST: [NODE_DIR + "/truffle/build/cli.bundled.js", "test"],
        SOL_COVERAGE: [NODE_DIR + "/solidity-coverage/bin/exec.js"       ],
    });
    const cp = spawn("node", args, {cwd: WORK_DIR});
    cp.stdout.on("data", function(data) {process.stdout.write(data.toString());});
    cp.stderr.on("data", function(data) {process.stderr.write(data.toString());});
    cp.on("error", function(error) {process.stderr.write(error.toString());});
    return cp;
}

function execute(id) {
    const server_cp = server(id);
    const client_cp = client(id);
    client_cp.on("exit", function(code, signal) {server_cp.kill();});
}

if (process.argv.length > 2) {
    execute(process.argv[2]);
}
else {
    process.stdout.write(`Enter '${TRUFFLE_TEST}' for truffle-test or '${SOL_COVERAGE}' for solidity-coverage: `);
    process.stdin.resume();
    process.stdin.once("data", function(data) {
        process.stdin.pause();
        execute(data.toString().trim());
    });
}
