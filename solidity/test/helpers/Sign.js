const web3Utils = require("web3-utils");
const ethereumjsUtil = require("ethereumjs-util");

module.exports = function(block, gasPrice, originSender, actualSender, customVal, path, signerAddress) {
    const message = web3Utils.soliditySha3(block, gasPrice, originSender, actualSender, customVal, {type: "address", value: path});
    const signature = web3.eth.sign(signerAddress, ethereumjsUtil.bufferToHex(message));
    const {v, r, s} = ethereumjsUtil.fromRpcSig(signature);
    return {v: v, r: ethereumjsUtil.bufferToHex(r), s: ethereumjsUtil.bufferToHex(s)};
};
