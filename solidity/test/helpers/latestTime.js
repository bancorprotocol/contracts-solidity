// From https://github.com/OpenZeppelin/zeppelin-solidity/blob/master/test/helpers/latestTime.js

// Returns the time of the last mined block in seconds
export default function latestTime() {
  return web3.eth.getBlock('latest').timestamp;
}
