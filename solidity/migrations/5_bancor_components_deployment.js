const EtherToken = artifacts.require('EtherToken.sol');

const BancorFormula = artifacts.require('BancorFormula.sol');
const BancorGasPriceLimit = artifacts.require('BancorGasPriceLimit.sol');
const BancorQuickConverter = artifacts.require('BancorQuickConverter.sol');
const BancorConverterExtensions = artifacts.require('BancorConverterExtensions.sol');

const gasPrice = 22000000000;

module.exports = (deployer, _network, _accounts) => {
    return deployer
        .then(() => {
            return deployer.deploy(BancorFormula);
        })
        .then(() => {
            return deployer.deploy(BancorGasPriceLimit, gasPrice);
        })
        .then(() => {
            return deployer.deploy(BancorQuickConverter);
        })
        .then((instance) => {
            return instance.registerEtherToken(EtherToken.address, true);
        })
        .then((instance) => {
            return deployer.deploy(BancorConverterExtensions,
                BancorFormula.address,
                BancorGasPriceLimit.address,
                BancorQuickConverter.address
            );
        });
};
