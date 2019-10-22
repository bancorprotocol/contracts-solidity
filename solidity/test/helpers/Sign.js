const web3Utils = require("web3-utils");

module.exports = function(block, gasPrice, originSender, actualSender, customVal, path, signerAddress) {
    const message = web3Utils.soliditySha3(block, gasPrice, originSender, actualSender, customVal, {type: "address", value: path});
    const signature = web3.eth.sign(signerAddress, message.toString("hex"));
    const r = "0x" + signature.slice(2, 66);
    const s = "0x" + signature.slice(66, 130);
    const v = parseInt(signature.slice(130), 16) + 27;
    return {v, r, s};
};
