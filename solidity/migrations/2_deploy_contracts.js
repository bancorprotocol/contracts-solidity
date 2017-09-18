/* global artifacts */
/* eslint-disable prefer-reflect */
const bigNumber = require('bignumber.js');
const ENJCrowdfund = artifacts.require('ENJCrowdfund.sol');
const ENJToken = artifacts.require('ENJToken.sol');

module.exports = async (deployer) => {
    deployer.deploy(ENJCrowdfund, new bigNumber(4).times(new bigNumber(10).pow(26)), this.web3.eth.accounts[1]).then(() => {
        deployer.deploy(ENJToken, ENJCrowdfund.address, this.web3.eth.accounts[2]);
    })
};
