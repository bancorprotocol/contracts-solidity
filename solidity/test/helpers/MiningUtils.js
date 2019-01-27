/*
 web3 utils for controlling mining
*/

function stopMining(provider) {
    return callJsonrpcMethod(provider, 'miner_stop');
}
  
function startMining(provider) {
    return callJsonrpcMethod(provider, 'miner_start');
}
  
function mineBlock(provider) {
    return callJsonrpcMethod(provider, 'evm_mine');
}
  
async function callJsonrpcMethod(provider, method, params) {
    const args = {
        jsonrpc: '2.0',
        id: new Date().getTime(),
        method,
    };
  
    if (params) {
        args.params = params;
    }
  
    const response = await sendAsync(provider, args);
  
    return response.result;
}
  
async function sendAsync(provider, args) {
    // Needed for different versions of web3
    const func = provider.sendAsync || provider.send;
    let response;
  
    response = await new Promise((resolve, reject) => func.call(
        provider,
        args,
        (err, result) => {
            if (err) {
                reject(err);
            } else {
                resolve(result);
            }
        }
    ));
  
    return response;
}

module.exports = {
    stopMining,
    startMining,
    mineBlock,
    callJsonrpcMethod
}
