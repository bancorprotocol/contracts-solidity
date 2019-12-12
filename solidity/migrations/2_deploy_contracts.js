module.exports = function(deployer, network, accounts) {
    if (network == "production") {
        const CFG_FILE_NAME = process.argv[4];
        const NODE_ADDRESS  = process.argv[5];
        const PRIVATE_KEY   = process.argv[6];
        const child_process = require("child_process");
        const result = child_process.spawnSync("node", [__dirname + "/../utils/deploy_network_emulation.js", CFG_FILE_NAME, NODE_ADDRESS, PRIVATE_KEY], {stdio: ["inherit", "inherit", "pipe"]});
        if (result.stderr.length > 0)
            throw new Error(result.stderr);
    }
};
