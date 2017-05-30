/* global artifacts */

const Migrations = artifacts.require('Migrations.sol');
const BancorFormula = artifacts.require('BancorFormula.sol');

module.exports = (deployer) => {
    deployer.deploy(Migrations);
    deployer.deploy(BancorFormula);
};
