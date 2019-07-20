/* global artifacts */

const Migrations = artifacts.require('Migrations.sol');

module.exports = function(deployer, network, accounts) {
    if (network == "production") {
        deployer.deploy(Migrations);
    }
};
